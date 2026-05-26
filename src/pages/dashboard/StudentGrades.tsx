import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Brain, Download, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { safeToLocaleDate } from "@/lib/date";
import { log } from "@/lib/logger";
import { fetchStudentGradeProjection } from "@/lib/studentGradeProjection";
import { getStudentGradeReadiness } from "@/lib/studentGradeReadiness";
import { getFirstName } from "@/lib/formatters";
import { clampPercentage, getGradeTone, normalizeMaxScore } from "@/lib/gradePresentation";
import { DashboardDemoBanner, DashboardEmptyState, DashboardErrorState, DashboardLoadingState } from "@/components/dashboard/PageStates";
import { getEnv } from "@/lib/env";
import { parseExplainGradeSearchState } from "@/lib/schemas/navigation";
import { logAcademicAccessEvent } from "@/lib/audit/academicAccessEvents";
import {
  buildDemoGradeResponse,
  buildSubmissionOptionsFromProjection,
  type SubmissionOption,
} from "@/pages/dashboard/explain-grade/helpers";
import {
  DEMO_STUDENT_ASSIGNMENTS,
  DEMO_STUDENT_ASSIGNMENT_GRADES,
  DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS,
} from "@/pages/dashboard/demoAssignments";

interface StudentGrade {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  moduleCode: string | null;
  score: number | null;
  maxScore: number;
  feedback: string | null;
  status: string;
  submittedAt: string;
  breakdown: Array<{
    criterion: string;
    score: number;
    max_score: number;
    feedback?: string;
    comment?: string;
  }> | null;
  fileName: string | null;
  fileUrl: string | null;
}

type ChatMsg = { role: "user" | "assistant"; content: string };

const INITIAL_ASSISTANT_MESSAGE: ChatMsg = {
  role: "assistant",
  content:
    "Hello! I'm your AI Grade Assistant. I can help you understand your grades, identify improvement areas, and provide specific guidance on raising your marks. What would you like to know?",
};

const DEMO_GRADES: StudentGrade[] = Object.values(DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS)
  .flat()
  .map((submission) => {
    const assignment = DEMO_STUDENT_ASSIGNMENTS.find((entry) => entry.id === submission.assignment_id);
    const grade = DEMO_STUDENT_ASSIGNMENT_GRADES[submission.id];
    const isReleased = submission.status === "released";

    return {
      id: submission.id,
      assignmentId: submission.assignment_id,
      assignmentTitle: assignment?.title ?? "Assignment title unavailable",
      moduleCode: assignment?.module_code ?? null,
      score: isReleased ? (grade?.final_score ?? grade?.ai_score ?? null) : null,
      maxScore: assignment?.max_score ?? 100,
      feedback: isReleased ? (grade?.final_feedback ?? grade?.ai_feedback ?? null) : null,
      status: submission.status,
      submittedAt: submission.submitted_at,
      breakdown: isReleased ? (grade?.ai_breakdown ?? null) : null,
      fileName: submission.file_name ?? null,
      fileUrl: submission.file_url ?? null,
    };
  })
  .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime());

export const calculateGradeStats = (scores: number[]) => {
  if (scores.length === 0) {
    return {
      avg: 0,
      count: 0,
      highest: 0,
      lowest: 0,
    };
  }

  return {
    avg: Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 10) / 10,
    count: scores.length,
    highest: Math.max(...scores),
    lowest: Math.min(...scores),
  };
};

const getCriterionCommentary = (breakdownItem: {
  feedback?: string;
  comment?: string;
}) => breakdownItem.feedback ?? breakdownItem.comment ?? null;

const StudentGrades = () => {
  const { user, profile, isDemo } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [grades, setGrades] = useState<StudentGrade[]>(isDemo ? DEMO_GRADES : []);
  const [releasedResults, setReleasedResults] = useState<SubmissionOption[]>(
    isDemo ? buildSubmissionOptionsFromProjection([]) : [],
  );
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [stats, setStats] = useState({ avg: 0, count: 0, highest: 0, lowest: 0 });
  const [messages, setMessages] = useState<ChatMsg[]>([INITIAL_ASSISTANT_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [downloadErrorBySubmission, setDownloadErrorBySubmission] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLoggedGradeDetailsRef = useRef<string | null>(null);
  const { assignmentId: focusAssignmentId, submissionId: focusSubmissionId, source: focusSource } =
    parseExplainGradeSearchState(searchParams);

  useEffect(() => {
    if (isDemo) {
      setLoadError(null);
      const scores = DEMO_GRADES.filter((grade) => grade.score != null).map((grade) => grade.score!);
      setStats(calculateGradeStats(scores));
      const demoReleased = buildSubmissionOptionsFromProjection(
        DEMO_GRADES.filter((grade) => grade.score != null).map((grade) => ({
          submission_id: grade.id,
          assignment_id: grade.assignmentId,
          assignment_title: grade.assignmentTitle,
          module_code: grade.moduleCode,
          max_score: grade.maxScore,
          file_name: grade.fileName ?? "",
          file_url: grade.fileUrl ?? "",
          submission_status: grade.status,
          submitted_at: grade.submittedAt,
          final_score: grade.score,
          ai_score: null,
          final_feedback: grade.feedback,
          ai_feedback: null,
          ai_breakdown: grade.breakdown,
        })),
      );
      setReleasedResults(demoReleased);
      setSelectedId((current) => current || demoReleased[0]?.gradeId || "");
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    const fetchGrades = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const projectionRes = await fetchStudentGradeProjection(user.id);
        if (projectionRes.error) {
          throw projectionRes.error;
        }

        const studentGrades: StudentGrade[] = projectionRes.data.map((row) => {
          const isReleased = row.submission_status === "released";
          return {
            id: row.submission_id,
            assignmentId: row.assignment_id,
            assignmentTitle: row.assignment_title || "Assignment title unavailable",
            moduleCode: row.module_code || null,
            score: isReleased ? (row.final_score ?? row.ai_score ?? null) : null,
            maxScore: row.max_score ?? 100,
            feedback: isReleased ? (row.final_feedback ?? row.ai_feedback ?? null) : null,
            status: row.submission_status,
            submittedAt: row.submitted_at,
            breakdown: isReleased ? (row.ai_breakdown || null) : null,
            fileName: row.file_name || null,
            fileUrl: row.file_url || null,
          };
        });

        const released = buildSubmissionOptionsFromProjection(
          projectionRes.data.filter((row) => row.submission_status === "released"),
        );

        setGrades(studentGrades);
        setReleasedResults(released);
        setSelectedId((current) => current || released[0]?.gradeId || "");

        const releasedScores = studentGrades.filter((grade) => grade.score != null).map((grade) => grade.score!);
        setStats(calculateGradeStats(releasedScores));
      } catch (err) {
        log.error("Failed to fetch student grades", err, {
          userId: user.id,
        });
        setLoadError("Your results could not be loaded right now.");
      }

      setLoading(false);
    };

    void fetchGrades();
  }, [user, isDemo, reloadKey]);

  useEffect(() => {
    if (!releasedResults.length) {
      return;
    }

    const focusedSubmission =
      (focusSubmissionId
        ? releasedResults.find((submission) => submission.submissionId === focusSubmissionId)
        : undefined) ??
      (focusAssignmentId
        ? releasedResults.find((submission) => submission.assignmentId === focusAssignmentId)
        : undefined);

    if (focusedSubmission && focusedSubmission.gradeId !== selectedId) {
      setSelectedId(focusedSubmission.gradeId);
      setMessages([INITIAL_ASSISTANT_MESSAGE]);
    } else if (!selectedId) {
      setSelectedId(releasedResults[0].gradeId);
    }
  }, [focusAssignmentId, focusSubmissionId, releasedResults, selectedId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const releasedGrades = grades.filter((grade) => grade.score != null);
  const pendingGrades = grades.filter((grade) => grade.score == null);
  const selectedRelease = releasedResults.find((submission) => submission.gradeId === selectedId) ?? releasedResults[0];
  const selectedGrade = selectedRelease
    ? releasedGrades.find((grade) => grade.id === selectedRelease.submissionId) ?? null
    : null;
  const gradeBreakdown = selectedRelease?.breakdown ?? null;
  const readiness = getStudentGradeReadiness({
    releasedCount: releasedGrades.length,
    pendingCount: pendingGrades.length,
    latestReleasedAssignmentTitle: releasedGrades[0]?.assignmentTitle ?? null,
    latestPendingStatus: pendingGrades[0]?.status ?? null,
  });
  const primaryStrength = [...(gradeBreakdown?.components ?? [])].sort((left, right) => right.score - left.score)[0];
  const selectedDownloadError = selectedGrade ? downloadErrorBySubmission[selectedGrade.id] ?? null : null;

  useEffect(() => {
    if (isDemo || !user || !selectedRelease) {
      return;
    }

    const logKey = `${selectedRelease.gradeId}:${selectedRelease.submissionId}`;
    if (lastLoggedGradeDetailsRef.current === logKey) {
      return;
    }

    lastLoggedGradeDetailsRef.current = logKey;

    void logAcademicAccessEvent({
      actorId: user.id,
      actorRole: "student",
      eventType: "grade_details_viewed",
      resourceType: "grade",
      resourceId: selectedRelease.gradeId,
      assignmentId: selectedRelease.assignmentId,
      submissionId: selectedRelease.submissionId,
      metadata: {
        source: "student_grades",
        focusSource: focusSource || "direct",
      },
    });
  }, [focusSource, isDemo, selectedRelease, user]);

  const handleSend = async () => {
    if (!inputValue.trim() || isChatLoading || !gradeBreakdown || !selectedRelease) return;

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

    setIsChatLoading(true);
    let assistantSoFar = "";

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Not signed in");
      const env = getEnv();

      const chatUrl = `${env.VITE_SUPABASE_URL}/functions/v1/explain-grade`;
      const response = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          submissionId: selectedRelease.submissionId,
          messages: updatedMessages.map((message) => ({ role: message.role, content: message.content })),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: "AI service error" }));
        toast.error(errorBody.error || "Something went wrong");
        setIsChatLoading(false);
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
      setIsChatLoading(false);
    }
  };

  const handleDownloadSubmission = async () => {
    if (!selectedGrade?.fileUrl) {
      return;
    }

    setDownloadErrorBySubmission((current) => ({
      ...current,
      [selectedGrade.id]: "",
    }));

    const { data, error } = await supabase.storage
      .from("submissions")
      .createSignedUrl(selectedGrade.fileUrl, 3600);

    if (error) {
      log.error("Failed to create student submission download URL", error, {
        submissionId: selectedGrade.id,
      });
      const description = "Your submission file could not be opened right now. Please try again later.";
      setDownloadErrorBySubmission((current) => ({
        ...current,
        [selectedGrade.id]: description,
      }));
      toast.error("Download unavailable", {
        description,
      });
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
      return;
    }

    const description = "The file link could not be created. Please try again later.";
    setDownloadErrorBySubmission((current) => ({
      ...current,
      [selectedGrade.id]: description,
    }));
    toast.error("Download unavailable", {
      description,
    });
  };

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (loadError) {
    return (
      <DashboardErrorState
        title="Results unavailable"
        description={loadError}
        action={
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              setReloadKey((current) => current + 1);
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }

  if (grades.length === 0) {
    return (
      <DashboardEmptyState
        title="No submissions yet"
        description="Head to Assignments to submit your work."
      />
    );
  }

  if (releasedGrades.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        {isDemo && <DashboardDemoBanner label="Viewing demo student results" />}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <CardContent className="p-4">
            <p className="text-sm font-medium">Your results, {getFirstName(profile?.full_name)}</p>
            <p className="text-xs text-muted-foreground">
              {readiness.likelyChallenge}. {readiness.bestNextAction}.
            </p>
          </CardContent>
        </Card>
        <DashboardEmptyState
          title="Your results are on the way"
          description="Your grades and feedback will appear here once your lecturer has finished reviewing and releasing them."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && <DashboardDemoBanner label="Viewing demo student results" />}

      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="space-y-4 p-4">
          <div>
            <p className="text-sm font-medium">Your results, {getFirstName(profile?.full_name)}</p>
            <p className="text-xs text-muted-foreground">
              {pendingGrades.length > 0
                ? `${pendingGrades.length} submission(s) are still being reviewed. Your released feedback and AI guidance are shown below.`
                : "Select a released result, review the rubric breakdown, and ask follow-up questions in one place."}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border bg-background/75 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average score</p>
              <p className="mt-2 text-2xl font-semibold font-display">{stats.avg}</p>
            </div>
            <div className="rounded-lg border bg-background/75 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Released</p>
              <p className="mt-2 text-2xl font-semibold font-display">{stats.count}</p>
            </div>
            <div className="rounded-lg border bg-background/75 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Highest</p>
              <p className="mt-2 text-2xl font-semibold font-display">{stats.highest}</p>
            </div>
            <div className="rounded-lg border bg-background/75 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending</p>
              <p className="mt-2 text-2xl font-semibold font-display">{pendingGrades.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Released results</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the released result you want to review in detail.
            </p>
          </div>
          <Select
            value={selectedRelease?.gradeId ?? ""}
            onValueChange={(value) => {
              setSelectedId(value);
              setMessages([INITIAL_ASSISTANT_MESSAGE]);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a released result" />
            </SelectTrigger>
            <SelectContent>
              {releasedResults.map((submission) => (
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

      {(focusSource === "notification" || focusSource === "email" || focusSource === "assignment-detail") &&
      (focusAssignmentId || focusSubmissionId) ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">Opened from released-grade notification</p>
              <p className="text-xs text-muted-foreground">
                This view is focused on the released result linked from your notification or released-result shortcut.
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
      ) : null}

      {gradeBreakdown && selectedGrade ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Grade Breakdown</CardTitle>
              </div>
              <CardDescription>{gradeBreakdown.assessment}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-4xl font-bold font-display">{gradeBreakdown.totalGrade}%</span>
                <Badge>{gradeBreakdown.band}</Badge>
                <Badge variant="outline">Released grade</Badge>
                {selectedGrade.fileUrl ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => void handleDownloadSubmission()}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download submission
                  </Button>
                ) : null}
              </div>

              {selectedDownloadError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {selectedDownloadError}
                </div>
              ) : null}

              <div className="space-y-3">
                {gradeBreakdown.components.map((component) => {
                  const rawBreakdownItem = selectedGrade.breakdown?.find(
                    (item) => item.criterion === component.name,
                  );
                  const percent =
                    rawBreakdownItem != null
                      ? clampPercentage(rawBreakdownItem.score, rawBreakdownItem.max_score)
                      : component.score;
                  const commentary = rawBreakdownItem ? getCriterionCommentary(rawBreakdownItem) : null;
                  const criterionMax = rawBreakdownItem ? normalizeMaxScore(rawBreakdownItem.max_score) : 100;

                  return (
                    <div key={component.name} className="space-y-2 rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">
                          {component.name} ({component.weight}%)
                        </span>
                        <span className="font-medium">
                          {rawBreakdownItem ? `${rawBreakdownItem.score}/${criterionMax}` : `${component.score}%`} ({percent}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${
                            getGradeTone(percent) === "success"
                              ? "bg-success"
                              : getGradeTone(percent) === "primary"
                                ? "bg-primary"
                                : "bg-destructive"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {commentary ?? "No criterion-level commentary was provided for this part of the rubric."}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Strongest Areas
                  </p>
                  <div className="mt-2 space-y-1">
                    {[...gradeBreakdown.components]
                      .sort((left, right) => right.score - left.score)
                      .slice(0, 2)
                      .map((item) => (
                        <p key={item.name} className="text-sm">
                          {item.name} <span className="text-muted-foreground">({item.score}%)</span>
                        </p>
                      ))}
                  </div>
                </div>
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Focus Areas
                  </p>
                  <div className="mt-2 space-y-1">
                    {[...gradeBreakdown.components]
                      .sort((left, right) => left.score - right.score)
                      .slice(0, 2)
                      .map((item) => (
                        <p key={item.name} className="text-sm">
                          {item.name} <span className="text-muted-foreground">({item.score}%)</span>
                        </p>
                      ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Best Improvement Route</p>
                </div>
                {gradeBreakdown.improvementAreas[0] ? (
                  <>
                    <p className="mt-3 text-sm font-medium">{gradeBreakdown.improvementAreas[0].area}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      +{gradeBreakdown.improvementAreas[0].pointsNeeded} points to move toward {gradeBreakdown.improvementAreas[0].nextBand}
                    </p>
                    <p className="mt-3 text-sm">{readiness.bestNextAction}</p>
                    <div className="mt-3 space-y-2">
                      {gradeBreakdown.improvementAreas[0].tips.slice(0, 3).map((tip) => (
                        <div key={tip} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          {tip}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm">
                    {primaryStrength
                      ? `${primaryStrength.name} is currently your clearest strength. Keep it steady while you improve consistency across the rest of the rubric.`
                      : "No single weak criterion stands out, so focus on improving consistency across the whole rubric."}
                  </p>
                )}
              </div>

              {selectedGrade.feedback ? (
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Lecturer Feedback
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{selectedGrade.feedback}</p>
                </div>
              ) : null}
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
                  {isChatLoading && messages[messages.length - 1]?.role === "user" ? (
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
                    onKeyDown={(event) => event.key === "Enter" && void handleSend()}
                    disabled={isChatLoading}
                  />
                  <Button size="icon" onClick={() => void handleSend()} disabled={isChatLoading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default StudentGrades;
