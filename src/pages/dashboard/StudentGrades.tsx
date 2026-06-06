import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { log } from "@/lib/logger";
import { fetchStudentGradeProjection } from "@/lib/studentGradeProjection";
import { getStudentGradeReadiness } from "@/lib/studentGradeReadiness";
import { getFirstName } from "@/lib/formatters";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingState,
  DashboardLiveBanner,
} from "@/components/dashboard/PageStates";
import { parseExplainGradeSearchState } from "@/lib/schemas/navigation";
import { logAcademicAccessEvent } from "@/lib/audit/academicAccessEvents";
import { buildSubmissionOptionsFromProjection, type SubmissionOption } from "@/pages/dashboard/explain-grade/helpers";
import { GradeBreakdown } from "@/components/dashboard/GradeBreakdown";
import { GradeChat } from "@/components/dashboard/GradeChat";

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

const StudentGrades = () => {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [releasedResults, setReleasedResults] = useState<SubmissionOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [stats, setStats] = useState({ avg: 0, count: 0, highest: 0, lowest: 0 });
  const [downloadErrorBySubmission, setDownloadErrorBySubmission] = useState<Record<string, string>>({});
  const lastLoggedGradeDetailsRef = useRef<string | null>(null);
  const {
    assignmentId: focusAssignmentId,
    submissionId: focusSubmissionId,
    source: focusSource,
    ltiResourceLinkId,
  } =
    parseExplainGradeSearchState(searchParams);

  useEffect(() => {
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
  }, [user, reloadKey]);

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
        : undefined) ??
      (ltiResourceLinkId
        ? releasedResults.find(
            (submission) =>
              submission.assignmentId === ltiResourceLinkId || submission.submissionId === ltiResourceLinkId,
          )
        : undefined);

    if (focusedSubmission && focusedSubmission.gradeId !== selectedId) {
      setSelectedId(focusedSubmission.gradeId);
    } else if (!selectedId) {
      setSelectedId(releasedResults[0].gradeId);
    }
  }, [focusAssignmentId, focusSubmissionId, releasedResults, selectedId]);

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
  const primaryStrengthName = [...(gradeBreakdown?.components ?? [])].sort((left, right) => right.score - left.score)[0]
    ?.name ?? null;
  const selectedDownloadError = selectedGrade ? downloadErrorBySubmission[selectedGrade.id] ?? null : null;

  useEffect(() => {
    if (!user || !selectedRelease) {
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
      institutionId: profile?.institution_id ?? null,
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
  }, [focusSource, selectedRelease, user]);

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
      {ltiResourceLinkId ? <DashboardLiveBanner label="Launched from your LMS." /> : null}
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
          <GradeBreakdown
            assessment={gradeBreakdown.assessment}
            totalGrade={gradeBreakdown.totalGrade}
            band={gradeBreakdown.band}
            components={gradeBreakdown.components}
            improvementAreas={gradeBreakdown.improvementAreas}
            readinessBestNextAction={readiness.bestNextAction}
            primaryStrengthName={primaryStrengthName}
            selectedGrade={selectedGrade}
            selectedDownloadError={selectedDownloadError}
            onDownloadSubmission={() => void handleDownloadSubmission()}
          />

          <GradeChat
            key={selectedRelease.submissionId}
            submissionId={selectedRelease.submissionId}
            gradeBreakdown={gradeBreakdown}
          />
        </>
      ) : null}
    </div>
  );
};

export default StudentGrades;
