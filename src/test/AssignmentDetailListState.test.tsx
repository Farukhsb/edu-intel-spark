import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAssignmentDetailListState } from "@/pages/dashboard/assignment-detail/state/useAssignmentDetailListState";
import type { AssignmentDetailSubmission } from "@/pages/dashboard/assignment-detail/types";

const buildSubmission = (
  id: string,
  status: AssignmentDetailSubmission["status"],
): AssignmentDetailSubmission => ({
  id,
  assignment_id: "assignment-1",
  student_id: `student-${id}`,
  student_name: `Student ${id}`,
  student_email: `${id}@example.com`,
  file_name: `${id}.pdf`,
  file_type: "application/pdf",
  file_url: `https://example.com/${id}.pdf`,
  status,
  submitted_at: "2026-05-25T15:00:00.000Z",
});

describe("useAssignmentDetailListState", () => {
  it("lets a manual status filter override notification-focused visibility narrowing", () => {
    const submissions = [
      buildSubmission("submitted-1", "submitted"),
      buildSubmission("review-1", "first_review"),
      buildSubmission("review-2", "first_review"),
    ];

    const { result } = renderHook(() =>
      useAssignmentDetailListState({
        role: "lecturer",
        search: "?source=notification&focus=submission-review",
        submissions,
      }),
    );

    expect(result.current.statusFilter).toBe("submitted");
    expect(result.current.filteredSubmissions.map((submission) => submission.id)).toEqual(["submitted-1"]);

    act(() => {
      result.current.setStatusFilter("all");
    });

    expect(result.current.statusFilter).toBe("all");
    expect(result.current.filteredSubmissions.map((submission) => submission.id)).toEqual([
      "submitted-1",
      "review-1",
      "review-2",
    ]);
  });
});
