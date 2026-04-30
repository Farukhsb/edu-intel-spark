import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Brain, ChevronDown, ChevronUp, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DashboardDemoBanner,
  DashboardEmptyState,
  DashboardLoadingState,
  DashboardPageIntro,
} from "@/components/dashboard/PageStates";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import {
  DEMO_STUDENT_ASSIGNMENTS,
  DEMO_STUDENT_ASSIGNMENT_GRADES,
  DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS,
} from "@/pages/dashboard/demoAssignments";

interface ExplainGradeBreakdown {
  assessment: string;
  totalGrade: number;
  band: string;
  components: { name: string; weight: number; score: number; maxScore: number }[];
  improvementAreas: { area: string; currentBand: string; nextBand: string; pointsNeeded: number; tips: string[] }[];
}

interface SubmissionRow {
  id: string;
  assignment_id: string | null;
  student_name: string | null;
  file_name: string | null;
  status?: string | null;
  released_at?: string | null;
  updated_at?: string | null;
}

interface GradeRow {
  id: string;
  submission_id: string;
  ai_score: number | null;
  final_score: number | null;
  ai_breakdown: SharedGradeBreakdown[] | null;
}

interface AssignmentRow {
  id: string;
  module_code: string | null;
  title: string;
}

interface AssignmentMetadataRow {
  assignment_id: string;
  max_score: number | null;
  module_code: string | null;
  submission_id: string;
  title: string | null;
}

type ExplainGradeBreakdownItem = AcademicGradeBreakdownItem & SharedGradeBreakdown;

export const getBreakdownMaxScore = (item: ExplainGradeBreakdownItem) => item.max_score ?? item.maxScore ?? 0;

type ChatMsg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${env.VITE_SUPABASE_URL}/functions/v1/explain-grade`;

const getBand = (pct: number) => {
  if (pct >= 70) return "1st";
  if (pct >= 60) return "2:1";
  if (pct >= 50) return "2:2";
  if (pct >= 40) return "3rd";
  return "Fail";
};

const getNextBand = (band: string) => {
  if (band === "3rd") return "2:2";
  if (band === "2:2") return "2:1";
  if (band === "2:1") return "1st";
  return "1st";
};

const getNextBandThreshold = (band: string) => {
  if (band === "3rd") return 50;
  if (band === "2:2") return 60;
  if (band === "2:1") return 70;
  return 80;
};

interface SubmissionOption {
  gradeId: string;
  submissionId: string;
  label: string;
  secondaryLabel: string | null;
  totalGrade: number;
  breakdown: ExplainGradeBreakdown;
}

const formatReleasedDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const buildGradeSelectorLabels = ({
  assignmentTitle,
  fileName,
  releasedAt,
  score,
}: {
  assignmentTitle?: string | null;
  fileName?: string | null;
  releasedAt?: string | null;
  score: number;
}) => {
  const title = assignmentTitle?.trim();
  const file = fileName?.trim();
  const primaryBase = title || file || "Released grade";
  const releasedDate = formatReleasedDate(releasedAt);
  const secondaryParts = [file, releasedDate ? `Released ${releasedDate}` : null].filter(Boolean);

  return {
    label: `${primaryBase} — ${score}%`,
    assessment: primaryBase,
    secondaryLabel: secondaryParts.length > 0 ? secondaryParts.join(" · ") : null,
  };
};

const DEMO_SUBMISSIONS: SubmissionOption[] = Object.values(DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS)
  .flat()
  .flatMap((submission) => {
    if (submission.status !== "released") return [];
    const assignment = DEMO_STUDENT_ASSIGNMENTS.find((entry) => entry.id === submission.assignment_id);
    const grade = DEMO_STUDENT_ASSIGNMENT_GRADES[submission.id];
    const breakdown = safeParseGradeBreakdown(grade?.ai_breakdown ?? []);
    if (!grade || !breakdown.success) return [];

    const totalGrade = Number(grade.final_score ?? grade.ai_score ?? 0);
    const totalMaxRaw = breakdown.data.reduce(
      (sum, item: ExplainGradeBreakdownItem) => sum + getBreakdownMaxScore(item),
      0,
    );
    const totalMax = totalMaxRaw > 0 ? totalMaxRaw : 1;

    const components = breakdown.data.map((item: ExplainGradeBreakdownItem) => ({
      name: item.criterion || item.name || "Unknown",
      weight: Math.round((getBreakdownMaxScore(item) / totalMax) * 100),
      score: Math.round(((item.score ?? 0) / Math.max(getBreakdownMaxScore(item), 1)) * 100),
      maxScore: 100,
    }));

    const improvementAreas = components
      .filter((component) => component.score < 70)
      .sort((left, right) => left.score - right.score)
      .slice(0, 3)
      .map((component) => {
        const band = getBand(component.score);
        const next = getNextBand(band);
        const threshold = getNextBandThreshold(band);
        return {
          area: component.name,
          currentBand: band,
          nextBand: next,
          pointsNeeded: Math.max(threshold - component.score, 0),
          tips: [
            `Focus on strengthening your ${component.name.toLowerCase()} skills`,
            `Review the rubric criteria for ${component.name}`,
            "Use the released lecturer feedback to revise the next submission",
          ],
        };
      });

    const labels = buildGradeSelectorLabels({
      assignmentTitle: assignment?.title,
      fileName: submission.file_name,
      score: totalGrade,
    });

    return [
      {
        gradeId: grade.id,
        submissionId: submission.id,
        label: labels.label,
        secondaryLabel: labels.secondaryLabel,
        totalGrade,
        breakdown: {
          assessment: labels.assessment,
          totalGrade,
          band: getBand(totalGrade),
          components,
          improvementAreas,
        },
      },
    ];
  });

const buildDemoGradeResponse = (question: string, breakdown: ExplainGradeBreakdown) => {
  const weakestArea = breakdown.improvementAreas[0];
  const strongestArea = [...breakdown.components].sort((left, right) => right.score - left.score)[0];
  const normalizedQuestion = question.toLowerCase();

  if (normalizedQuestion.includes("why") && normalizedQuestion.includes("grade")) {
    return `You received **${breakdown.totalGrade}% (${breakdown.band})** because your strongest performance was in **${strongestArea?.name || "your best-scoring criterion"}**, while the main drag on your mark was **${weakestArea?.area || "the weakest rubric area"}**. The demo breakdown shows a solid overall submission with a clearer route to improvement in one weaker criterion rather than broad underperformance.`;
  }

  if (normalizedQuestion.includes("improve") || normalizedQuestion.includes("raise")) {
    return `The fastest route upward is **${weakestArea?.area || "the weakest rubric area"}**. In this demo submission, you need roughly **${weakestArea?.pointsNeeded ?? 0} more points** there to move closer to **${weakestArea?.nextBand || "the next band"}**. Focus on:\n\n- ${weakestArea?.tips[0] || "Tightening criterion-specific evidence"}\n- ${weakestArea?.tips[1] || "Matching the rubric language more directly"}\n- ${weakestArea?.tips[2] || "Using the lecturer feedback to revise your approach"}`
  }

  return `For this demo submission, the key message is:\n\n- Overall result: **${breakdown.totalGrade}% (${breakdown.band})**\n- Strongest area: **${strongestArea?.name || "Top criterion"}** at **${strongestArea?.score ?? 0}%**\n- Main improvement area: **${weakestArea?.area || "Weakest criterion"}**\n\nAsk why the mark landed in this band, or ask how to improve the weakest area, and I’ll answer using the synthetic demo breakdown.`;
};

const ExplainGrade = () => {
  const { isDemo, user } = useAuth();
  const { submissions, selectedId, setSelectedId, loading } = useExplainGradeData({
    isDemo,
    userId: user?.id,
  });
  const [expandedArea, setExpandedArea] = useState<number | null>(0);
  const [messages, setMessages] = useState<ChatMsg[]>([INITIAL_ASSISTANT_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchGrades = async () => {
    try {
      // RLS ensures students only see their own submissions/grades
      const { data: subs } = await supabase.from("submissions").select("*");
      const submissionRows = (subs ?? []) as SubmissionRow[];
      const releasedSubs = submissionRows.filter((submission) => submission.status === "released");
      const subIds = releasedSubs.map(s => s.id);
      const { data: grades } = subIds.length > 0
        ? await supabase.from("grades").select("*").in("submission_id", subIds)
        : { data: [] as GradeRow[] };
      const assignmentMetaRes = await supabase.rpc("get_student_grade_assignment_metadata");

      if (!grades?.length || !releasedSubs.length) {
        setLoading(false);
        return;
      }

      const safeSubs = releasedSubs;
      const subMap = Object.fromEntries(safeSubs.map(s => [s.id, s]));
      const assignmentMap: Record<string, AssignmentMetadataRow> = {};
      if (assignmentMetaRes.error) {
        log.warn("ExplainGrade assignment metadata lookup failed", assignmentMetaRes.error);
      } else {
        ((assignmentMetaRes.data ?? []) as AssignmentMetadataRow[]).forEach((row) => {
          assignmentMap[row.submission_id] = row;
        });
      }

      const options: SubmissionOption[] = grades
        .flatMap(g => {
          if (g.ai_score == null && g.final_score == null) return [];
          const breakdownResult = safeParseGradeBreakdown(g.ai_breakdown);
          if (!breakdownResult.success) {
            log.error("Invalid grade breakdown payload received for ExplainGrade", breakdownResult.error, {
              gradeId: g.id,
              submissionId: g.submission_id,
            });
            return [];
          }

          const sub = subMap[g.submission_id];
          const assignment = assignmentMap[g.submission_id];
          const totalGrade = Number(g.final_score ?? g.ai_score ?? 0);
          const breakdown: ExplainGradeBreakdownItem[] = breakdownResult.data;
          const totalMaxRaw = breakdown.reduce((s: number, b: ExplainGradeBreakdownItem) => s + getBreakdownMaxScore(b), 0);
          if (totalMaxRaw === 0 && import.meta.env.DEV) {
            log.warn("AI breakdown has no max scores; using fallback totalMax = 1", {
              gradeId: g.id,
            });
          }
          const totalMax = totalMaxRaw > 0 ? totalMaxRaw : 1;

          const components = breakdown.map((b: ExplainGradeBreakdownItem) => ({
            name: b.criterion || b.name || "Unknown",
            weight: Math.round((getBreakdownMaxScore(b) / totalMax) * 100),
            score: Math.round(((b.score ?? 0) / Math.max(getBreakdownMaxScore(b), 1)) * 100),
            maxScore: 100,
          }));

          const improvementAreas = components
            .filter(c => c.score < 70)
            .sort((a, b) => a.score - b.score)
            .slice(0, 3)
            .map(c => {
              const band = getBand(c.score);
              const next = getNextBand(band);
              const threshold = getNextBandThreshold(band);
              return {
                area: c.name,
                currentBand: band,
                nextBand: next,
                pointsNeeded: Math.max(threshold - c.score, 0),
                tips: [
                  `Focus on strengthening your ${c.name.toLowerCase()} skills`,
                  `Review the rubric criteria for ${c.name}`,
                  `Seek specific feedback on this area from your lecturer`,
                ],
              };
            });

          const labels = buildGradeSelectorLabels({
            assignmentTitle: assignment?.title,
            fileName: sub?.file_name,
            releasedAt: sub?.released_at ?? sub?.updated_at,
            score: totalGrade,
          });

          return [{
            gradeId: g.id,
            submissionId: g.submission_id,
            label: labels.label,
            secondaryLabel: labels.secondaryLabel,
            totalGrade,
            breakdown: {
              assessment: labels.assessment,
              totalGrade,
              band: getBand(totalGrade),
              components,
              improvementAreas,
            },
          }];
        });

      setSubmissions(options);
      if (options.length > 0) setSelectedId(options[0].gradeId);
    } catch (err) {
      log.error("Failed to fetch grades", err);
    }
    setLoading(false);
  };

  const selected = submissions.find(s => s.gradeId === selectedId);
  const gradeBreakdown = selected?.breakdown;

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || !gradeBreakdown) return;

    const userMsg: ChatMsg = { role: "user", content: inputValue };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputValue("");

    if (isDemo) {
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: buildDemoGradeResponse(userMsg.content, gradeBreakdown) },
      ]);
      return;
    }

    setIsLoading(true);
    let assistantSoFar = "";

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Not signed in");

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          submissionId: selected.submissionId,
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: "AI service error" }));
        toast.error(errorBody.error || "Something went wrong");
        setIsLoading(false);
        return;
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((previous) => {
          const last = previous[previous.length - 1];
          if (last?.role === "assistant" && previous.length === updatedMessages.length + 1) {
            return previous.map((message, index) =>
              index === previous.length - 1 ? { ...message, content: assistantSoFar } : message,
            );
          }
          return [...previous, { role: "assistant", content: assistantSoFar }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = `${line}\n${textBuffer}`;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            // Ignore trailing partial chunks after stream completion.
          }
        }
      }
    } catch (error) {
      log.error("Failed to get AI response", error);
      toast.error("Failed to get AI response");
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (!gradeBreakdown) {
    return (
      <DashboardEmptyState
        title="No graded submissions found"
        description="Grades will appear here once assignments are graded by AI."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && <DashboardDemoBanner label="Viewing demo Explain Grade data" />}

      <DashboardPageIntro
        eyebrow="Grade explanation"
        title="Explain Grade"
        description="Review the released breakdown, see which criteria pulled the mark up or down, and ask targeted follow-up questions about how to improve next time."
      />

      {submissions.length > 1 && (
        <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); setMessages([messages[0]]); }}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Select a submission" /></SelectTrigger>
          <SelectContent>
            {submissions.map(s => (
              <SelectItem key={s.gradeId} value={s.gradeId} textValue={s.label}>
                <span className="flex flex-col">
                  <span>{s.label}</span>
                  {s.secondaryLabel && (
                    <span className="text-xs text-muted-foreground">{s.secondaryLabel}</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Grade Breakdown</CardTitle>
          </div>
          <CardDescription>{gradeBreakdown.assessment}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-4xl font-bold font-display">{gradeBreakdown.totalGrade}%</span>
            <Badge>{gradeBreakdown.band}</Badge>
          </div>
          <div className="space-y-3">
            {gradeBreakdown.components.map((component, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {component.name} ({component.weight}%)
                  </span>
                  <span className="font-medium">{component.score}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      component.score >= 70 ? "bg-success" : component.score >= 50 ? "bg-primary" : "bg-destructive"
                    }`}
                    style={{ width: `${component.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {gradeBreakdown.improvementAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How to Improve</CardTitle>
            <CardDescription>Specific guidance to raise your grade band</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {gradeBreakdown.improvementAreas.map((area, index) => (
              <div key={index} className="rounded-lg border p-3">
                <button
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setExpandedArea(expandedArea === index ? null : index)}
                >
                  <div>
                    <span className="text-sm font-medium">{area.area}</span>
                    <p className="text-xs text-muted-foreground">
                      +{area.pointsNeeded} points to reach {area.nextBand}
                    </p>
                  </div>
                  {expandedArea === index ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {expandedArea === index ? (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {area.tips.map((tip, tipIndex) => (
                      <div key={tipIndex} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {tip}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Ask About Your Grade</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex h-80 flex-col">
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-2">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Ask about your grade..."
                onKeyDown={(event) => event.key === "Enter" && handleSend()}
                disabled={isLoading}
              />
              <Button size="icon" onClick={handleSend} disabled={isLoading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export { buildGradeSelectorLabels, getBreakdownMaxScore };

export default ExplainGrade;
