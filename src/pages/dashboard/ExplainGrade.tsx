import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, ChevronDown, ChevronUp, Send, Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface GradeBreakdown {
  assessment: string;
  totalGrade: number;
  band: string;
  components: { name: string; weight: number; score: number; maxScore: number }[];
  improvementAreas: { area: string; currentBand: string; nextBand: string; pointsNeeded: number; tips: string[] }[];
}

type ChatMsg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explain-grade`;

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
  totalGrade: number;
  breakdown: GradeBreakdown;
}

const ExplainGrade = () => {
  const [submissions, setSubmissions] = useState<SubmissionOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [expandedArea, setExpandedArea] = useState<number | null>(0);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI Grade Assistant. I can help you understand your grades, identify improvement areas, and provide specific guidance on raising your marks. What would you like to know?",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGrades();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchGrades = async () => {
    try {
      // RLS ensures students only see their own submissions/grades
      const { data: subs } = await supabase.from("submissions").select("*");
      const subIds = (subs || []).map(s => s.id);
      const { data: grades } = subIds.length > 0
        ? await supabase.from("grades").select("*").in("submission_id", subIds)
        : { data: [] as any[] };
      const assignmentIds = [...new Set((subs || []).map(s => s.assignment_id))];
      const { data: assignments } = assignmentIds.length > 0
        ? await supabase.from("assignments").select("*").in("id", assignmentIds)
        : { data: [] as any[] };

      if (!grades?.length || !subs?.length) {
        setLoading(false);
        return;
      }

      const subMap = Object.fromEntries((subs || []).map(s => [s.id, s]));
      const assignMap = Object.fromEntries((assignments || []).map(a => [a.id, a]));

      const options: SubmissionOption[] = grades
        .filter(g => (g.ai_score != null || g.final_score != null) && g.ai_breakdown)
        .map(g => {
          const sub = subMap[g.submission_id];
          const assignment = sub ? assignMap[sub.assignment_id] : null;
          const totalGrade = Number(g.final_score ?? g.ai_score ?? 0);
          const breakdown = g.ai_breakdown as any[];
          const totalMax = breakdown?.reduce((s: number, b: any) => s + (b.max_score ?? b.maxScore ?? 10), 0) || 100;

          const components = (breakdown || []).map((b: any) => ({
            name: b.criterion || b.name || "Unknown",
            weight: Math.round(((b.max_score ?? b.maxScore ?? 10) / totalMax) * 100),
            score: Math.round(((b.score ?? 0) / (b.max_score ?? b.maxScore ?? 10)) * 100),
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

          const label = assignment
            ? `${assignment.module_code || ""} ${assignment.title}`.trim()
            : sub?.student_name || sub?.file_name || g.submission_id;

          return {
            gradeId: g.id,
            submissionId: g.submission_id,
            label,
            totalGrade,
            breakdown: {
              assessment: label,
              totalGrade,
              band: getBand(totalGrade),
              components,
              improvementAreas,
            },
          };
        });

      setSubmissions(options);
      if (options.length > 0) setSelectedId(options[0].gradeId);
    } catch (err) {
      console.error("Failed to fetch grades:", err);
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
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          gradeContext: gradeBreakdown,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "AI service error" }));
        toast.error(err.error || "Something went wrong");
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && prev.length === updatedMessages.length + 1) {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
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
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
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
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to get AI response");
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!gradeBreakdown) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No graded submissions found. Grades will appear here once assignments are graded by AI.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {submissions.length > 1 && (
        <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); setMessages([messages[0]]); }}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Select a submission" /></SelectTrigger>
          <SelectContent>
            {submissions.map(s => (
              <SelectItem key={s.gradeId} value={s.gradeId}>
                {s.label} — {s.totalGrade}%
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
            {gradeBreakdown.components.map((c, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{c.name} ({c.weight}%)</span>
                  <span className="font-medium">{c.score}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      c.score >= 70 ? "bg-success" : c.score >= 50 ? "bg-primary" : "bg-destructive"
                    }`}
                    style={{ width: `${c.score}%` }}
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
            {gradeBreakdown.improvementAreas.map((area, i) => (
              <div key={i} className="rounded-lg border p-3">
                <button
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setExpandedArea(expandedArea === i ? null : i)}
                >
                  <div>
                    <span className="text-sm font-medium">{area.area}</span>
                    <p className="text-xs text-muted-foreground">
                      +{area.pointsNeeded} points to reach {area.nextBand}
                    </p>
                  </div>
                  {expandedArea === i ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {expandedArea === i && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {area.tips.map((tip, j) => (
                      <div key={j} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {tip}
                      </div>
                    ))}
                  </div>
                )}
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
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about your grade..."
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
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

export default ExplainGrade;
