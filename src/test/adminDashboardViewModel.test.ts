import { describe, expect, it } from "vitest";

import { buildAdminDashboardViewModel } from "@/pages/dashboard/admin-dashboard/controllers/viewModel";
import type { AdminDashboardState, AdminView } from "@/pages/dashboard/admin-dashboard/types";

const createState = (activeView: AdminView): AdminDashboardState => ({
  loading: false,
  refreshing: true,
  loadError: null,
  metrics: {
    totalUsers: 3,
    activeLecturers: 1,
    activeStudents: 1,
    totalAssignments: 2,
    totalSubmissions: 4,
    pendingModerationCases: 1,
    aiGradingFailures: 2,
    highIntegrityRiskCases: 1,
  },
  healthItems: [
    {
      label: "Dashboard database read",
      statusLabel: "Read snapshot succeeded",
      tone: "healthy",
      detail: "Profiles, assignments, and submissions were readable in the latest admin snapshot.",
      signalType: "live",
    },
  ],
  failureCards: [
    {
      title: "Grading failures today",
      value: "2",
      tone: "warning",
      detail: "Two grading failures were recorded today.",
      action: "Review failed grading events",
      signalType: "live",
    },
  ],
  alertCards: [
    {
      title: "Stale grading heartbeat",
      value: "1",
      threshold: "No grade-submission run within 24 hours",
      tone: "warning",
      detail: "The latest visible grade-submission run is older than the 24 hour threshold.",
      action: "Inspect the latest grade-submission runs",
      signalType: "live",
    },
  ],
  users: [
    {
      id: "lecturer-1",
      fullName: "Dr Ada Lecturer",
      email: "lecturer@gradeai.test",
      role: "lecturer",
      departmentName: "Computer Science",
      cohortId: null,
      mustChangePassword: false,
      createdAt: "2026-05-01T10:00:00.000Z",
    },
    {
      id: "student-1",
      fullName: "Sam Student",
      email: "student@gradeai.test",
      role: "student",
      departmentName: "Economics",
      cohortId: "year1",
      mustChangePassword: true,
      createdAt: "2026-05-02T10:00:00.000Z",
    },
  ],
  assignments: [
    {
      id: "assignment-1",
      title: "Algorithms Essay",
      moduleCode: "CS101",
      lecturerName: "Dr Ada Lecturer",
      status: "published",
      dueDate: null,
      createdAt: "2026-05-01T10:00:00.000Z",
      submissionCount: 2,
      gradedCount: 1,
      releasedCount: 1,
    },
  ],
  submissions: [
    {
      id: "submission-1",
      assignmentId: "assignment-1",
      assignmentTitle: "Algorithms Essay",
      studentLabel: "Sam Student",
      status: "released",
      submittedAt: "2026-05-02T10:00:00.000Z",
      fileName: "essay.pdf",
    },
  ],
  moderationRows: [
    {
      id: "moderation-1",
      assignmentTitle: "Algorithms Essay",
      firstMarkerName: "Dr Ada Lecturer",
      moderatorName: "Moderator One",
      status: "approved",
      integrityRiskScore: 82,
      confidenceScore: 61,
      createdAt: "2026-05-02T10:00:00.000Z",
      updatedAt: "2026-05-03T10:00:00.000Z",
      triggerSummary: "High similarity detected",
      disagreement: false,
    },
  ],
  auditRows: [
    {
      id: "audit-1",
      createdAt: "2026-05-03T10:00:00.000Z",
      actorName: "Admin Person",
      action: "role changed",
      target: "Sam Student",
      detail: "student -> lecturer",
      source: "admin",
    },
  ],
  activityFeed: [
    {
      id: "activity-1",
      createdAt: "2026-05-03T11:00:00.000Z",
      title: "Role updated",
      detail: "Sam Student was updated to lecturer.",
      tone: "neutral",
    },
  ],
  dataAccessLogRows: [
    {
      id: "access-1",
      timestamp: "2026-05-03T11:30:00.000Z",
      actor: "Dr Ada Lecturer",
      actorRole: "lecturer",
      action: "moderation evidence viewed",
      resourceType: "moderation_case",
      resourceLabel: "Algorithms Essay",
      outcome: "allowed",
      details: "Opened moderation review dialog",
      source: "academic-access",
    },
  ],
  dataAccessLogStatus: "available",
  integrityOverview: {
    totalReviews: 1,
    flaggedReviews: 1,
    highRiskCases: 1,
    averageSimilarityScore: 78,
    assignmentsWithMostConcerns: [
      {
        assignmentId: "assignment-1",
        assignmentTitle: "Algorithms Essay",
        totalReviews: 1,
        flaggedReviews: 1,
        highRiskCases: 1,
      },
    ],
    recentEvents: [
      {
        id: "review-1",
        reviewedAt: "2026-05-03T09:00:00.000Z",
        assignmentTitle: "Algorithms Essay",
        studentLabel: "Sam Student",
        decision: "investigate",
        riskScore: 82,
        similarityScore: 78,
        flags: ["uncited overlap"],
        latestNote: "Review required",
      },
    ],
    status: "available",
  },
  moderationAuditRows: [
    {
      id: "moderation-audit-1",
      assignmentTitle: "Algorithms Essay",
      studentLabel: "Sam Student",
      assignedModerator: "Moderator One",
      status: "approved",
      decision: "Final score 61",
      historySummary: "Moderator reviewed evidence and approved",
      noteSummary: "Confirmed final outcome",
      createdAt: "2026-05-02T10:00:00.000Z",
      updatedAt: "2026-05-03T10:00:00.000Z",
    },
  ],
  moderationAuditStatus: "available",
  policyExceptionRows: [
    {
      id: "policy-1",
      type: "Late moderation",
      severity: "medium",
      assignmentTitle: "Algorithms Essay",
      studentLabel: "Sam Student",
      status: "open",
      detectedAt: "2026-05-03T12:00:00.000Z",
      details: "Moderation breached expected window.",
    },
  ],
  policyExceptionStatus: "available",
  activeView,
  activeUserFilter: "student",
  visibleUsers: [
    {
      id: "student-1",
      fullName: "Sam Student",
      email: "student@gradeai.test",
      role: "student",
      departmentName: "Economics",
      cohortId: "year1",
      mustChangePassword: true,
      createdAt: "2026-05-02T10:00:00.000Z",
    },
  ],
  pendingRoleChange: {
    userId: "student-1",
    fullName: "Sam Student",
    currentRole: "student",
    nextRole: "lecturer",
  },
  changingUserId: "student-1",
  syncingUserId: "lecturer-1",
  selectedUserPreview: {
    id: "student-1",
    fullName: "Sam Student",
    email: "student@gradeai.test",
    role: "student",
    departmentName: "Economics",
    cohortId: "year1",
    mustChangePassword: true,
    createdAt: "2026-05-02T10:00:00.000Z",
  },
  editingUserProfile: {
    id: "student-1",
    fullName: "Sam Student",
    email: "student@gradeai.test",
    role: "student",
    departmentName: "Economics",
    cohortId: "year1",
    mustChangePassword: true,
    createdAt: "2026-05-02T10:00:00.000Z",
  },
  savingUserProfileId: "student-1",
});

describe("adminDashboardViewModel", () => {
  it("groups raw admin dashboard state into stable view slices", () => {
    const state = createState("overview");
    const viewModel = buildAdminDashboardViewModel(state);

    expect(viewModel.activeView).toBe("overview");
    expect(viewModel.header).toEqual({
      refreshing: true,
      showBulkUpload: true,
    });
    expect(viewModel.overview.metrics).toBe(state.metrics);
    expect(viewModel.overview.users).toBe(state.users);
    expect(viewModel.overview.alertCards).toBe(state.alertCards);
    expect(viewModel.users.users).toBe(state.visibleUsers);
    expect(viewModel.audit.auditRows).toBe(state.auditRows);
    expect(viewModel.dataAccessLog.rows).toBe(state.dataAccessLogRows);
    expect(viewModel.integrityOverview.overview).toBe(state.integrityOverview);
    expect(viewModel.system.failureCards).toBe(state.failureCards);
    expect(viewModel.system.alertCards).toBe(state.alertCards);
    expect(viewModel.dialogs.pendingRoleChange).toBe(state.pendingRoleChange);
    expect(viewModel.dialogs.editingUserProfile).toBe(state.editingUserProfile);
  });

  it("shows bulk upload only for overview and users views", () => {
    expect(buildAdminDashboardViewModel(createState("overview")).header.showBulkUpload).toBe(true);
    expect(buildAdminDashboardViewModel(createState("users")).header.showBulkUpload).toBe(true);
    expect(buildAdminDashboardViewModel(createState("system")).header.showBulkUpload).toBe(false);
    expect(buildAdminDashboardViewModel(createState("assignments")).header.showBulkUpload).toBe(false);
  });
});
