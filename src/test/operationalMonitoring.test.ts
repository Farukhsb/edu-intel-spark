import { describe, expect, it } from "vitest";

import { buildOperationalMonitoringSnapshot } from "@/lib/operationalMonitoring";

describe("operationalMonitoring", () => {
  it("builds warning-oriented failure cards from observable workflow backlog", () => {
    const snapshot = buildOperationalMonitoringSnapshot({
      workflowRunTelemetryAvailable: true,
      workflowRunRows: [
        {
          status: "failed",
          startedAt: "2026-05-04T08:00:00.000Z",
          finishedAt: "2026-05-04T08:00:06.000Z",
          durationMs: 6000,
          workflowName: "grade-submission",
          provider: "openai",
          model: "gpt-4o-mini",
          retryCount: 2,
          failureCategory: "service_failure",
        },
      ],
      latestGradeRun: "2026-05-01T08:00:00.000Z",
      aiGradingFailures: 2,
      moderationRows: [
        {
          status: "moderation_pending",
          createdAt: "2026-04-20T08:00:00.000Z",
          updatedAt: "2026-04-20T08:00:00.000Z",
          integrityRiskScore: 82,
        },
        {
          status: "escalated",
          createdAt: "2026-05-03T08:00:00.000Z",
          updatedAt: "2026-05-03T08:00:00.000Z",
          integrityRiskScore: 65,
        },
      ],
      submissions: [{ status: "approved" }, { status: "released" }, { status: "approved" }],
      workflowNotificationTelemetryAvailable: true,
      workflowNotificationRows: [
        {
          deliveryStatus: "sent",
          createdAt: "2026-05-04T08:00:00.000Z",
          sentAt: "2026-05-04T08:02:00.000Z",
          lastError: null,
        },
        {
          deliveryStatus: "failed",
          createdAt: "2026-05-04T09:00:00.000Z",
          sentAt: null,
          lastError: "Resend rejected",
        },
        {
          deliveryStatus: "pending",
          createdAt: "2026-05-04T10:00:00.000Z",
          sentAt: null,
          lastError: null,
        },
      ],
      now: new Date("2026-05-04T12:00:00.000Z").getTime(),
    });

    expect(snapshot.failureCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Grading failures today",
          tone: "warning",
          value: "2",
          signalType: "live",
        }),
        expect.objectContaining({
          title: "Release backlog",
          tone: "warning",
          value: "2",
        }),
        expect.objectContaining({
          title: "Overdue moderation",
          tone: "warning",
          value: "1",
        }),
        expect.objectContaining({
          title: "Integrity escalations",
          tone: "warning",
          value: "2",
        }),
      ]),
    );

    expect(snapshot.alertCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Stale grading heartbeat",
          tone: "healthy",
          value: "0",
          signalType: "live",
          threshold: "No grade-submission run within 24 hours",
        }),
        expect.objectContaining({
          title: "Failed provider calls",
          tone: "warning",
          value: "1",
          signalType: "live",
        }),
        expect.objectContaining({
          title: "Email delivery failures",
          tone: "warning",
          value: "1",
          signalType: "live",
        }),
        expect.objectContaining({
          title: "Moderation backlog threshold",
          tone: "warning",
          value: "1",
          signalType: "live",
        }),
      ]),
    );

    expect(snapshot.healthItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "AI grading workflow signal",
          tone: "warning",
          statusLabel: "1 failed run",
          signalType: "live",
        }),
        expect.objectContaining({
          label: "Latest visible grading activity",
          tone: "warning",
          statusLabel: "Recorded",
          signalType: "inferred",
        }),
        expect.objectContaining({
          label: "Workflow notification delivery",
          tone: "warning",
          statusLabel: "1 failed",
          signalType: "live",
        }),
      ]),
    );
  });

  it("keeps placeholder language when direct telemetry is unavailable", () => {
    const snapshot = buildOperationalMonitoringSnapshot({
      workflowRunTelemetryAvailable: false,
      workflowRunRows: [],
      latestGradeRun: null,
      aiGradingFailures: null,
      moderationRows: [],
      submissions: [],
      workflowNotificationTelemetryAvailable: false,
      workflowNotificationRows: [],
    });

    expect(snapshot.healthItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "AI grading workflow signal",
          tone: "placeholder",
          statusLabel: "No provider telemetry",
          signalType: "placeholder",
        }),
        expect.objectContaining({
          label: "Visible grading failures today",
          tone: "placeholder",
          statusLabel: "Pending telemetry",
          signalType: "placeholder",
        }),
      ]),
    );

    expect(snapshot.failureCards[0]).toEqual(
      expect.objectContaining({
        title: "Grading failures today",
        tone: "placeholder",
        value: "Pending telemetry",
        signalType: "placeholder",
      }),
    );

    expect(snapshot.alertCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Stale grading heartbeat",
          tone: "placeholder",
          value: "0",
          signalType: "placeholder",
        }),
      ]),
    );
  });

  it("shows healthy grading telemetry when real failures count is zero", () => {
    const snapshot = buildOperationalMonitoringSnapshot({
      workflowRunTelemetryAvailable: true,
      workflowRunRows: [
        {
          status: "succeeded",
          startedAt: "2026-05-04T08:00:00.000Z",
          finishedAt: "2026-05-04T08:00:03.000Z",
          durationMs: 3000,
          workflowName: "grade-submission",
          provider: "openai",
          model: "gpt-4o-mini",
          retryCount: 0,
          failureCategory: null,
        },
      ],
      latestGradeRun: "2026-05-04T08:00:00.000Z",
      aiGradingFailures: 0,
      moderationRows: [],
      submissions: [],
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

    expect(snapshot.healthItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Visible grading failures today",
          tone: "healthy",
          statusLabel: "0",
          signalType: "live",
        }),
      ]),
    );

    expect(snapshot.failureCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Grading failures today",
          tone: "healthy",
          value: "0",
          signalType: "live",
        }),
      ]),
    );

    expect(snapshot.alertCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Failed provider calls",
          tone: "healthy",
          value: "0",
          signalType: "live",
        }),
        expect.objectContaining({
          title: "Email delivery failures",
          tone: "healthy",
          value: "0",
          signalType: "live",
        }),
      ]),
    );
  });

  it("shows warning grading telemetry when one or more failures are recorded", () => {
    const snapshot = buildOperationalMonitoringSnapshot({
      workflowRunTelemetryAvailable: true,
      workflowRunRows: [
        {
          status: "succeeded",
          startedAt: "2026-05-04T08:00:00.000Z",
          finishedAt: "2026-05-04T08:00:03.000Z",
          durationMs: 3000,
          workflowName: "grade-submission",
          provider: "openai",
          model: "gpt-4o-mini",
          retryCount: 1,
          failureCategory: null,
        },
      ],
      latestGradeRun: "2026-05-04T08:00:00.000Z",
      aiGradingFailures: 3,
      moderationRows: [],
      submissions: [],
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

    expect(snapshot.healthItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Visible grading failures today",
          tone: "warning",
          statusLabel: "3",
          signalType: "live",
        }),
      ]),
    );

    expect(snapshot.failureCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Grading failures today",
          tone: "warning",
          value: "3",
          signalType: "live",
        }),
      ]),
    );

    expect(snapshot.alertCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Failed provider calls",
          tone: "healthy",
          value: "0",
          signalType: "live",
        }),
      ]),
    );
  });
});
