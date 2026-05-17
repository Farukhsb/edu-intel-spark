import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SubmissionReviewDialog } from "@/pages/dashboard/assignment-detail/ui/review-dialog";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "lecturer-1" },
    profile: { role: "lecturer" },
    isDemo: false,
  }),
}));

describe("SubmissionReviewDialog", () => {
  it("shows manual review messaging when no AI draft exists", () => {
    render(
      <SubmissionReviewDialog
        assignmentMaxScore={100}
        editFeedback=""
        editScore=""
        grade={{
          id: "grade-1",
          submission_id: "submission-1",
          ai_score: null,
          ai_feedback: null,
          ai_breakdown: null,
          assignment_type: "manual_review",
          grading_confidence: null,
          grading_metadata: null,
          lecturer_score: null,
          lecturer_feedback: null,
          final_score: null,
          final_feedback: null,
        }}
        isDemo={false}
        onEditFeedbackChange={vi.fn()}
        onEditScoreChange={vi.fn()}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        open
        reviewSubmission={{
          id: "submission-1",
          assignment_id: "assignment-1",
          student_name: "Amina Hassan",
          student_email: "amina@example.com",
          file_name: "essay.pdf",
          file_type: "application/pdf",
          file_url: "https://example.com/essay.pdf",
          status: "under_review",
          submitted_at: "2026-05-10T10:00:00.000Z",
          student_id: "student-1",
        }}
      />,
    );

    expect(screen.getByText("Manual review mode")).toBeInTheDocument();
    expect(screen.getByText("No AI draft score")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No AI feedback is available for this submission. Enter your own score and feedback below to continue with manual review.",
      ),
    ).toBeInTheDocument();
  });
});
