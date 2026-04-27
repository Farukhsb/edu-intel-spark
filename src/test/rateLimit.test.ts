// @vitest-environment node

import { describe, expect, it, beforeEach } from "vitest";

import {
  applyRateLimit,
  createRateLimitResponse,
  getRateLimitIdentity,
  resetRateLimitStore,
} from "../../supabase/functions/_shared/rate-limit";

describe("edge function rate limiting", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("allows requests below the limit", () => {
    const req = new Request("https://gradeai.test/functions/v1/explain-grade", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    const first = applyRateLimit(req, {
      scope: "explain-grade",
      limit: 2,
      windowMs: 60_000,
      userId: "student-1",
      now: 1_000,
    });
    const second = applyRateLimit(req, {
      scope: "explain-grade",
      limit: 2,
      windowMs: 60_000,
      userId: "student-1",
      now: 1_500,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });

  it("returns a blocked result once the limit is exceeded", () => {
    const req = new Request("https://gradeai.test/functions/v1/grade-submission", {
      headers: { "x-forwarded-for": "203.0.113.11" },
    });

    applyRateLimit(req, {
      scope: "grade-submission",
      limit: 1,
      windowMs: 60_000,
      userId: "lecturer-1",
      now: 5_000,
    });

    const blocked = applyRateLimit(req, {
      scope: "grade-submission",
      limit: 1,
      windowMs: 60_000,
      userId: "lecturer-1",
      now: 5_100,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("falls back to request IP when no authenticated user ID is available", () => {
    const req = new Request("https://gradeai.test/functions/v1/check-plagiarism", {
      headers: { "x-forwarded-for": "203.0.113.12, 203.0.113.13" },
    });

    const identity = getRateLimitIdentity(req);

    expect(identity.identifierType).toBe("ip");
    expect(identity.key).toBe("ip:203.0.113.12");
  });

  it("fails safely to an anonymous bucket when no user or IP is available", () => {
    const req = new Request("https://gradeai.test/functions/v1/check-plagiarism");

    const identity = getRateLimitIdentity(req);
    const blocked = applyRateLimit(req, {
      scope: "check-plagiarism",
      limit: 1,
      windowMs: 60_000,
      now: 8_000,
    });
    const blockedAgain = applyRateLimit(req, {
      scope: "check-plagiarism",
      limit: 1,
      windowMs: 60_000,
      now: 8_100,
    });

    expect(identity.identifierType).toBe("anonymous");
    expect(blocked.allowed).toBe(true);
    expect(blockedAgain.allowed).toBe(false);
  });

  it("returns a safe 429 response without internal details", async () => {
    const response = createRateLimitResponse({ "Access-Control-Allow-Origin": "*" }, 42);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(body).toEqual({ error: "Too many requests" });
    expect(JSON.stringify(body)).not.toMatch(/submission|grade|student|internal/i);
  });
});
