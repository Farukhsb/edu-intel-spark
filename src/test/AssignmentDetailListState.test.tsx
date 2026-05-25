import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAssignmentDetailListState } from "@/pages/dashboard/assignment-detail/state/useAssignmentDetailListState";
import type { AssignmentDetailSubmission } from "@/pages/dashboard/assignment-detail/types";

const submissions: AssignmentDetailSubmission[] = [
  {
    id: "submission-1",
    assignment_id: "assignment-1",
    student_name: "Amina Hassan",
    student_email: "amina@example.com",
    file_name: "essay.pdf",
    file_type: "application/pdf",
    file_url: "bucket/essay.pdf",
    status: "submitted",
    submitted_at: "2026-05-25T10:00:00.000Z",
    student_id: "student-1",
  },
  {
    id: "submission-2",
    assignment_id: "assignment-1",
    student_name: "Kwame Mensah",
    student_email: "kwame@example.com",
    file_name: "report.pdf",
    file_type: "application/pdf",
    file_url: "bucket/report.pdf",
    status: "under_review",
    submitted_at: "2026-05-25T10:10:00.000Z",
    student_id: "student-2",
  },
];

describe("useAssignmentDetailListState", () => {
  it("lets a manual all-status filter override hidden notification focus narrowing", () => {
    const { result } = renderHook(() =>
      useAssignmentDetailListState({
        role: "lecturer",
        search: "?source=notification&focus=submission-review",
        submissions,
      }),
    );

    expect(result.current.statusFilter).toBe("submitted");
    expect(result.current.filteredSubmissions.map((submission) => submission.id)).toEqual([
      "submission-1",
    ]);

    act(() => {
      result.current.setStatusFilter("all");
    });

    expect(result.current.statusFilter).toBe("all");
    expect(result.current.filteredSubmissions.map((submission) => submission.id)).toEqual([
      "submission-1",
      "submission-2",
    ]);
  });

  it("selects all visible submissions after the manual filter override", () => {
    const { result } = renderHook(() =>
      useAssignmentDetailListState({
        role: "lecturer",
        search: "?source=notification&focus=submission-review",
        submissions,
      }),
    );

    act(() => {
      result.current.setStatusFilter("all");
    });

    act(() => {
      result.current.toggleAll();
    });

    expect(Array.from(result.current.selected)).toEqual(["submission-1", "submission-2"]);
  });
});
