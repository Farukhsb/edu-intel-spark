// @vitest-environment node

import { describe, expect, it, beforeEach } from "vitest";

import {
  applyRateLimit,
  applySharedRateLimit,
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

  it("applies a shared global rate limit across different scopes", async () => {
    const counters = new Map<string, { count: number; resetAt: number }>();
    let now = 1_000;
    const adminClient = {
      schema: () => ({
        rpc: async (_fn: string, args: Record<string, unknown>) => {
          const scope = String(args.p_scope);
          const identifier = String(args.p_identifier);
          const limit = Number(args.p_limit);
          const windowSeconds = Number(args.p_window_seconds);
          const key = `${scope}:${identifier}`;
          const current = counters.get(key);

          if (!current || current.resetAt <= now) {
            counters.set(key, {
              count: 1,
              resetAt: now + windowSeconds * 1_000,
            });
            return { data: [{ allowed: true, retry_after_seconds: 0 }], error: null };
          }

          current.count += 1;
          counters.set(key, current);

          if (current.count > limit) {
            return {
              data: [
                {
                  allowed: false,
                  retry_after_seconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
                },
              ],
              error: null,
            };
          }

          return { data: [{ allowed: true, retry_after_seconds: 0 }], error: null };
        },
      }),
    };

    const req = new Request("https://gradeai.test/functions/v1/explain-grade", {
      headers: { "x-forwarded-for": "203.0.113.14" },
    });

    const first = await applySharedRateLimit(adminClient, req, {
      scope: "explain-grade",
      limit: 10,
      windowMs: 60_000,
      userId: "student-1",
      globalLimit: 2,
      globalWindowMs: 60_000,
    });

    now = 1_500;

    const second = await applySharedRateLimit(adminClient, req, {
      scope: "check-plagiarism",
      limit: 10,
      windowMs: 60_000,
      userId: "student-1",
      globalLimit: 2,
      globalWindowMs: 60_000,
    });

    now = 2_000;

    const blocked = await applySharedRateLimit(adminClient, req, {
      scope: "grade-submission",
      limit: 10,
      windowMs: 60_000,
      userId: "student-1",
      globalLimit: 2,
      globalWindowMs: 60_000,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
