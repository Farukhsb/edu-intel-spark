import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { safeToLocaleDate } from "@/lib/date";
import { log } from "@/lib/logger";
import { fetchStudentGradeProjection } from "@/lib/studentGradeProjection";
import { getStudentGradeReadiness } from "@/lib/studentGradeReadiness";
import { getFirstName } from "@/lib/formatters";
import { clampPercentage, getGradeBadgeVariant, getGradeTone, normalizeMaxScore } from "@/lib/gradePresentation";
import { DashboardEmptyState, DashboardErrorState, DashboardLoadingState } from "@/components/dashboard/PageStates";
import {
  DEMO_STUDENT_ASSIGNMENTS,
  DEMO_STUDENT_ASSIGNMENT_GRADES,
  DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS,
} from "@/pages/dashboard/demoAssignments";

interface StudentGrade {
  id: string;
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
  fileUrl: string | null;
}

const PASS_MARK_PERCENT = 40;

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

const getBreakdownInsights = (
  breakdown: Array<{
    criterion: string;
    score: number;
    max_score: number;
    feedback?: string;
    comment?: string;
  }> | null,
) => {
  if (!breakdown || breakdown.length === 0) {
    return {
      strongest: [] as Array<{ criterion: string; percent: number }>,
      focusAreas: [] as Array<{ criterion: string; percent: number }>,
    };
  }

  const normalized = breakdown.map((item) => ({
    criterion: item.criterion,
    percent: clampPercentage(item.score, item.max_score),
  }));

  return {
    strongest: [...normalized].sort((left, right) => right.percent - left.percent).slice(0, 2),
    focusAreas: [...normalized].sort((left, right) => left.percent - right.percent).slice(0, 2),
  };
};

const getScoreSummary = (score: number, maxScore: number) => {
  const passMark = Math.round((maxScore * PASS_MARK_PERCENT) / 100);
  const margin = score - passMark;

  if (margin >= 0) {
    return {
      headline: `You scored ${score} out of ${maxScore}.`,
      context:
        margin === 0
          ? `You are exactly on the pass mark of ${passMark}.`
          : `That is ${margin} mark${margin === 1 ? "" : "s"} above the pass mark of ${passMark}.`,
    };
  }

  const gap = Math.abs(margin);
  return {
    headline: `You scored ${score} out of ${maxScore}.`,
    context: `That is ${gap} mark${gap === 1 ? "" : "s"} below the pass mark of ${passMark}.`,
  };
};

const getScoreFollowUp = (score: number, maxScore: number) => {
  const passMark = Math.round((maxScore * PASS_MARK_PERCENT) / 100);
  return score >= passMark ? "Good work on this one." : "Here is what to focus on next.";
};

const getCriterionCommentary = (breakdownItem: {
  feedback?: string;
  comment?: string;
}) => breakdownItem.feedback ?? breakdownItem.comment ?? null;

const DEMO_GRADES: StudentGrade[] = Object.values(DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS)
  .flat()
  .map((submission) => {
    const assignment = DEMO_STUDENT_ASSIGNMENTS.find((entry) => entry.id === submission.assignment_id);
    const grade = DEMO_STUDENT_ASSIGNMENT_GRADES[submission.id];
    const isReleased = submission.status === "released";

    return {
      id: submission.id,
      assignmentTitle: assignment?.title ?? "Assignment title unavailable",
      moduleCode: assignment?.module_code ?? null,
      score: isReleased ? (grade?.final_score ?? grade?.ai_score ?? null) : null,
      maxScore: assignment?.max_score ?? 100,
      feedback: isReleased ? (grade?.final_feedback ?? grade?.ai_feedback ?? null) : null,
      status: submission.status,
      submittedAt: submission.submitted_at,
      breakdown: isReleased ? (grade?.ai_breakdown ?? null) : null,
      fileUrl: submission.file_url ?? null,
    };
  })
  .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime());

const StudentGrades = () => {
  const { user, profile, isDemo } = useAuth();
  const [grades, setGrades] = useState<StudentGrade[]>(isDemo ? DEMO_GRADES : []);
  const [loading, setLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [stats, setStats] = useState({ avg: 0, count: 0, highest: 0, lowest: 0 });

  useEffect(() => {
    if (isDemo) {
      setLoadError(null);
      const scores = DEMO_GRADES.filter((grade) => grade.score != null).map((grade) => grade.score!);
      setStats(calculateGradeStats(scores));
      return;
    }
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchGrades = async () => {
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
            assignmentTitle: row.assignment_title || "Assignment title unavailable",
            moduleCode: row.module_code || null,
            score: isReleased ? (row.final_score ?? row.ai_score ?? null) : null,
            maxScore: row.max_score ?? 100,
            feedback: isReleased ? (row.final_feedback ?? row.ai_feedback ?? null) : null,
            status: row.submission_status,
            submittedAt: row.submitted_at,
            breakdown: isReleased ? (row.ai_breakdown || null) : null,
            fileUrl: row.file_url || null,
          };
        });

        setGrades(studentGrades);

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

  const releasedGrades = grades.filter((grade) => grade.score != null);
  const pendingGrades = grades.filter((grade) => grade.score == null);
  const readiness = getStudentGradeReadiness({
    releasedCount: releasedGrades.length,
    pendingCount: pendingGrades.length,
    latestReleasedAssignmentTitle: releasedGrades[0]?.assignmentTitle ?? null,
    latestPendingStatus: pendingGrades[0]?.status ?? null,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="p-4">
          <p className="text-sm font-medium">Your results, {getFirstName(profile?.full_name)}</p>
          <p className="text-xs text-muted-foreground">
            {pendingGrades.length > 0
              ? `${pendingGrades.length} submission(s) are still being reviewed. Released grades and feedback will appear here as they are ready.`
              : "Your released grades, rubric feedback, and next focus areas are all shown here."}
          </p>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="grid gap-4 p-6 md:grid-cols-3">
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current position</p>
            <p className="mt-2 text-sm font-semibold">{readiness.postureLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Based on what is released already and what is still moving through marking and review.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What to review next</p>
            <p className="mt-2 text-sm font-semibold">{readiness.likelyChallenge}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This is the result state most likely to matter before your next submission.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next step</p>
            <p className="mt-2 text-sm font-semibold">{readiness.bestNextAction}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use this to decide whether to review a released result now or check back later.
            </p>
          </div>
        </CardContent>
      </Card>

      {releasedGrades.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold font-display">{stats.avg}</p>
              <p className="text-xs text-muted-foreground">Average Score</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold font-display">{stats.count}</p>
              <p className="text-xs text-muted-foreground">Graded</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold font-display text-success">{stats.highest}</p>
              <p className="text-xs text-muted-foreground">Highest</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold font-display text-destructive">{stats.lowest}</p>
              <p className="text-xs text-muted-foreground">Lowest</p>
            </CardContent>
          </Card>
        </div>
      )}

      {grades.length > 0 && releasedGrades.length === 0 && (
        <DashboardEmptyState
          title="Your results are on the way"
          description="Your grades and feedback will appear here once your lecturer has finished reviewing and releasing them."
        />
      )}

      {grades.length === 0 ? (
        <DashboardEmptyState
          title="No submissions yet"
          description="Head to Assignments to submit your work."
        />
      ) : (
        <div className="space-y-3">
          {grades.map((grade) => (
            <Card key={grade.id}>
              <CardContent className="space-y-3 p-4">
                {(() => {
                  const gradePercent = grade.score != null ? clampPercentage(grade.score, grade.maxScore) : 0;
                  const normalizedMaxScore = normalizeMaxScore(grade.maxScore);

                  return (
                    <>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{grade.assignmentTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {grade.moduleCode && `${grade.moduleCode} - `}
                            {safeToLocaleDate(grade.submittedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {grade.score != null ? (
                            <>
                              <span className="text-xl font-bold font-display">
                                {grade.score}/{normalizedMaxScore}
                              </span>
                              <Badge
                                variant={getGradeBadgeVariant(grade.score, normalizedMaxScore)}
                              >
                                {gradePercent}%
                              </Badge>
                              <Badge variant="outline">Released</Badge>
                            </>
                          ) : (
                            <Badge variant="outline" className="capitalize">
                              {grade.status.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {grade.score != null && (
                        <>
                          <div className="rounded-xl border bg-background p-4">
                            <p className="text-base font-semibold">
                              {getScoreSummary(grade.score, normalizedMaxScore).headline}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {getScoreSummary(grade.score, normalizedMaxScore).context}
                            </p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {getScoreFollowUp(grade.score, normalizedMaxScore)}
                            </p>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full ${
                                  getGradeTone(grade.score, normalizedMaxScore) === "success"
                                    ? "bg-success"
                                    : getGradeTone(grade.score, normalizedMaxScore) === "primary"
                                      ? "bg-primary"
                                      : "bg-destructive"
                                }`}
                                style={{ width: `${gradePercent}%` }}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Submission status: {grade.status.replace(/_/g, " ")}</span>
                  {grade.score != null && <span>Feedback visible to student</span>}
                </div>
                {grade.breakdown && Array.isArray(grade.breakdown) && grade.breakdown.length > 0 && (
                  <>
                    <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Rubric Breakdown
                      </p>
                      <div className="space-y-2">
                        {grade.breakdown.map((breakdownItem, index) => {
                          const percent = clampPercentage(breakdownItem.score, breakdownItem.max_score);
                          const normalizedBreakdownMaxScore = normalizeMaxScore(breakdownItem.max_score);
                          const commentary = getCriterionCommentary(breakdownItem);
                          return (
                            <div key={index} className="space-y-2 rounded-lg border bg-background p-3">
                              <div className="flex items-center justify-between gap-3 text-xs">
                                <span className="font-medium text-foreground">{breakdownItem.criterion}</span>
                                <span className="font-medium">
                                  {breakdownItem.score}/{normalizedBreakdownMaxScore} ({percent}%)
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full ${
                                    percent >= 70 ? "bg-success" : percent >= 50 ? "bg-primary" : "bg-destructive"
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
                    </div>
                    {(() => {
                      const insights = getBreakdownInsights(grade.breakdown);
                      return (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border bg-background p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Strongest Areas
                            </p>
                            <div className="mt-2 space-y-1">
                              {insights.strongest.map((item) => (
                                <p key={item.criterion} className="text-sm">
                                  {item.criterion} <span className="text-muted-foreground">({item.percent}%)</span>
                                </p>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-xl border bg-background p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Areas To Work On
                            </p>
                            <div className="mt-2 space-y-1">
                              {insights.focusAreas.map((item) => (
                                <p key={item.criterion} className="text-sm">
                                  {item.criterion} <span className="text-muted-foreground">({item.percent}%)</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
                {grade.feedback && (
                  <div className="rounded-xl border bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Lecturer Feedback
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{grade.feedback}</p>
                  </div>
                )}
                {grade.fileUrl && grade.score != null && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={async () => {
                      const { data, error } = await supabase.storage
                        .from("submissions")
                        .createSignedUrl(grade.fileUrl!, 3600);
                      if (error) {
                        log.error("Failed to create student submission download URL", error, {
                          submissionId: grade.id,
                        });
                        toast.error("Download unavailable", {
                          description: "Your submission could not be opened right now. Please try again later.",
                        });
                        return;
                      }
                      if (data?.signedUrl) {
                        window.open(data.signedUrl, "_blank");
                        return;
                      }
                      toast.error("Download unavailable", {
                        description: "The file link could not be created.",
                      });
                    }}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download Submission
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentGrades;
