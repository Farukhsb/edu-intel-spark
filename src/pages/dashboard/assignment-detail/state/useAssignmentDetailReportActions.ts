import type { NavigateFunction } from "react-router-dom";
import { toast } from "sonner";

import { safeFormatDate } from "@/lib/date";
import { formatSubmissionStatus } from "@/lib/moderation";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailSubmission,
  Grade,
} from "@/pages/dashboard/assignment-detail/types";

const formatStatusLabel = (status: string) => formatSubmissionStatus(status);

interface UseAssignmentDetailReportActionsArgs {
  assignment: AssignmentDetailAssignment | null;
  grades: Record<string, Grade>;
  navigate: NavigateFunction;
  submissions: AssignmentDetailSubmission[];
}

interface UseAssignmentDetailReportActionsResult {
  exportReviewedReports: () => void;
  openReleasedResult: (submission: AssignmentDetailSubmission) => void;
}

export const useAssignmentDetailReportActions = ({
  assignment,
  grades,
  navigate,
  submissions,
}: UseAssignmentDetailReportActionsArgs): UseAssignmentDetailReportActionsResult => {
  const openReleasedResult = (submission: AssignmentDetailSubmission) => {
    navigate(
      `/dashboard?assignment=${encodeURIComponent(submission.assignment_id)}&submission=${encodeURIComponent(submission.id)}&source=assignment-detail`,
    );
  };

  const exportReviewedReports = () => {
    const reviewedSubmissions = submissions.filter((submission) => {
      const grade = grades[submission.id];
      return (
        grade &&
        (grade.final_score != null || grade.lecturer_score != null || grade.ai_score != null)
      );
    });

    if (reviewedSubmissions.length === 0) {
      toast.error("No reviewed submissions available to export");
      return;
    }

    const rows = [
      ["Student", "Email", "File", "Status", "Score", "Feedback", "Submitted"],
      ...reviewedSubmissions.map((submission) => {
        const grade = grades[submission.id];
        const score = grade?.final_score ?? grade?.lecturer_score ?? grade?.ai_score ?? "";
        const feedback =
          grade?.final_feedback ?? grade?.lecturer_feedback ?? grade?.ai_feedback ?? "";

        return [
          submission.student_name || "Student",
          submission.student_email || "",
          submission.file_name,
          formatStatusLabel(submission.status),
          String(score),
          `"${String(feedback).replace(/"/g, '""')}"`,
          safeFormatDate(submission.submitted_at, "MMM d, yyyy HH:mm"),
        ];
      }),
    ];

    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${assignment?.title || "assignment"}-reviewed-reports.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return {
    exportReviewedReports,
    openReleasedResult,
  };
};
