import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMock = vi.hoisted(() => ({
  captureAppError: vi.fn(),
}));

vi.mock("@/lib/sentry", () => ({
  captureAppError: sentryMock.captureAppError,
}));

describe("shared log helpers coverage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("logs info and warnings with and without context", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { logInfo, logWarn } = await import("../../supabase/functions/_shared/log");

    logInfo("hello");
    logInfo("hello with context", { assignmentId: "assignment-1" });
    logWarn("warn");
    logWarn("warn with context", { fileName: "submission.pdf" });

    expect(consoleLog).toHaveBeenCalledWith("hello");
    expect(consoleLog).toHaveBeenCalledWith("hello with context", { assignmentId: "assignment-1" });
    expect(consoleWarn).toHaveBeenCalledWith("warn");
    expect(consoleWarn).toHaveBeenCalledWith("warn with context", { fileName: "submission.pdf" });
  });

  it("serializes errors and captures errors with redacted context", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { logError: sharedLogError } = await import("../../supabase/functions/_shared/log");

    sharedLogError("plain failure");
    sharedLogError("string failure", "boom");
    sharedLogError("object failure", {
      message: "Supabase error",
      code: "42501",
      status: 403,
      hint: undefined,
    });

    expect(consoleError).toHaveBeenCalledWith("plain failure");
    expect(consoleError).toHaveBeenCalledWith("string failure", {
      error: { message: "boom" },
    });
    expect(consoleError).toHaveBeenCalledWith("object failure", {
      error: { message: "Supabase error", code: "42501", status: 403 },
    });
  });
});
