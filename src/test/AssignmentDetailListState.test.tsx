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

  it("preserves a lecturer's manual selection changes after queue-focused submissions reload", () => {
    const initialSubmissions = [
      buildSubmission("review-1", "under_review"),
      buildSubmission("review-2", "under_review"),
      buildSubmission("submitted-1", "submitted"),
    ];

    const { result, rerender } = renderHook(
      ({ submissions }) =>
        useAssignmentDetailListState({
          role: "lecturer",
          search: "?source=queue&focus=manual-review",
          submissions,
        }),
      {
        initialProps: {
          submissions: initialSubmissions,
        },
      },
    );

    expect(Array.from(result.current.selected)).toEqual(["review-1", "review-2"]);

    act(() => {
      result.current.toggleSelect("review-2");
    });

    expect(Array.from(result.current.selected)).toEqual(["review-1"]);

    rerender({
      submissions: [
        { ...initialSubmissions[0], status: "ai_grading" },
        initialSubmissions[1],
        initialSubmissions[2],
      ],
    });

    expect(Array.from(result.current.selected)).toEqual(["review-1"]);
  });

  it("keeps intentionally selected visible grading rows in the filtered list while status is ai_grading", () => {
    const submissions = [
      buildSubmission("submitted-1", "ai_grading"),
      buildSubmission("submitted-2", "submitted"),
    ];

    const { result } = renderHook(() =>
      useAssignmentDetailListState({
        pinnedVisibleSubmissionIds: ["submitted-1"],
        role: "lecturer",
        search: "",
        submissions,
      }),
    );

    act(() => {
      result.current.setStatusFilter("submitted");
    });

    expect(result.current.filteredSubmissions.map((submission) => submission.id)).toEqual([
      "submitted-1",
      "submitted-2",
    ]);
  });

  it("keeps select-all behavior scoped to visible submissions", () => {
    const submissions = [
      buildSubmission("submitted-1", "submitted"),
      buildSubmission("submitted-2", "submitted"),
      buildSubmission("review-1", "first_review"),
    ];

    const { result } = renderHook(() =>
      useAssignmentDetailListState({
        role: "lecturer",
        search: "",
        submissions,
      }),
    );

    act(() => {
      result.current.setStatusFilter("submitted");
    });

    act(() => {
      result.current.toggleAll();
    });

    expect(Array.from(result.current.selected)).toEqual(["submitted-1", "submitted-2"]);
  });
});
