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

    expect(sentryMock.captureAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Error",
        message: "failed to fetch",
      }),
      {
      message: "failed to fetch",
      errorName: "Error",
      assignmentId: "assignment-1",
      feedback: "[REDACTED]",
      submissions: "[REDACTED]",
      },
    );
  });

  it("reports a synthesized safe error instead of the raw thrown error", async () => {
    vi.stubEnv("VITE_APP_ENV", "production");

    const { log } = await import("@/lib/logger");
    const error = new Error("Student essay text: Macbeth response from a3dullahifaruk@gmail.com");
    error.name = "AcademicContentError";

    log.error("Failed to process assignment workflow", error, {
      prompt: "private prompt",
      assignmentId: "assignment-2",
    });

    const [reportedError, reportedContext] = sentryMock.captureAppError.mock.calls[0];

    expect(reportedError).toBeInstanceOf(Error);
    expect(reportedError).not.toBe(error);
    expect((reportedError as Error).name).toBe("AcademicContentError");
    expect((reportedError as Error).message).toBe("Failed to process assignment workflow");
    expect((reportedError as Error).message).not.toContain("Macbeth");
    expect((reportedError as Error).message).not.toContain("a3dullahifaruk@gmail.com");

    expect(reportedContext).toEqual({
      message: "Failed to process assignment workflow",
      errorName: "AcademicContentError",
      prompt: "[REDACTED]",
      assignmentId: "assignment-2",
    });
  });
});
