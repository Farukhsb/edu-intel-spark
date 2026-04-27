import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMock = vi.hoisted(() => ({
  captureAppError: vi.fn(),
}));

vi.mock("@/lib/sentry", () => ({
  captureAppError: sentryMock.captureAppError,
}));

describe("logger", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("emits debug and info logs in development", async () => {
    vi.stubEnv("VITE_APP_ENV", "development");
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const { log } = await import("@/lib/logger");
    log.debug("debug message", { module: "test" });
    log.info("info message", { module: "test" });

    expect(debugSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
  });

  it("suppresses debug and info logs outside development", async () => {
    vi.stubEnv("VITE_APP_ENV", "production");
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const { log } = await import("@/lib/logger");
    log.debug("debug message");
    log.info("info message");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("reports errors through the capture path with redacted context", async () => {
    vi.stubEnv("VITE_APP_ENV", "production");

    const { log } = await import("@/lib/logger");
    const error = new Error("boom");
    log.error("failed to fetch", error, {
      assignmentId: "assignment-1",
      feedback: "private feedback",
      submissions: ["s1", "s2"],
    });

    expect(sentryMock.captureAppError).toHaveBeenCalledWith(error, {
      message: "failed to fetch",
      assignmentId: "assignment-1",
      feedback: "[REDACTED]",
      submissions: "[REDACTED]",
    });
  });
});
