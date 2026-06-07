import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const single = vi.fn();
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));

  return {
    from,
    insert,
    select,
    single,
    log: {
      error: vi.fn(),
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock("@/lib/logger", () => ({
  log: mocks.log,
}));

import { submitRiskFeedback, submitRiskOutcome } from "@/lib/data/admin/riskIntelligence";
import { buildRiskIntelligenceCsv } from "@/lib/data/admin/riskIntelligenceView";

describe("risk intelligence data helpers", () => {
  beforeEach(() => {
    mocks.from.mockClear();
    mocks.insert.mockClear();
    mocks.select.mockClear();
    mocks.log.error.mockClear();
    mocks.single.mockReset();
    mocks.single.mockResolvedValue({
      data: {
        id: "row-1",
        prediction_id: "pred-1",
        reviewer_id: "reviewer-1",
        institution_id: "institution-1",
        feedback_type: "false_alarm",
        notes: "The alert was a false positive.",
        created_at: "2026-06-01T10:00:00Z",
        student_id: "student-1",
        snapshot_id: "snapshot-1",
        source_grade_id: null,
        source_submission_id: null,
        outcome_date: "2026-06-01",
        label_window_days: 30,
        label_value: "medium",
        outcome_status: "at_risk",
        outcome_source: "manual",
      },
      error: null,
    });
  });

  it("records false-positive feedback without mutating the prediction", async () => {
    const result = await submitRiskFeedback({
      predictionId: "pred-1",
      reviewerId: "reviewer-1",
      institutionId: "institution-1",
      feedbackType: "false_alarm",
      notes: "The alert was a false positive.",
    });

    expect(mocks.from).toHaveBeenCalledWith("risk_feedback");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        prediction_id: "pred-1",
        reviewer_id: "reviewer-1",
        institution_id: "institution-1",
        feedback_type: "false_alarm",
        notes: "The alert was a false positive.",
      }),
    );
    expect(result.feedback_type).toBe("false_alarm");
  });

  it("stores intervention outcomes for later model evaluation", async () => {
    const result = await submitRiskOutcome({
      studentId: "student-1",
      institutionId: "institution-1",
      predictionId: "pred-1",
      snapshotId: "snapshot-1",
      sourceGradeId: "grade-1",
      sourceSubmissionId: "submission-1",
      labelValue: "medium",
      outcomeStatus: "at_risk",
      outcomeSource: "manual",
      notes: "Lecturer intervention recorded.",
    });

    expect(mocks.from).toHaveBeenCalledWith("student_risk_outcomes");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: "student-1",
        institution_id: "institution-1",
        prediction_id: "pred-1",
        snapshot_id: "snapshot-1",
        source_grade_id: "grade-1",
        source_submission_id: "submission-1",
        label_value: "medium",
        outcome_status: "at_risk",
        outcome_source: "manual",
        notes: "Lecturer intervention recorded.",
      }),
    );
    expect(result.outcome_status).toBe("at_risk");
  });

  it("logs failed false-positive feedback writes without exposing notes", async () => {
    mocks.single.mockResolvedValueOnce({
      data: null,
      error: { message: "feedback insert failed" },
    });

    await expect(
      submitRiskFeedback({
        predictionId: "pred-1",
        reviewerId: "reviewer-1",
        institutionId: "institution-1",
        feedbackType: "false_alarm",
        notes: "The alert was a false positive.",
      }),
    ).rejects.toMatchObject({ message: "feedback insert failed" });

    expect(mocks.log.error).toHaveBeenCalledWith(
      "Failed to submit risk feedback",
      { message: "feedback insert failed" },
      expect.objectContaining({
        predictionId: "pred-1",
        reviewerId: "reviewer-1",
        institutionId: "institution-1",
        feedbackType: "false_alarm",
      }),
    );
  });

  it("logs failed intervention outcome writes without exposing notes", async () => {
    mocks.single.mockResolvedValueOnce({
      data: null,
      error: { message: "outcome insert failed" },
    });

    await expect(
      submitRiskOutcome({
        studentId: "student-1",
        institutionId: "institution-1",
        predictionId: "pred-1",
        snapshotId: "snapshot-1",
        sourceGradeId: "grade-1",
        sourceSubmissionId: "submission-1",
        labelValue: "medium",
        outcomeStatus: "at_risk",
        outcomeSource: "manual",
        notes: "Lecturer intervention recorded.",
      }),
    ).rejects.toMatchObject({ message: "outcome insert failed" });

    expect(mocks.log.error).toHaveBeenCalledWith(
      "Failed to submit risk outcome",
      { message: "outcome insert failed" },
      expect.objectContaining({
        studentId: "student-1",
        predictionId: "pred-1",
        snapshotId: "snapshot-1",
        institutionId: "institution-1",
        outcomeStatus: "at_risk",
        outcomeSource: "manual",
      }),
    );
  });

  it("redacts student names in exported risk CSVs when requested", () => {
    const csv = buildRiskIntelligenceCsv(
      [
        {
          id: "pred-1",
          studentLabel: "Sam Student",
          predictionDate: "2026-06-01",
          generatedAt: "2026-06-01T10:00:00Z",
          modelVersion: "risk-v1",
          featureVersion: "feat-v1",
          riskScore: 0.81,
          riskBand: "high",
          confidenceScore: 0.77,
          reasonCodes: ["late_submissions"],
          explanation: "High late submission rate",
          calibrationMetrics: null,
          componentScores: { academic: 85, engagement: 70, nonSubmission: 90 },
          componentSignals: {
            engagementEventCount: 2,
            lastEngagementAt: "2026-05-31T10:00:00Z",
            submittedAssignments: 1,
            lateSubmissions: 3,
            totalAssignments: 4,
          },
          feedbackCount: 0,
          latestFeedback: null,
        },
      ],
      { redactStudentIdentity: true },
    );

    expect(csv).toContain("Student 1");
    expect(csv).not.toContain("Sam Student");
  });
});
