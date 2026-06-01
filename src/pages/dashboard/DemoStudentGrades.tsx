import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardDemoBanner, DashboardEmptyState, DashboardErrorState, DashboardLoadingState } from "@/components/dashboard/PageStates";
import { parseExplainGradeSearchState } from "@/lib/schemas/navigation";
import { getFirstName } from "@/lib/formatters";
import { getStudentGradeReadiness } from "@/lib/studentGradeReadiness";
import { buildSubmissionOptionsFromProjection, type SubmissionOption } from "@/pages/dashboard/explain-grade/helpers";
import {
  DEMO_STUDENT_ASSIGNMENTS,
  DEMO_STUDENT_ASSIGNMENT_GRADES,
  DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS,
} from "@/pages/dashboard/demoAssignments";
import { GradeBreakdown } from "@/components/dashboard/GradeBreakdown";
import { DemoGradeChat } from "@/components/dashboard/DemoGradeChat";
import { calculateGradeStats } from "@/pages/dashboard/StudentGrades";

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

const DemoStudentGrades = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [grades] = useState<StudentGrade[]>(DEMO_GRADES);
  const [releasedResults, setReleasedResults] = useState<SubmissionOption[]>(
    buildSubmissionOptionsFromProjection([]),
  );
  const [selectedId, setSelectedId] = useState("");
  const [loading] = useState(false);
  const [loadError] = useState<string | null>(null);
  const [stats] = useState(() => {
    const scores = DEMO_GRADES.filter((grade) => grade.score != null).map((grade) => grade.score!);
    return calculateGradeStats(scores);
  });
  const [downloadErrorBySubmission] = useState<Record<string, string>>({});
  const lastLoggedGradeDetailsRef = useRef<string | null>(null);
  const { assignmentId: focusAssignmentId, submissionId: focusSubmissionId, source: focusSource } =
    parseExplainGradeSearchState(searchParams);

  useEffect(() => {
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
  }, []);

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
    if (!selectedRelease) {
      return;
    }

    const logKey = `${selectedRelease.gradeId}:${selectedRelease.submissionId}`;
    if (lastLoggedGradeDetailsRef.current === logKey) {
      return;
    }

    lastLoggedGradeDetailsRef.current = logKey;
  }, [selectedRelease]);

  const handleDownloadSubmission = async () => {
    toast.info("Demo submissions are read-only.");
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
          <Button variant="outline" onClick={() => undefined}>
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
        <DashboardDemoBanner label="Viewing demo student results" />
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
      <DashboardDemoBanner label="Viewing demo student results" />

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

          <DemoGradeChat key={selectedRelease.submissionId} submissionId={selectedRelease.submissionId} gradeBreakdown={gradeBreakdown} />
        </>
      ) : null}
    </div>
  );
};

export default DemoStudentGrades;
