import { describe, expect, it } from "vitest";

import { buildOperationalMonitoringSnapshot } from "@/lib/operationalMonitoring";

describe("operationalMonitoring", () => {
  it("builds warning-oriented failure cards from observable workflow backlog", () => {
    const snapshot = buildOperationalMonitoringSnapshot({
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
      emailNotificationsVisible: true,
      emailNotificationsCount: 4,
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

    expect(snapshot.healthItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "AI grading workflow signal",
          tone: "warning",
          statusLabel: "Signal is stale",
          signalType: "inferred",
        }),
        expect.objectContaining({
          label: "Notification records",
          tone: "healthy",
          statusLabel: "Records visible",
          signalType: "live",
        }),
      ]),
    );
  });

  it("keeps placeholder language when direct telemetry is unavailable", () => {
    const snapshot = buildOperationalMonitoringSnapshot({
      latestGradeRun: null,
      aiGradingFailures: null,
      moderationRows: [],
      submissions: [],
      emailNotificationsVisible: false,
      emailNotificationsCount: 0,
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
  });

  it("shows healthy grading telemetry when real failures count is zero", () => {
    const snapshot = buildOperationalMonitoringSnapshot({
      latestGradeRun: "2026-05-04T08:00:00.000Z",
      aiGradingFailures: 0,
      moderationRows: [],
      submissions: [],
      emailNotificationsVisible: true,
      emailNotificationsCount: 1,
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
  });

  it("shows warning grading telemetry when one or more failures are recorded", () => {
    const snapshot = buildOperationalMonitoringSnapshot({
      latestGradeRun: "2026-05-04T08:00:00.000Z",
      aiGradingFailures: 3,
      moderationRows: [],
      submissions: [],
      emailNotificationsVisible: true,
      emailNotificationsCount: 1,
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
  });
});
