import { describe, expect, it } from "vitest";

import {
  buildAssignmentPublishedNotificationRows,
  buildAssignmentSubmissionStats,
  filterAssignments,
  getAssignmentOverviewStats,
  getLecturerAssignmentCatalogReadiness,
  getStudentAssignmentCatalogReadiness,
  normalizeAssignment,
  sortAssignmentsForView,
} from "@/lib/assignmentCatalog";

describe("assignment catalog helpers", () => {
  const assignments = [
    normalizeAssignment({
      id: "assignment-1",
      title: "Algorithms Coursework",
      description: "Discuss algorithms",
      module_code: "CS101",
      lecturer_id: "lecturer-1",
      max_score: 100,
      due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: "published",
      created_at: "2026-04-20T10:00:00.000Z",
    }),
    normalizeAssignment({
      id: "assignment-2",
      title: "Archived Essay",
      description: "Old work",
      module_code: "ENG201",
      lecturer_id: "lecturer-1",
      max_score: 100,
      due_date: null,
      status: "closed",
      created_at: "2026-04-18T10:00:00.000Z",
    }),
    normalizeAssignment({
      id: "assignment-3",
      title: "Draft Brief",
      description: "Pending publish",
      module_code: "CS301",
      lecturer_id: "lecturer-1",
      max_score: 100,
      due_date: null,
      status: "draft",
      created_at: "2026-04-19T10:00:00.000Z",
    }),
  ];

  it("normalizes notification rows and submission workflow stats", () => {
    const rows = buildAssignmentPublishedNotificationRows({
      senderId: "lecturer-1",
      assignmentId: "assignment-1",
      assignmentTitle: "Algorithms Coursework",
      students: [
        {
          id: "student-1",
          cohort_id: "200",
          department_id: "Computer Science",
          full_name: "Ada Student",
          email: "ada@example.com",
          role: "student",
        },
      ],
    });

    const stats = buildAssignmentSubmissionStats(assignments, [
      { id: "sub-1", assignment_id: "assignment-1", status: "submitted" },
      { id: "sub-2", assignment_id: "assignment-1", status: "ai_graded" },
      { id: "sub-3", assignment_id: "assignment-1", status: "approved" },
      { id: "sub-4", assignment_id: "assignment-1", status: "released" },
    ]);

    expect(rows[0]).toMatchObject({
      sender_id: "lecturer-1",
      recipient_email: "ada@example.com",
      related_assignment_id: "assignment-1",
    });
    expect(stats["assignment-1"]).toEqual({
      total: 4,
      graded: 3,
      approved: 2,
      released: 1,
      needsReview: 2,
    });
  });

  it("filters, sorts, and summarizes assignment overview state for the page", () => {
    const submissionStats = {
      "assignment-1": {
        total: 4,
        graded: 3,
        approved: 2,
        released: 1,
        needsReview: 2,
      },
      "assignment-2": {
        total: 1,
        graded: 1,
        approved: 1,
        released: 1,
        needsReview: 0,
      },
      "assignment-3": {
        total: 0,
        graded: 0,
        approved: 0,
        released: 0,
        needsReview: 0,
      },
    };

    const lecturerView = filterAssignments({
      assignments,
      searchQuery: "",
      statusFilter: "all",
      role: "lecturer",
      isPendingReviewView: false,
      submissionStats,
    });

    const reviewQueue = sortAssignmentsForView({
      assignments: filterAssignments({
        assignments,
        searchQuery: "",
        statusFilter: "all",
        role: "lecturer",
        isPendingReviewView: true,
        submissionStats,
      }),
      isPendingReviewView: true,
      submissionStats,
    });

    const overview = getAssignmentOverviewStats(assignments);

    expect(lecturerView.map((assignment) => assignment.id)).toEqual(["assignment-1", "assignment-3"]);
    expect(reviewQueue.map((assignment) => assignment.id)).toEqual(["assignment-1"]);
    expect(overview).toEqual({
      drafts: 1,
      published: 1,
      dueSoon: 1,
    });
  });

  it("derives lecturer and student assignment readiness summaries", () => {
    const submissionStats = {
      "assignment-1": {
        total: 4,
        graded: 3,
        approved: 2,
        released: 1,
        needsReview: 2,
      },
      "assignment-2": {
        total: 1,
        graded: 1,
        approved: 1,
        released: 1,
        needsReview: 0,
      },
      "assignment-3": {
        total: 0,
        graded: 0,
        approved: 0,
        released: 0,
        needsReview: 0,
      },
    };

    const lecturerReadiness = getLecturerAssignmentCatalogReadiness({
      assignments,
      submissionStats,
    });
    const studentReadiness = getStudentAssignmentCatalogReadiness({
      assignments,
      studentWorkflow: {
        "assignment-1": {
          assignmentId: "assignment-1",
          submissionId: "submission-1",
          status: "released",
          submittedAt: "2026-04-22T10:00:00.000Z",
        },
      },
    });

    expect(lecturerReadiness.postureLabel).toBe("Active marking position");
    expect(lecturerReadiness.likelyChallenge).toBe("Algorithms Coursework has 2 submissions needing review");
    expect(lecturerReadiness.bestNextAction).toBe("Open the review queue and clear grading, approval, or release blockers");

    expect(studentReadiness.postureLabel).toBe("Released result position");
    expect(studentReadiness.likelyChallenge).toBe("Algorithms Coursework has a released result ready to review");
    expect(studentReadiness.bestNextAction).toBe("Open the released result and review the feedback summary");
  });
});
