import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAssignmentDetailViewState } from "@/pages/dashboard/assignment-detail/state/useAssignmentDetailViewState";
import type { AssignmentDetailAssignment, AssignmentDetailSubmission, Grade } from "@/pages/dashboard/assignment-detail/types";
import type { AcademicIntegrityFlag } from "@/types/academic";

const createAssignment = (): AssignmentDetailAssignment => ({
  id: "assignment-1",
  title: "Essay 1",
  description: "Write an essay",
  module_code: "LAW101",
  max_score: 100,
  due_date: "2026-05-01",
  status: "published",
  lecturer_id: "lecturer-1",
  rubric: null,
});

const createSubmission = (overrides: Partial<AssignmentDetailSubmission> = {}): AssignmentDetailSubmission => ({
  id: "submission-1",
  assignment_id: "assignment-1",
  student_name: "Ada Ibrahim",
  student_email: "ada@example.edu",
  file_name: "ada-essay.pdf",
  file_type: "application/pdf",
  file_url: "submissions/ada-essay.pdf",
  status: "submitted",
  submitted_at: "2026-04-21T10:00:00Z",
  student_id: "student-1",
  ...overrides,
});

const createGrade = (): Grade => ({
  id: "grade-1",
  submission_id: "submission-1",
  ai_score: 74,
  ai_feedback: "AI feedback",
  ai_breakdown: null,
  assignment_type: null,
  grade_source: "ai",
  source_metadata: null,
  grading_confidence: 0.8,
  grading_metadata: null,
  lecturer_score: 76,
  lecturer_feedback: "Lecturer feedback",
  final_score: 76,
  final_feedback: "Final feedback",
});

const createFlag = (overrides: Partial<AcademicIntegrityFlag> = {}): AcademicIntegrityFlag =>
  ({
    submission_a_id: "submission-1",
    submission_b_id: "submission-2",
    student_a: "Ada Ibrahim",
    student_b: "Ben Carter",
    similarity_score: 82,
    ai_suspicion_score: 88,
    baseline_deviation_score: 10,
    total_risk_score: 90,
    reason: "High similarity signal",
    severity: "high",
    integrity_type: "mixed",
    recommended_action: "investigate",
    overlap_analysis: {
      total_overlap: 82,
      cited_overlap: 12,
      uncited_overlap: 31,
      internal_peer_overlap: 15,
      external_source_overlap: 8,
    },
    ...overrides,
  }) as AcademicIntegrityFlag;

describe("useAssignmentDetailViewState coverage", () => {
  it("shows, dismisses, and restores the integrity card when the signal set changes", () => {
    const assignment = createAssignment();
    const submissions = [createSubmission()];
    const grades = {
      "submission-1": createGrade(),
    };
    const navigate = vi.fn();

    const { result, rerender } = renderHook(
      ({ flags, summary }) =>
        useAssignmentDetailViewState({
          assignment,
          currentUserEmail: "lecturer@example.com",
          currentUserId: "lecturer-1",
          currentUserInstitutionId: "institution-1",
          grades,
          navigate,
          plagiarismFlags: flags,
          plagiarismSummary: summary,
          role: "lecturer",
          search: "?source=queue&focus=manual-review",
          submissions,
        }),
      {
        initialProps: {
          flags: [createFlag()],
          summary: "Flags detected",
        },
      },
    );

    expect(result.current.integrityCard.shouldShowCard).toBe(true);
    expect(result.current.visiblePlagiarismFlags).toHaveLength(1);

    act(() => {
      result.current.onClearIntegrityCard();
    });

    expect(result.current.integrityCard.shouldShowCard).toBe(false);

    rerender({
      flags: [createFlag({ total_risk_score: 91, similarity_score: 84 })],
      summary: "Flags detected",
    });

    expect(result.current.integrityCard.shouldShowCard).toBe(true);
    expect(result.current.visiblePlagiarismSummary).toContain("urgent lecturer investigation");
    expect(result.current.workflowReadiness.postureLabel).toBeDefined();
  });

  it("handles empty integrity signals without showing the card", () => {
    const { result } = renderHook(() =>
      useAssignmentDetailViewState({
        assignment: createAssignment(),
        currentUserEmail: "lecturer@example.com",
        currentUserId: "lecturer-1",
        currentUserInstitutionId: "institution-1",
        grades: {},
        navigate: vi.fn(),
        plagiarismFlags: [],
        plagiarismSummary: "",
        role: "lecturer",
        search: "",
        submissions: [createSubmission()],
      }),
    );

    expect(result.current.integrityCard.shouldShowCard).toBe(false);
    expect(result.current.visiblePlagiarismFlags).toHaveLength(0);
    expect(result.current.visiblePlagiarismSummary).toBe("");
  });
});
