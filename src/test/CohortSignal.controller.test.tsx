import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCohortSignalController } from "@/pages/dashboard/cohortsignal/useCohortSignalController";
import {
  __cohortSignalTestHooks,
  buildLiveCohortSignalDataset,
  resolveCohortSignalAssignmentTitle,
  resolveCohortSignalLatestIntervention,
  resolveCohortSignalInterventionLoggedAt,
  resolveCohortSignalLatestMark,
  resolveCohortSignalSubmissionKey,
  getCohortSignalStudentInitials,
  getCohortSignalStudentSortPriority,
  getSlope,
  getTrend,
  resolveCohortSignalStudentModule,
  resolveCohortSignalStudentName,
  resolveCohortSignalFailureProbability,
  resolveCohortSignalPredictedNext,
  resolveCohortSignalRiskReasonLabel,
  resolveCohortSignalRiskReasons,
  resolveCohortSignalSuggestedAction,
  shouldSkipCohortSignalTrajectory,
} from "@/pages/dashboard/cohortsignal/liveData";
import {
  __cohortSignalDemoTestHooks,
  getPrecisionFromConfusionMatrix,
  resolveCohortSignalBandDisplayName,
  resolveCohortSignalDemoStudentInitials,
  resolveCohortSignalDemoStudentName,
  resolveCohortSignalFailureProbability as resolveDemoFailureProbability,
  resolveCohortSignalPredictedBand,
  shouldPredictCohortSignalFailure,
  shouldFlagCohortSignalMissingSubmission,
} from "@/pages/cohortsignal-demo/demoData";

const mocks = vi.hoisted(() => ({
  authState: {
    profile: {
      id: "lecturer-1",
      full_name: "Lecturer User",
      email: "lecturer@example.com",
      role: "lecturer",
    },
    user: {
      id: "lecturer-1",
      email: "lecturer@example.com",
    },
  },
  fetchCohortAnalyticsDataset: vi.fn(),
  insertManualIntervention: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/lib/data/cohort", () => ({
  fetchCohortAnalyticsDataset: mocks.fetchCohortAnalyticsDataset,
}));

vi.mock("@/lib/interventions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/interventions")>("@/lib/interventions");
  return {
    ...actual,
    insertManualIntervention: mocks.insertManualIntervention,
  };
});

vi.mock("@/lib/logger", () => ({
  log: {
    error: mocks.logError,
    warn: mocks.logWarn,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.supabaseFrom,
  },
}));

const buildDataset = () => {
  const assignments = [
    { id: "assign-1", title: "Essay 1", module_code: "LAW101" },
    { id: "assign-2", title: "Essay 2", module_code: "LAW101" },
  ];

  const students = [
    { id: "student-ada", name: "Ada Ibrahim", scores: [90, 88] },
    { id: "student-ben", name: "Ben Carter", scores: [84, 82] },
    { id: "student-cara", name: "Cara Khan", scores: [78, 76] },
    { id: "student-dan", name: "Dan Li", scores: [62, 58] },
    { id: "student-eli", name: "Eli Roberts", scores: [54, 52] },
    { id: "student-fay", name: "Fay Hassan", scores: [42, 40] },
    { id: "student-gus", name: "Gus Martin", scores: [35, 33] },
    { id: "student-hana", name: "Hana Saleh", scores: [47] },
  ];

  const submissions: Array<{
    id: string;
    assignment_id: string;
    student_id: string;
    student_name: string;
    student_email: string;
    status: string;
    submitted_at: string;
  }> = [];
  const grades: Array<{
    submission_id: string;
    ai_score: number | null;
    final_score: number | null;
  }> = [];

  students.forEach((student, studentIndex) => {
    student.scores.forEach((score, scoreIndex) => {
      const submissionId = `${student.id}-submission-${scoreIndex + 1}`;
      const assignment = assignments[scoreIndex] ?? assignments[0];

      submissions.push({
        id: submissionId,
        assignment_id: assignment.id,
        student_id: student.id,
        student_name: student.name,
        student_email: `${student.id}@example.com`,
        status: "graded",
        submitted_at: `2026-01-${String(studentIndex * 2 + scoreIndex + 1).padStart(2, "0")}T10:00:00.000Z`,
      });

      grades.push({
        submission_id: submissionId,
        ai_score: null,
        final_score: score,
      });
    });
  });

  const interventions = [
    {
      id: "intervention-hana",
      lecturer_id: "lecturer-1",
      student_id: "student-hana",
      student_name: "Hana Saleh",
      student_email: "student-hana@example.com",
      intervention_type: "email",
      status: "planned",
      priority: "high",
      title: "Email intervention",
      notes: "Follow up on flagged risk",
      follow_up_date: "2026-01-30T10:00:00.000Z",
      assignment_id: null,
      created_at: "2026-01-23T10:00:00.000Z",
      updated_at: "2026-01-23T10:00:00.000Z",
    },
  ];

  return { assignments, submissions, grades, interventions };
};

const createInterventionQuery = (interventions: unknown[], error: unknown = null) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: interventions, error }),
});

describe("CohortSignal live controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState = {
      profile: {
        id: "lecturer-1",
        full_name: "Lecturer User",
        email: "lecturer@example.com",
        role: "lecturer",
      },
      user: {
        id: "lecturer-1",
        email: "lecturer@example.com",
      },
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("loads live data, exposes metrics, reloads, and logs interventions", async () => {
    const dataset = buildDataset();
    mocks.fetchCohortAnalyticsDataset.mockResolvedValue({
      assignments: dataset.assignments,
      submissions: dataset.submissions,
      grades: dataset.grades,
    });
    mocks.supabaseFrom.mockReturnValue(createInterventionQuery(dataset.interventions));
    mocks.insertManualIntervention.mockResolvedValue({
      data: { createdAt: "2026-02-01T10:00:00.000Z" },
      error: null,
    });

    const { result } = renderHook(() => useCohortSignalController());

    await waitFor(() => expect(result.current.state.loading).toBe(false));

    expect(result.current.state.error).toBeNull();
    expect(result.current.state.students).toHaveLength(8);
    expect(result.current.state.bandReport.crossValidation.folds).toBeGreaterThan(0);
    expect(result.current.state.failureReport.precision).toBeGreaterThan(0);
    expect(result.current.state.failureReport.recall).toBeGreaterThan(0);
    expect(mocks.fetchCohortAnalyticsDataset).toHaveBeenCalledWith("lecturer-1");
    expect(mocks.supabaseFrom).toHaveBeenCalledWith("student_interventions");

    const hana = result.current.state.students.find((student) => student.id === "student-hana");
    expect(hana).toBeDefined();
    expect(hana).toMatchObject({
      name: "Hana Saleh",
      missingSubmission: true,
      interventionLoggedAt: "2026-01-23T10:00:00.000Z",
    });

    await act(async () => {
      const createdAt = await result.current.actions.logIntervention(hana!);
      expect(createdAt).toBe("2026-02-01T10:00:00.000Z");
    });

    expect(mocks.insertManualIntervention).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        lecturer_id: "lecturer-1",
        student_id: "student-hana",
        student_name: "Hana Saleh",
      }),
    );

    act(() => {
      result.current.actions.reload();
    });

    await waitFor(() => expect(mocks.fetchCohortAnalyticsDataset).toHaveBeenCalledTimes(2));
  });

  it("surfaces an error when cohort data loading fails", async () => {
    mocks.fetchCohortAnalyticsDataset.mockRejectedValue(new Error("dataset unavailable"));
    mocks.supabaseFrom.mockReturnValue(createInterventionQuery([], null));

    const { result } = renderHook(() => useCohortSignalController());

    await waitFor(() => expect(result.current.state.loading).toBe(false));

    expect(result.current.state.error).toBe("The CohortSignal live view could not be loaded right now.");
    expect(mocks.logError).toHaveBeenCalledWith(
      "CohortSignal live dataset fetch failed",
      expect.any(Error),
      expect.objectContaining({
        userId: "lecturer-1",
      }),
    );
  });

  it("does not load data when there is no authenticated user", async () => {
    mocks.authState = {
      profile: null,
      user: null,
    } as never;

    const { result } = renderHook(() => useCohortSignalController());

    await waitFor(() => expect(mocks.fetchCohortAnalyticsDataset).not.toHaveBeenCalled());
    expect(result.current.state.loading).toBe(true);
  });
});

describe("buildLiveCohortSignalDataset", () => {
  it("builds student tiles, reports, and intervention markers from live rows", () => {
    const dataset = buildDataset();

    const result = buildLiveCohortSignalDataset({
      assignments: dataset.assignments as never,
      submissions: dataset.submissions as never,
      grades: dataset.grades as never,
      interventions: dataset.interventions as never,
    });

    expect(result.students).toHaveLength(8);
    expect(result.bandReport.crossValidation.folds).toBeGreaterThan(0);
    expect(result.failureReport.crossValidation.folds).toBeGreaterThan(0);
    expect(result.failureReport.confusionMatrix.truePositives + result.failureReport.confusionMatrix.trueNegatives).toBeGreaterThan(0);

    const hana = result.students.find((student) => student.id === "student-hana");
    expect(hana).toMatchObject({
      riskBand: "insufficient",
      missingSubmission: true,
      interventionLoggedAt: "2026-01-23T10:00:00.000Z",
    });
    expect(hana?.riskReasons).toContain("Missing one or more submissions");
  });

  it("falls back to submission and assignment defaults when live rows omit metadata", () => {
    const assignments = [
      { id: "assign-1", title: "Fallback Seminar", module_code: null },
      { id: "assign-2", title: "Second Seminar", module_code: null },
    ];
    const submissions = [
      {
        id: "submission-fallback",
        assignment_id: "assign-1",
        student_id: null,
        student_name: null,
        student_email: null,
        status: "graded",
        submitted_at: "2026-01-01T10:00:00.000Z",
      },
      {
        id: "submission-ungraded",
        assignment_id: "assign-2",
        student_id: null,
        student_name: null,
        student_email: null,
        status: "submitted",
        submitted_at: "2026-01-02T10:00:00.000Z",
      },
    ];
    const grades = [{ submission_id: "submission-fallback", final_score: 67, ai_score: null }];

    const result = buildLiveCohortSignalDataset({
      assignments: assignments as never,
      submissions: submissions as never,
      grades: grades as never,
      interventions: [] as never,
    });

    expect(result.students).toHaveLength(1);
    expect(result.students[0]).toMatchObject({
      id: "submission-fallback",
      name: "Student",
      module: "Fallback Seminar",
      latestMark: 67,
      averageMark: 67,
    });
  });

  it("uses ai scores and keeps the newest intervention for each student", () => {
    const assignments = [{ id: "assign-1", title: "Essay", module_code: "LAW201" }];
    const submissions = [
      {
        id: "submission-ai",
        assignment_id: "assign-1",
        student_id: "student-ai",
        student_name: "AI Student",
        student_email: "ai@example.com",
        status: "graded",
        submitted_at: "2026-01-01T10:00:00.000Z",
      },
    ];
    const grades = [{ submission_id: "submission-ai", final_score: null, ai_score: 74 }];
    const interventions = [
      {
        id: "intervention-old",
        lecturer_id: "lecturer-1",
        student_id: "student-ai",
        student_name: "AI Student",
        student_email: "ai@example.com",
        intervention_type: "email",
        status: "planned",
        priority: "medium",
        title: "Old intervention",
        notes: "Old note",
        follow_up_date: null,
        assignment_id: null,
        created_at: "2026-01-01T10:00:00.000Z",
        updated_at: "2026-01-01T10:00:00.000Z",
      },
      {
        id: "intervention-new",
        lecturer_id: "lecturer-1",
        student_id: "student-ai",
        student_name: "AI Student",
        student_email: "ai@example.com",
        intervention_type: "meeting",
        status: "logged",
        priority: "high",
        title: "New intervention",
        notes: "New note",
        follow_up_date: null,
        assignment_id: null,
        created_at: "2026-01-03T10:00:00.000Z",
        updated_at: "2026-01-03T10:00:00.000Z",
      },
      {
        id: "intervention-older",
        lecturer_id: "lecturer-1",
        student_id: "student-ai",
        student_name: "AI Student",
        student_email: "ai@example.com",
        intervention_type: "call",
        status: "planned",
        priority: "low",
        title: "Older intervention",
        notes: "Older note",
        follow_up_date: null,
        assignment_id: null,
        created_at: "2026-01-02T10:00:00.000Z",
        updated_at: "2026-01-02T10:00:00.000Z",
      },
      {
        id: "intervention-ignored",
        lecturer_id: "lecturer-1",
        student_id: null,
        student_name: "Ignored",
        student_email: "ignored@example.com",
        intervention_type: "meeting",
        status: "planned",
        priority: "low",
        title: "Ignored intervention",
        notes: "Ignored note",
        follow_up_date: null,
        assignment_id: null,
        created_at: "2026-01-04T10:00:00.000Z",
        updated_at: "2026-01-04T10:00:00.000Z",
      },
    ];

    const result = buildLiveCohortSignalDataset({
      assignments: assignments as never,
      submissions: submissions as never,
      grades: grades as never,
      interventions: interventions as never,
    });

    expect(result.students).toHaveLength(1);
    expect(result.students[0]).toMatchObject({
      latestMark: 74,
      interventionLoggedAt: "2026-01-03T10:00:00.000Z",
    });
  });
});

describe("cohort signal model helpers", () => {
  it("returns empty reports for empty inputs", () => {
    const result = __cohortSignalTestHooks.evaluateModel([], ["low", "medium", "high"]);

    expect(result.holdoutAccuracy).toBe(0);
    expect(result.crossValidation).toEqual({ folds: 0, accuracy: 0, foldAccuracies: [] });
    expect(result.confusionMatrix).toEqual({
      truePositives: 0,
      falsePositives: 0,
      trueNegatives: 0,
      falseNegatives: 0,
    });
  });

  it("records false negatives when fail rows are predicted as pass", () => {
    const rows = [
      { id: "pass-1", features: [70, 70, 0, 0, 2, 0], label: "pass" as const },
      { id: "pass-2", features: [68, 68, 0, 0, 2, 0], label: "pass" as const },
      { id: "fail-1", features: [70, 70, 0, 0, 2, 0], label: "fail" as const },
      { id: "fail-2", features: [68, 68, 0, 0, 2, 0], label: "fail" as const },
    ];

    const result = __cohortSignalTestHooks.evaluateModel(rows as never, ["pass", "fail"], "fail");

    expect(result.confusionMatrix.falseNegatives).toBeGreaterThan(0);
    expect(result.confusionMatrix.truePositives + result.confusionMatrix.falsePositives).toBeGreaterThanOrEqual(0);
  });

  it("handles a label with a single row in the stratified split", () => {
    const rows = [
      { id: "pass-1", features: [14, 14, 0, 0, 2, 0], label: "low" as const },
      { id: "pass-2", features: [13, 13, 0, 0, 2, 0], label: "low" as const },
      { id: "fail-1", features: [5, 5, 0, 0, 1, 1], label: "high" as const },
    ];

    const result = __cohortSignalTestHooks.evaluateModel(rows as never, ["low", "medium", "high"]);

    expect(result.crossValidation.folds).toBe(0);
    expect(result.crossValidation.foldAccuracies).toHaveLength(0);
    expect(result.holdoutAccuracy).toBeGreaterThanOrEqual(0);
  });

  it("falls back to holdout accuracy and zero precision/recall when only pass rows exist", () => {
    const rows = [
      {
        school: "GP",
        module: "Mathematics",
        sourceModuleCode: "mat" as const,
        age: 0,
        Medu: 0,
        Fedu: 0,
        traveltime: 1,
        studytime: 0,
        failures: 0,
        famrel: 0,
        freetime: 0,
        goout: 0,
        Dalc: 1,
        Walc: 1,
        health: 0,
        absences: 0,
        G1: 0,
        G2: 0,
        G3: 14,
      },
      {
        school: "GP",
        module: "Mathematics",
        sourceModuleCode: "mat" as const,
        age: 0,
        Medu: 0,
        Fedu: 0,
        traveltime: 1,
        studytime: 0,
        failures: 0,
        famrel: 0,
        freetime: 0,
        goout: 0,
        Dalc: 1,
        Walc: 1,
        health: 0,
        absences: 0,
        G1: 0,
        G2: 0,
        G3: 14,
      },
    ];

    const bandReport = __cohortSignalTestHooks.evaluateModel(
      [
        { id: "pass-1", features: [14, 14, 0, 0, 2, 0], label: "low" as const },
        { id: "pass-2", features: [13, 13, 0, 0, 2, 0], label: "low" as const },
      ] as never,
      ["low", "medium", "high"],
    );
    const failureReport = __cohortSignalDemoTestHooks.evaluateFailureModel(rows as never);

    expect(bandReport.crossValidation.folds).toBe(0);
    expect(bandReport.crossValidation.foldAccuracies).toHaveLength(0);
    expect(failureReport.precision).toBe(0);
    expect(failureReport.recall).toBe(0);
  });

  it("returns zeroed failure metrics for empty inputs", () => {
    const failureReport = __cohortSignalDemoTestHooks.evaluateFailureModel([] as never);
    const zeroFoldFailureReport = __cohortSignalDemoTestHooks.evaluateFailureModel([] as never, 0);

    expect(failureReport.holdoutAccuracy).toBe(0);
    expect(failureReport.crossValidation.accuracy).toBe(0);
    expect(failureReport.crossValidation.foldAccuracies).toHaveLength(5);
    expect(failureReport.crossValidation.foldAccuracies.every((foldAccuracy) => foldAccuracy === 0)).toBe(true);
    expect(failureReport.precision).toBe(0);
    expect(failureReport.recall).toBe(0);
    expect(zeroFoldFailureReport.crossValidation.foldAccuracies).toHaveLength(0);
    expect(zeroFoldFailureReport.crossValidation.accuracy).toBe(0);
  });

  it("covers the band-model zero-data and fold paths", () => {
    const emptyFoldBandReport = __cohortSignalDemoTestHooks.evaluateBandModel([] as never);
    const emptyBandReport = __cohortSignalDemoTestHooks.evaluateBandModel([] as never, 0);
    const foldBandReport = __cohortSignalDemoTestHooks.evaluateBandModel(
      [
        {
          school: "GP",
          module: "Mathematics",
          sourceModuleCode: "mat" as const,
          age: 18,
          Medu: 2,
          Fedu: 2,
          traveltime: 1,
          studytime: 2,
          failures: 0,
          famrel: 4,
          freetime: 3,
          goout: 2,
          Dalc: 1,
          Walc: 1,
          health: 4,
          absences: 0,
          G1: 12,
          G2: 13,
          G3: 14,
        },
        {
          school: "GP",
          module: "Mathematics",
          sourceModuleCode: "mat" as const,
          age: 19,
          Medu: 2,
          Fedu: 2,
          traveltime: 1,
          studytime: 2,
          failures: 0,
          famrel: 4,
          freetime: 3,
          goout: 2,
          Dalc: 1,
          Walc: 1,
          health: 4,
          absences: 1,
          G1: 11,
          G2: 12,
          G3: 13,
        },
        {
          school: "GP",
          module: "Mathematics",
          sourceModuleCode: "mat" as const,
          age: 18,
          Medu: 1,
          Fedu: 1,
          traveltime: 2,
          studytime: 1,
          failures: 1,
          famrel: 3,
          freetime: 2,
          goout: 3,
          Dalc: 2,
          Walc: 2,
          health: 3,
          absences: 4,
          G1: 8,
          G2: 7,
          G3: 8,
        },
        {
          school: "GP",
          module: "Mathematics",
          sourceModuleCode: "mat" as const,
          age: 17,
          Medu: 1,
          Fedu: 1,
          traveltime: 2,
          studytime: 1,
          failures: 1,
          famrel: 3,
          freetime: 2,
          goout: 3,
          Dalc: 2,
          Walc: 2,
          health: 3,
          absences: 5,
          G1: 9,
          G2: 8,
          G3: 9,
        },
      ] as never,
      2,
    );

    expect(emptyFoldBandReport.crossValidation.foldAccuracies).toHaveLength(5);
    expect(emptyFoldBandReport.crossValidation.foldAccuracies.every((foldAccuracy) => foldAccuracy === 0)).toBe(true);
    expect(emptyBandReport.holdoutAccuracy).toBe(0);
    expect(emptyBandReport.crossValidation.accuracy).toBe(0);
    expect(emptyBandReport.crossValidation.foldAccuracies).toHaveLength(0);
    expect(foldBandReport.crossValidation.foldAccuracies).toHaveLength(2);
    expect(foldBandReport.crossValidation.foldAccuracies.every((foldAccuracy) => foldAccuracy >= 0)).toBe(true);
  });

  it("derives student initials and sort priority deterministically", () => {
    expect(getCohortSignalStudentInitials(" Ada Ibrahim")).toBe("AI");
    expect(getCohortSignalStudentInitials("Ben")).toBe("B");
    expect(
      getCohortSignalStudentSortPriority({
        predictedToFail: true,
        riskBand: "low",
        failProbability: 88,
      }),
    ).toBe(0);
    expect(
      getCohortSignalStudentSortPriority({
        predictedToFail: false,
        riskBand: "high",
        failProbability: 66,
      }),
    ).toBe(1);
    expect(
      getCohortSignalStudentSortPriority({
        predictedToFail: false,
        riskBand: "medium",
        failProbability: 55,
      }),
    ).toBe(2);
    expect(
      getCohortSignalStudentSortPriority({
        predictedToFail: false,
        riskBand: "low",
        failProbability: 12,
      }),
    ).toBe(3);
  });

  it("resolves fallback model helpers deterministically", () => {
    expect(resolveCohortSignalRiskReasonLabel("unknown_reason_code")).toBe("unknown_reason_code");
    expect(resolveCohortSignalPredictedNext(undefined, 12.4)).toBe(12);
    expect(resolveCohortSignalFailureProbability([])).toBe(0);
    expect(resolveCohortSignalFailureProbability([0.3, 0.45])).toBe(45);
    expect(resolveCohortSignalSubmissionKey({ student_id: null, student_email: null, student_name: null, id: "submission-1" })).toBe(
      "submission-1",
    );
    expect(resolveCohortSignalStudentName({ student_name: null, student_email: "student@example.com" })).toBe(
      "student@example.com",
    );
    expect(resolveCohortSignalStudentModule(null)).toBe("General");
    expect(resolveCohortSignalAssignmentTitle(null)).toBe("Assignment");
    expect(shouldSkipCohortSignalTrajectory([])).toBe(true);
    expect(shouldSkipCohortSignalTrajectory([1])).toBe(false);
    expect(resolveCohortSignalRiskReasons(undefined)).toEqual(["baseline_monitoring"]);
    expect(resolveCohortSignalRiskReasons(["explicit_reason"])).toEqual(["explicit_reason"]);
    expect(resolveCohortSignalSuggestedAction(undefined, null)).toContain("Schedule a check-in");
    expect(resolveCohortSignalSuggestedAction("Custom recommendation", "2026-02-01T00:00:00.000Z")).toContain(
      "Follow up on the logged intervention",
    );
    expect(resolveCohortSignalInterventionLoggedAt({ updated_at: "2026-02-02T00:00:00.000Z" })).toBe(
      "2026-02-02T00:00:00.000Z",
    );
    expect(resolveCohortSignalLatestMark([], 12.4)).toBe(12.4);
    expect(resolveCohortSignalStudentModule({
      module_code: "LAW300",
      title: "Evidence",
    })).toBe("LAW300");
    expect(resolveCohortSignalStudentModule({
      module_code: null,
      title: "Evidence",
    })).toBe("Evidence");
    expect(getTrend(2)).toBe("improving");
    expect(getTrend(-2)).toBe("declining");
    expect(getTrend(0)).toBe("steady");
    expect(getSlope([5])).toBe(0);
    expect(getSlope([1, 3])).toBe(2);
    expect(resolveCohortSignalBandDisplayName("low", 99)).toBe("Student 100");
    expect(resolveCohortSignalDemoStudentName(undefined, 4)).toBe("Student 5");
    expect(resolveCohortSignalDemoStudentInitials("Student 5")).toBe("S5");
    expect(resolveCohortSignalDemoStudentInitials("  ")).toBe("");
    expect(resolveDemoFailureProbability([])).toBe(0);
    expect(resolveDemoFailureProbability([0.2, 0.8])).toBe(0.8);
    expect(shouldPredictCohortSignalFailure([])).toBe(true);
    expect(shouldPredictCohortSignalFailure([0.8, 0.2])).toBe(false);
    expect(resolveCohortSignalPredictedBand(undefined)).toBe("low");
    expect(resolveCohortSignalPredictedBand("high")).toBe("high");
    expect(resolveCohortSignalLatestIntervention(undefined, {
      id: "next",
      lecturer_id: "lecturer-1",
      student_id: "student-ai",
      student_name: "AI Student",
      student_email: "ai@example.com",
      intervention_type: "meeting",
      status: "logged",
      priority: "high",
      title: "Newest",
      notes: "Newest note",
      follow_up_date: null,
      assignment_id: null,
      created_at: "2026-01-03T10:00:00.000Z",
      updated_at: "2026-01-03T10:00:00.000Z",
    })).toMatchObject({ id: "next" });
    expect(resolveCohortSignalLatestIntervention(
      {
        id: "current",
        lecturer_id: "lecturer-1",
        student_id: "student-ai",
        student_name: "AI Student",
        student_email: "ai@example.com",
        intervention_type: "email",
        status: "planned",
        priority: "medium",
        title: "Current",
        notes: "Current note",
        follow_up_date: null,
        assignment_id: null,
        created_at: "2026-01-03T10:00:00.000Z",
        updated_at: "2026-01-03T10:00:00.000Z",
      },
      {
        id: "older",
        lecturer_id: "lecturer-1",
        student_id: "student-ai",
        student_name: "AI Student",
        student_email: "ai@example.com",
        intervention_type: "call",
        status: "planned",
        priority: "low",
        title: "Older",
        notes: "Older note",
        follow_up_date: null,
        assignment_id: null,
        created_at: "2026-01-02T10:00:00.000Z",
        updated_at: "2026-01-02T10:00:00.000Z",
      },
    )).toMatchObject({ id: "current" });
    expect(resolveCohortSignalLatestIntervention(
      {
        id: "current-updated",
        lecturer_id: "lecturer-1",
        student_id: "student-ai",
        student_name: "AI Student",
        student_email: "ai@example.com",
        intervention_type: "email",
        status: "planned",
        priority: "medium",
        title: "Current Updated",
        notes: "Current updated note",
        follow_up_date: null,
        assignment_id: null,
        created_at: null,
        updated_at: "2026-01-02T10:00:00.000Z",
      },
      {
        id: "next-updated",
        lecturer_id: "lecturer-1",
        student_id: "student-ai",
        student_name: "AI Student",
        student_email: "ai@example.com",
        intervention_type: "call",
        status: "planned",
        priority: "low",
        title: "Next Updated",
        notes: "Next updated note",
        follow_up_date: null,
        assignment_id: null,
        created_at: null,
        updated_at: "2026-01-03T10:00:00.000Z",
      },
    )).toMatchObject({ id: "next-updated" });
    expect(resolveCohortSignalLatestIntervention(
      {
        id: "current-empty",
        lecturer_id: "lecturer-1",
        student_id: "student-ai",
        student_name: "AI Student",
        student_email: "ai@example.com",
        intervention_type: "email",
        status: "planned",
        priority: "medium",
        title: "Current Empty",
        notes: "Current empty note",
        follow_up_date: null,
        assignment_id: null,
        created_at: null,
        updated_at: null,
      },
      {
        id: "next-empty",
        lecturer_id: "lecturer-1",
        student_id: "student-ai",
        student_name: "AI Student",
        student_email: "ai@example.com",
        intervention_type: "call",
        status: "planned",
        priority: "low",
        title: "Next Empty",
        notes: "Next empty note",
        follow_up_date: null,
        assignment_id: null,
        created_at: null,
        updated_at: null,
      },
    )).toMatchObject({ id: "current-empty" });
    expect(shouldFlagCohortSignalMissingSubmission({
      school: "GP",
      module: "Mathematics",
      sourceModuleCode: "mat" as const,
      age: 0,
      Medu: 0,
      Fedu: 0,
      traveltime: 1,
      studytime: 0,
      failures: 2,
      famrel: 0,
      freetime: 0,
      goout: 0,
      Dalc: 1,
      Walc: 1,
      health: 0,
      absences: 0,
      G1: 0,
      G2: 0,
      G3: 14,
    })).toBe(true);
    expect(shouldFlagCohortSignalMissingSubmission({
      school: "GP",
      module: "Mathematics",
      sourceModuleCode: "mat" as const,
      age: 0,
      Medu: 0,
      Fedu: 0,
      traveltime: 1,
      studytime: 0,
      failures: 0,
      famrel: 0,
      freetime: 0,
      goout: 0,
      Dalc: 1,
      Walc: 1,
      health: 0,
      absences: 12,
      G1: 10,
      G2: 11,
      G3: 14,
    })).toBe(true);
    expect(shouldFlagCohortSignalMissingSubmission({
      school: "GP",
      module: "Mathematics",
      sourceModuleCode: "mat" as const,
      age: 0,
      Medu: 0,
      Fedu: 0,
      traveltime: 1,
      studytime: 0,
      failures: 0,
      famrel: 0,
      freetime: 0,
      goout: 0,
      Dalc: 1,
      Walc: 1,
      health: 0,
      absences: 0,
      G1: 7,
      G2: 5,
      G3: 14,
    })).toBe(true);
    expect(shouldFlagCohortSignalMissingSubmission({
      school: "GP",
      module: "Mathematics",
      sourceModuleCode: "mat" as const,
      age: 0,
      Medu: 0,
      Fedu: 0,
      traveltime: 1,
      studytime: 0,
      failures: 0,
      famrel: 0,
      freetime: 0,
      goout: 0,
      Dalc: 1,
      Walc: 1,
      health: 0,
      absences: 0,
      G1: 10,
      G2: 11,
      G3: 14,
    })).toBe(false);
  });

  it("uses the single-row standard deviation fallback", () => {
    const result = __cohortSignalTestHooks.evaluateModel(
      [{ id: "only-pass", features: [10, 10, 0, 0, 1, 0], label: "low" as const }] as never,
      ["low", "medium", "high"],
    );

    expect(result.holdoutAccuracy).toBeGreaterThanOrEqual(0);
  });

  it("handles precision fallback when the confusion matrix has no positive predictions", () => {
    expect(
      getPrecisionFromConfusionMatrix({
        truePositives: 0,
        falsePositives: 0,
        trueNegatives: 2,
        falseNegatives: 1,
      }),
    ).toBe(0);
    expect(
      getPrecisionFromConfusionMatrix({
        truePositives: 3,
        falsePositives: 1,
        trueNegatives: 2,
        falseNegatives: 0,
      }),
    ).toBe(0.75);
  });
});
