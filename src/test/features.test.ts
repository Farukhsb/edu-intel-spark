import { describe, expect, it, vi } from "vitest";

describe("feature flags", () => {
  it("defaults telemetry features to disabled", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_ANALYTICS_ENABLED", undefined);
    vi.stubEnv("VITE_SENTRY_DSN", undefined);
    vi.stubEnv("VITE_APP_ENV", undefined);

    const { getAppEnvironment, getTelemetryFeatures } = await import("@/lib/features");

    expect(getAppEnvironment()).toBe("development");
    expect(getTelemetryFeatures()).toEqual({
      analyticsEnabled: false,
      sentryDsn: undefined,
      sentryEnabled: false,
    });
  });

  it("reads enabled telemetry flags when configured", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_ANALYTICS_ENABLED", "true");
    vi.stubEnv("VITE_SENTRY_DSN", "https://public@example.ingest.sentry.io/1");
    vi.stubEnv("VITE_APP_ENV", "production");

    const { getAppEnvironment, getTelemetryFeatures } = await import("@/lib/features");

    expect(getAppEnvironment()).toBe("production");
    expect(getTelemetryFeatures()).toEqual({
      analyticsEnabled: true,
      sentryDsn: "https://public@example.ingest.sentry.io/1",
      sentryEnabled: true,
    });
  });
});
