import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildGradeDistribution,
  formatStatusLabel,
  getRecommendationActionSummary,
  getRecommendationRoute,
  severityVariant,
  statusVariant,
  useCohortAnalyticsController,
} from "@/pages/dashboard/cohort-analytics/useCohortAnalyticsController";
import type { CohortRecommendation } from "@/lib/cohortRecommendations";

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "lecturer-1" },
  },
  navigate: vi.fn(),
  setSearchParams: vi.fn(),
  searchParams: new URLSearchParams("ltiContextId=module-1"),
  fetchCohortAnalyticsDataset: vi.fn(),
  fetchPersistedRecommendations: vi.fn(),
  buildCohortRecommendations: vi.fn(),
  getCohortReportingReadiness: vi.fn(),
  upsertGeneratedRecommendations: vi.fn(),
  mergePersistedRecommendationState: vi.fn((generated) => generated),
  persistRecommendationAction: vi.fn(),
  buildRecommendationInterventionRows: vi.fn(),
  insertRecommendationInterventions: vi.fn(),
  getIntegrityReviewSummary: vi.fn((review: { flagged?: boolean }) => ({ flagged: Boolean(review.flagged) })),
  copyTextToClipboard: vi.fn(),
  buildAbsoluteAppUrl: vi.fn((path: string) => `https://app.test${path}`),
  computeRisk: vi.fn((trajectory: { studentId: string; name: string; email: string | null; scores: Array<{ score: number; date: string; assignmentTitle: string }> }) =>
    trajectory.scores.length > 1
      ? {
          studentId: trajectory.studentId,
          name: trajectory.name,
          email: trajectory.email,
          scores: trajectory.scores,
          riskLevel: "high",
          riskScore: 91,
          trend: "declining",
          flags: ["Declining scores"],
          recommendation: "Intervene now",
          predictedNext: 28,
        }
      : null,
  ),
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  logError: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [mocks.searchParams, mocks.setSearchParams] as const,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/lib/data/cohort", () => ({
  fetchCohortAnalyticsDataset: mocks.fetchCohortAnalyticsDataset,
}));

vi.mock("@/lib/cohortRecommendations", () => ({
  buildCohortRecommendations: mocks.buildCohortRecommendations,
  getCohortReportingReadiness: mocks.getCohortReportingReadiness,
}));

vi.mock("@/lib/recommendationPersistence", () => ({
  fetchPersistedRecommendations: mocks.fetchPersistedRecommendations,
  mergePersistedRecommendationState: mocks.mergePersistedRecommendationState,
  persistRecommendationAction: mocks.persistRecommendationAction,
  upsertGeneratedRecommendations: mocks.upsertGeneratedRecommendations,
}));

vi.mock("@/lib/interventions", () => ({
  buildRecommendationInterventionRows: mocks.buildRecommendationInterventionRows,
  insertRecommendationInterventions: mocks.insertRecommendationInterventions,
}));

vi.mock("@/lib/integrityReviews", () => ({
  getIntegrityReviewSummary: mocks.getIntegrityReviewSummary,
}));

vi.mock("@/lib/studentRisk", async () => {
  const actual = await vi.importActual<typeof import("@/lib/studentRisk")>("@/lib/studentRisk");
  return {
    ...actual,
    computeRisk: mocks.computeRisk,
  };
});

vi.mock("@/lib/clipboard", () => ({
  buildAbsoluteAppUrl: mocks.buildAbsoluteAppUrl,
  copyTextToClipboard: mocks.copyTextToClipboard,
}));

vi.mock("@/lib/logger", () => ({
  log: {
    error: mocks.logError,
  },
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

const buildRecommendation = (overrides: Partial<CohortRecommendation> = {}): CohortRecommendation =>
  ({
    id: "rec-risk",
    type: "student risk",
    ruleCode: "high_risk_cluster",
    title: "At-risk students",
    summary: "Intervention candidates are ready.",
    explanation: "Risk signals were detected across the cohort.",
    severity: "high",
    confidence: 0.91,
    recommendedActions: ["Review the highest-risk students."],
    evidence: {
      metrics: [{ label: "High risk", value: "1" }],
      affectedStudentIds: ["student-1"],
      affectedStudentNames: ["Ada"],
    },
    status: "open",
    createdAt: "2026-05-10T09:00:00.000Z",
    assignmentId: null,
    ...overrides,
  }) as CohortRecommendation;

const buildData = () => ({
  assignments: [
    {
      id: "module-1",
      title: "Module 1",
      module_code: "M1",
      created_at: "2026-05-01T00:00:00.000Z",
    },
  ],
  submissions: [
    {
      id: "submission-1",
      assignment_id: "module-1",
      student_id: "student-1",
      student_name: "Ada",
      student_email: "ada@example.com",
      file_name: "a.pdf",
      file_url: "a.pdf",
      submitted_at: "2026-05-01T00:00:00.000Z",
    },
    {
      id: "submission-2",
      assignment_id: "module-1",
      student_id: "student-1",
      student_name: "Ada",
      student_email: "ada@example.com",
      file_name: "b.pdf",
      file_url: "b.pdf",
      submitted_at: "2026-05-15T00:00:00.000Z",
    },
    {
      id: "submission-3",
      assignment_id: "module-1",
      student_id: "student-2",
      student_name: "Ben",
      student_email: "ben@example.com",
      file_name: "c.pdf",
      file_url: "c.pdf",
      submitted_at: "2026-05-12T00:00:00.000Z",
    },
  ],
  grades: [
    {
      submission_id: "submission-1",
      final_score: 35,
      ai_score: 36,
      ai_breakdown: [
        { criterion: "Analysis", score: 10, max_score: 20 },
        { criterion: null, score: 5, max_score: 0 },
      ],
    },
    {
      submission_id: "submission-2",
      final_score: 30,
      ai_score: 30,
      ai_breakdown: [{ criterion: "Analysis", score: 8, max_score: 20 }],
    },
    {
      submission_id: "submission-3",
      final_score: 82,
      ai_score: 82,
      ai_breakdown: [],
    },
  ],
  integrityReviews: [
    { submission_id: "submission-1", flagged: true },
    { submission_id: "submission-3", flagged: false },
  ],
});

describe("cohort analytics controller coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchParams = new URLSearchParams("ltiContextId=module-1");
    mocks.auth.user = { id: "lecturer-1" };
    mocks.fetchCohortAnalyticsDataset.mockResolvedValue(buildData());
    mocks.fetchPersistedRecommendations.mockResolvedValue([{ id: "persisted-1" }]);
    mocks.buildCohortRecommendations.mockReturnValue([
      buildRecommendation(),
      buildRecommendation({
        id: "rec-integrity",
        type: "integrity alerts",
        status: "actioned",
        assignmentId: "module-1",
        evidence: { metrics: [], affectedStudentIds: [], affectedStudentNames: [] },
      }),
      buildRecommendation({
        id: "rec-assignment",
        type: "assignment pattern",
        assignmentId: "module-1",
        evidence: { metrics: [], affectedStudentIds: [], affectedStudentNames: [] },
      }),
      buildRecommendation({
        id: "rec-general",
        type: "general",
        assignmentId: null,
        evidence: { metrics: [], affectedStudentIds: [], affectedStudentNames: [] },
      }),
    ]);
    mocks.getCohortReportingReadiness.mockReturnValue({
      headline: "Ready",
      detail: "Ready to report",
      primaryAction: "Publish",
    });
    mocks.upsertGeneratedRecommendations.mockResolvedValue(undefined);
    mocks.persistRecommendationAction.mockResolvedValue(undefined);
    mocks.buildRecommendationInterventionRows.mockReturnValue([
      {
        lecturerId: "lecturer-1",
        studentId: "student-1",
        name: "Ada",
        email: "ada@example.com",
      },
    ]);
    mocks.insertRecommendationInterventions.mockResolvedValue({ error: null });
    mocks.copyTextToClipboard.mockResolvedValue(true);
  });

  it("loads data, sets the module filter from the launch context, and runs the main recommendation actions", async () => {
    const { result } = renderHook(() => useCohortAnalyticsController());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.moduleFilter).toBe("module-1"));

    expect(result.current.modules).toHaveLength(1);
    expect(result.current.topAtRiskStudents).toHaveLength(1);
    expect(result.current.reportingReadiness.headline).toBe("Ready");
    expect(result.current.gradeDistChart).toHaveLength(5);

    const [riskRecommendation, integrityRecommendation, assignmentRecommendation, generalRecommendation] =
      result.current.visibleRecommendations;

    await act(async () => {
      await result.current.handleReview(assignmentRecommendation);
    });
    expect(mocks.persistRecommendationAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "review",
        nextStatus: "reviewed",
        lecturerId: "lecturer-1",
      }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/dashboard/assignments/module-1");

    await act(async () => {
      await result.current.handleDismiss(generalRecommendation);
    });
    expect(mocks.persistRecommendationAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "dismiss",
        nextStatus: "dismissed",
      }),
    );

    await act(async () => {
      await result.current.handleCreateIntervention(riskRecommendation);
    });
    expect(mocks.buildRecommendationInterventionRows).toHaveBeenCalledWith(
      expect.objectContaining({
        lecturerId: "lecturer-1",
        assignmentId: null,
      }),
    );
    expect(mocks.insertRecommendationInterventions).toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith("/dashboard/performance?risk=high-plus");

    await act(async () => {
      await result.current.handleCreateIntervention(integrityRecommendation);
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/dashboard/integrity");

    await act(async () => {
      await result.current.handleCopyWorkflowLink(riskRecommendation);
    });
    expect(mocks.copyTextToClipboard).toHaveBeenCalledWith("https://app.test/dashboard/performance?risk=high-plus");
    expect(mocks.toast.success).toHaveBeenCalledWith("Workflow link copied.");
  });

  it("handles empty and error states without leaving the controller in a loading state", async () => {
    mocks.fetchCohortAnalyticsDataset.mockResolvedValueOnce({
      assignments: [],
      submissions: [],
      grades: [],
      integrityReviews: [],
    });

    const { result } = renderHook(() => useCohortAnalyticsController());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.modules).toHaveLength(0);
    expect(result.current.visibleRecommendations).toHaveLength(0);
    expect(result.current.topAtRiskStudents).toHaveLength(0);
  });

  it("reports load failures through the error state and toast", async () => {
    mocks.fetchCohortAnalyticsDataset.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useCohortAnalyticsController());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe("Cohort analytics could not be loaded right now.");
    expect(mocks.toast.error).toHaveBeenCalledWith("Could not load cohort analytics.");
  });
});

describe("cohort analytics helpers", () => {
  it("formats recommendation summaries, routes, and badge variants", () => {
    expect(formatStatusLabel("in_progress")).toBe("In Progress");
    expect(severityVariant("critical")).toBe("destructive");
    expect(statusVariant("actioned")).toBe("default");
    expect(getRecommendationRoute(buildRecommendation())).toBe("/dashboard/performance?risk=high-plus");
    expect(
      getRecommendationActionSummary(
        buildRecommendation({
          id: "rec-assign",
          type: "assignment pattern",
          assignmentId: "assignment-1",
          evidence: { metrics: [], affectedStudentIds: [], affectedStudentNames: [] },
        }),
      ).primaryLabel,
    ).toBe("Review assignment workflow");
  });

  it("builds grade distributions across all bands", () => {
    const bands = buildGradeDistribution([75, 65, 55, 45, 20]);
    expect(bands.map((band) => band.count)).toEqual([1, 1, 1, 1, 1]);
  });
});
