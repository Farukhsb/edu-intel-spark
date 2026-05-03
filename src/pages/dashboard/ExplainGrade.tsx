import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Brain, ChevronDown, ChevronUp, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

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
import { getExplainGradeReadiness } from "@/lib/explainGradeReadiness";
import { log } from "@/lib/logger";
import {
  buildDemoGradeResponse,
  buildGradeSelectorLabels,
  getBreakdownMaxScore,
} from "@/pages/dashboard/explain-grade/helpers";
import { useExplainGradeData } from "@/pages/dashboard/explain-grade/useExplainGradeData";

type ChatMsg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${env.VITE_SUPABASE_URL}/functions/v1/explain-grade`;

const INITIAL_ASSISTANT_MESSAGE: ChatMsg = {
  role: "assistant",
  content:
    "Hello! I'm your AI Grade Assistant. I can help you understand your grades, identify improvement areas, and provide specific guidance on raising your marks. What would you like to know?",
};

const getScoreTone = (score: number) => {
  if (score >= 70) return "success";
  if (score >= 50) return "primary";
  return "destructive";
};

const ExplainGrade = () => {
  const { isDemo, user } = useAuth();
  const { submissions, selectedId, setSelectedId, loading } = useExplainGradeData({
    isDemo,
    userId: user?.id,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedArea, setExpandedArea] = useState<number | null>(0);
  const [messages, setMessages] = useState<ChatMsg[]>([INITIAL_ASSISTANT_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusAssignmentId = searchParams.get("assignment");
  const focusSubmissionId = searchParams.get("submission");
  const focusSource = searchParams.get("source");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!submissions.length) return;

    const focusedSubmission =
      (focusSubmissionId
        ? submissions.find((submission) => submission.submissionId === focusSubmissionId)
        : undefined) ??
      (focusAssignmentId
        ? submissions.find((submission) => submission.assignmentId === focusAssignmentId)
        : undefined);

    if (focusedSubmission && focusedSubmission.gradeId !== selectedId) {
      setSelectedId(focusedSubmission.gradeId);
      setMessages([INITIAL_ASSISTANT_MESSAGE]);
    }
  }, [focusAssignmentId, focusSubmissionId, selectedId, setSelectedId, submissions]);

  const selected = submissions.find((submission) => submission.gradeId === selectedId);
  const gradeBreakdown = selected?.breakdown;
  const strongestComponents = [...(gradeBreakdown?.components ?? [])]
    .sort((left, right) => right.score - left.score)
    .slice(0, 2);
  const primaryStrength = strongestComponents[0];
  const priorityImprovementAreas = gradeBreakdown?.improvementAreas.slice(0, 2) ?? [];
  const readiness = getExplainGradeReadiness({
    assignmentLabel: selected?.label ?? null,
    band: gradeBreakdown?.band ?? "current",
    strongestArea: primaryStrength?.name ?? null,
    topImprovementArea: gradeBreakdown?.improvementAreas[0]
      ? {
          area: gradeBreakdown.improvementAreas[0].area,
          nextBand: gradeBreakdown.improvementAreas[0].nextBand,
          pointsNeeded: gradeBreakdown.improvementAreas[0].pointsNeeded,
        }
      : null,
  });

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
          apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          submissionId: selected.submissionId,
          messages: updatedMessages.map((message) => ({ role: message.role, content: message.content })),
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
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Released submissions</p>
            <Select
              value={selectedId}
              onValueChange={(value) => {
                setSelectedId(value);
                setMessages([INITIAL_ASSISTANT_MESSAGE]);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a submission" />
              </SelectTrigger>
              <SelectContent>
                {submissions.map((submission) => (
                  <SelectItem key={submission.gradeId} value={submission.gradeId} textValue={submission.label}>
                    <span className="flex flex-col">
                      <span>{submission.label}</span>
                      {submission.secondaryLabel ? (
                        <span className="text-xs text-muted-foreground">{submission.secondaryLabel}</span>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {(focusSource === "notification" || focusSource === "email") && (focusAssignmentId || focusSubmissionId) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">Opened from released-grade notification</p>
              <p className="text-xs text-muted-foreground">
                This view is focused on the released result linked from your {focusSource === "email" ? "email" : "notification"}.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchParams({}, { replace: true });
              }}
            >
              Show all released grades
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="grid gap-4 p-6 md:grid-cols-3">
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reporting Readiness</p>
            <p className="mt-2 text-sm font-semibold">{readiness.postureLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Based on the released breakdown, band, and strongest improvement route for this result.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely challenge</p>
            <p className="mt-2 text-sm font-semibold">{readiness.likelyChallenge}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This is the released-result question most likely to matter before your next submission.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next action</p>
            <p className="mt-2 text-sm font-semibold">{readiness.bestNextAction}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use this to decide what to carry into the next piece of work before asking deeper follow-up questions.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Released Result Summary</CardTitle>
          </div>
          <CardDescription>{selected?.secondaryLabel || "Released grade context for this submission."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-4xl font-bold font-display">{gradeBreakdown.totalGrade}%</span>
            <Badge>{gradeBreakdown.band}</Badge>
            <Badge variant="outline">Released grade</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Strongest Areas</p>
              <div className="mt-2 space-y-1">
                {strongestComponents.map((component) => (
                  <p key={component.name} className="text-sm">
                    {component.name} <span className="text-muted-foreground">({component.score}%)</span>
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best Improvement Route</p>
              {gradeBreakdown.improvementAreas[0] ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium">{gradeBreakdown.improvementAreas[0].area}</p>
                  <p className="text-xs text-muted-foreground">
                    +{gradeBreakdown.improvementAreas[0].pointsNeeded} points to move toward {gradeBreakdown.improvementAreas[0].nextBand}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No major weak area stands out from this released breakdown.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Grade Breakdown</CardTitle>
          </div>
          <CardDescription>{gradeBreakdown.assessment}</CardDescription>
        </CardHeader>
        <CardContent>
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
                      getScoreTone(component.score) === "success"
                        ? "bg-success"
                        : getScoreTone(component.score) === "primary"
                          ? "bg-primary"
                          : "bg-destructive"
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
          <CardTitle className="text-base">Next Submission Action Plan</CardTitle>
          <CardDescription>Turn this released result into a short, specific plan for the next piece of work.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Keep This Strength</p>
            <p className="mt-2 text-sm font-medium">
              {primaryStrength
                ? `${primaryStrength.name} is already one of your strongest criteria. Keep its current standard while you improve weaker areas.`
                : "Carry your strongest habits forward into the next submission."}
            </p>
          </div>

          {priorityImprovementAreas.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {priorityImprovementAreas.map((area) => (
                <div key={area.area} className="rounded-xl border p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority Focus</p>
                  <p className="mt-2 text-sm font-semibold">{area.area}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aim for roughly +{area.pointsNeeded} points to move toward {area.nextBand}.
                  </p>
                  <div className="mt-3 space-y-2">
                    {area.tips.slice(0, 2).map((tip) => (
                      <div key={tip} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {tip}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">
                This released breakdown does not show a major weak criterion, so focus on consistency across the whole rubric.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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
