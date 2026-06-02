// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildOperationalMonitoringSnapshot } from "@/lib/operationalMonitoring";
import { runPerformanceBenchmark } from "@/lib/performanceBenchmarks";
import { buildPerformanceProjection } from "@/lib/performanceAnalytics";
import { sortModerationQueueCases, type ModerationCaseView } from "@/lib/moderationWorkflow";

const buildProjectionDataset = () => {
  const assignments = Array.from({ length: 180 }, (_, index) => ({
    id: `assignment-${index + 1}`,
    title: `Assignment ${index + 1}`,
    module_code: `MOD-${(index % 12) + 1}`,
  }));

  const submissions = Array.from({ length: 3600 }, (_, index) => ({
    id: `submission-${index + 1}`,
    assignment_id: assignments[index % assignments.length].id,
    student_id: `student-${(index % 900) + 1}`,
    student_name: `Student ${(index % 900) + 1}`,
    student_email: `student${(index % 900) + 1}@gradeai.test`,
    submitted_at: `2026-04-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
  }));

  const grades = submissions.map((submission, index) => ({
    submission_id: submission.id,
    ai_score: null,
    final_score: 35 + (index % 45),
  }));

  return {
    assignments,
    submissions,
    grades,
  };
};

const buildModerationCases = (): ModerationCaseView[] =>
  Array.from({ length: 1500 }, (_, index) => {
    const statusCycle = [
      "moderation_pending",
      "moderation_in_progress",
      "moderated",
      "escalated",
      "approved",
      "released",
    ] as const;
    const status = statusCycle[index % statusCycle.length];

    return {
      moderationCase: {
        id: `case-${index + 1}`,
        submission_id: `submission-${index + 1}`,
        assignment_id: `assignment-${(index % 180) + 1}`,
        grade_id: `grade-${index + 1}`,
        lecturer_id: "lecturer-1",
        first_marker_id: "lecturer-1",
        moderator_id: index % 2 === 0 ? "moderator-1" : null,
        status,
        trigger_flags: [],
        trigger_summary: null,
        confidence_score: 0.71,
        integrity_risk_score: index % 5 === 0 ? 78 : 33,
        ai_score_snapshot: 61,
        first_marker_score: 62,
        moderator_score: status === "moderated" ? 60 : null,
        final_agreed_score: status === "approved" || status === "released" ? 60 : null,
        final_agreed_feedback: null,
        moderated_at: null,
        approved_at: status === "approved" || status === "released" ? "2026-05-01T10:00:00.000Z" : null,
        created_at: `2026-04-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
        updated_at: `2026-05-${String((index % 4) + 1).padStart(2, "0")}T10:00:00.000Z`,
      } as ModerationCaseView["moderationCase"],
      submission: {
        id: `submission-${index + 1}`,
        student_name: `Student ${(index % 600) + 1}`,
        student_email: `student${(index % 600) + 1}@gradeai.test`,
        status: status === "approved" ? "approved" : status === "released" ? "released" : status,
      } as ModerationCaseView["submission"],
      grade: null,
      assignment: {
        id: `assignment-${(index % 180) + 1}`,
        title: `Assignment ${(index % 180) + 1}`,
      } as ModerationCaseView["assignment"],
      firstMarker: null,
      moderator: null,
      integrityReview: null,
      reviews: [],
      auditLog: [],
    };
  });

describe("workflow performance harness", () => {
  it("keeps large performance analytics projections within a reasonable budget", () => {
    const dataset = buildProjectionDataset();
    const result = runPerformanceBenchmark({
      label: "performance-projection",
      iterations: 15,
      run: () => {
        buildPerformanceProjection({
          assignments: dataset.assignments,
          submissions: dataset.submissions,
          grades: dataset.grades,
          moduleFilter: "all",
          computeRisk: (trajectory) =>
            trajectory.scores.length > 0
              ? {
                  name: trajectory.name,
                  email: trajectory.email ?? null,
                  studentId: trajectory.studentId,
                  riskScore: 52,
                  riskLevel: "moderate",
                  avgGrade: Math.round(
                    trajectory.scores.reduce((sum, item) => sum + item.score, 0) / trajectory.scores.length,
                  ),
                  lastGrade: trajectory.scores[trajectory.scores.length - 1]?.score ?? 0,
                  trend: "stable-low",
                  flags: ["benchmark"],
                  sparkline: trajectory.scores.slice(-6).map((item) => item.score),
                  recommendation: "benchmark",
                  predictedNext: 55,
                }
              : null,
        });
      },
    });

    expect(result.avgMs).toBeLessThan(160);
    expect(result.p95Ms).toBeLessThan(240);
  });

  it("keeps large moderation queue sorts within a reasonable budget", () => {
    const rows = buildModerationCases();
    const result = runPerformanceBenchmark({
      label: "moderation-queue-sort",
      iterations: 20,
      run: () => {
        sortModerationQueueCases(rows, "priority");
      },
    });

    expect(result.avgMs).toBeLessThan(80);
    expect(result.p95Ms).toBeLessThan(140);
  });

  it("keeps operational snapshot generation cheap under broad admin datasets", () => {
    const moderationRows = Array.from({ length: 1200 }, (_, index) => ({
      status: index % 4 === 0 ? "escalated" : "moderation_pending",
      createdAt: `2026-04-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
      updatedAt: `2026-05-${String((index % 4) + 1).padStart(2, "0")}T10:00:00.000Z`,
      integrityRiskScore: index % 3 === 0 ? 82 : 38,
    }));
    const submissions = Array.from({ length: 4200 }, (_, index) => ({
      status: index % 5 === 0 ? "approved" : "released",
    }));

    const result = runPerformanceBenchmark({
      label: "operational-snapshot",
      iterations: 30,
      run: () => {
        buildOperationalMonitoringSnapshot({
          workflowRunTelemetryAvailable: true,
          workflowRunRows: [
            {
              status: "succeeded",
              startedAt: "2026-05-04T08:00:00.000Z",
              finishedAt: "2026-05-04T08:00:02.000Z",
              durationMs: 2000,
              workflowName: "grade-submission",
              provider: "openai",
              model: "gpt-4o-mini",
              providerRetryCount: 0,
              gradingPassCount: 3,
              failureCategory: null,
            },
          ],
          latestGradeRun: "2026-05-04T08:00:00.000Z",
          aiGradingFailures: 1,
          moderationRows,
          submissions,
          workflowNotificationTelemetryAvailable: true,
          workflowNotificationRows: [
            {
              deliveryStatus: "sent",
              createdAt: "2026-05-04T08:00:00.000Z",
              sentAt: "2026-05-04T08:02:00.000Z",
              lastError: null,
            },
          ],
          now: new Date("2026-05-04T12:00:00.000Z").getTime(),
        });
      },
    });

    expect(result.avgMs).toBeLessThan(25);
    expect(result.p95Ms).toBeLessThan(45);
  });
});
