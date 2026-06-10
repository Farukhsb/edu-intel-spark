// @vitest-environment node

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const env = new Map<string, string>();

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/log.ts", () => ({
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}));

vi.stubGlobal("fetch", mocks.fetch);

import {
  escapeHtml,
  formatAssignmentPublishedEmail,
  formatGradeReleasedEmail,
  formatGradingCompleteEmail,
  formatSubmissionNotificationEmail,
  getAppBaseUrl,
  sendEmail,
} from "../../supabase/functions/_shared/email";

describe("email coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.clear();
    vi.stubGlobal("Deno", {
      env: {
        get: (name: string) => env.get(name),
      },
    });
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.fetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("formats helper emails and escapes HTML safely", () => {
    expect(escapeHtml(`<b>"O'Brian"&</b>`)).toBe("&lt;b&gt;&quot;O&#39;Brian&quot;&amp;&lt;/b&gt;");

    const published = formatAssignmentPublishedEmail({
      studentName: "Sam Student",
      assignmentTitle: "Algorithms <Essay>",
      dueDate: "2026-06-01",
      assignmentUrl: "https://gradeai.test/dashboard/assignments/1?tab=review",
    });
    const released = formatGradeReleasedEmail({
      studentName: null,
      assignmentTitle: "Algorithms <Essay>",
      assignmentUrl: "https://gradeai.test/dashboard/explain-grade?source=email",
    });
    const graded = formatGradingCompleteEmail({
      lecturerName: "Dr Lecturer",
      assignmentTitle: "Algorithms <Essay>",
      gradedCount: 5,
      failedCount: 1,
      reviewUrl: "https://gradeai.test/dashboard/review",
    });
    const submission = formatSubmissionNotificationEmail({
      lecturerName: null,
      assignmentTitle: "Algorithms <Essay>",
      studentName: "Sam Student",
      submittedAt: "2026-06-01T10:00:00.000Z",
      reviewUrl: "https://gradeai.test/dashboard/review",
    });

    expect(published.subject).toBe("New assignment published");
    expect(published.text).toContain("Algorithms <Essay>");
    expect(published.html).toContain("Algorithms &lt;Essay&gt;");
    expect(released.subject).toBe("Feedback released");
    expect(graded.text).toContain("Graded successfully: 5");
    expect(submission.text).toContain("Hello,");
  });

  it("returns the default app base url when no env value is set", () => {
    expect(getAppBaseUrl()).toBe("https://edu-intel-spark.pages.dev");
  });

  it("returns a custom app base url when configured", () => {
    env.set("APP_BASE_URL", "https://gradeai.test");
    expect(getAppBaseUrl()).toBe("https://gradeai.test");
  });

  it("skips sending when notifications are disabled", async () => {
    env.set("EMAIL_NOTIFICATIONS_ENABLED", "false");

    const result = await sendEmail({
      to: "student@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
    });

    expect(result).toEqual({ skipped: true });
    expect(mocks.logInfo).toHaveBeenCalledWith("[email] notifications disabled, skipping send", {
      subject: "Hello",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("skips sending when the resend api key is missing", async () => {
    env.set("EMAIL_NOTIFICATIONS_ENABLED", "true");

    const result = await sendEmail({
      to: "student@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
    });

    expect(result).toEqual({ skipped: true });
    expect(mocks.logWarn).toHaveBeenCalledWith("[email] RESEND_API_KEY missing, skipping send");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("sends an email successfully when the resend request succeeds", async () => {
    env.set("EMAIL_NOTIFICATIONS_ENABLED", "true");
    env.set("RESEND_API_KEY", "resend-key");
    env.set("EMAIL_FROM_ADDRESS", "GradeAI <notifications@gradeai.app>");
    mocks.fetch.mockResolvedValueOnce(
      new Response("", {
        status: 200,
      }),
    );

    const result = await sendEmail({
      to: "student@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(result).toEqual({ success: true });
    expect(mocks.fetch).toHaveBeenCalledWith("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer resend-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GradeAI <notifications@gradeai.app>",
        to: ["student@example.com"],
        subject: "Hello",
        html: "<p>Hello</p>",
        text: "Hello",
      }),
    });
    expect(mocks.logInfo).toHaveBeenCalledWith("[email] sent", { subject: "Hello" });
  });

  it("throws when resend returns a non-ok response", async () => {
    env.set("EMAIL_NOTIFICATIONS_ENABLED", "true");
    env.set("RESEND_API_KEY", "resend-key");
    mocks.fetch.mockResolvedValueOnce(
      new Response("nope", {
        status: 500,
      }),
    );

    await expect(
      sendEmail({
        to: "student@example.com",
        subject: "Hello",
        html: "<p>Hello</p>",
      }),
    ).rejects.toThrow("[email] resend error 500");
  });
});
