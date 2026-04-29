// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeEach, vi } from "vitest";

const { invokeMock, warnMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    warn: warnMock,
  },
}));

import { WorkflowEmailRequestSchema } from "@/lib/communications";
import { requirePostMethod } from "../../supabase/functions/_shared/http";
import {
  applyRateLimit,
  resetRateLimitStore,
} from "../../supabase/functions/_shared/rate-limit";

const readRepoFile = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("edge function hardening", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("returns a 405 JSON response for unsupported methods", async () => {
    const response = requirePostMethod(
      new Request("https://gradeai.test/functions/v1/explain-grade", { method: "GET" }),
      { "Access-Control-Allow-Origin": "https://gradeai.pages.dev" },
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(405);
    expect(response?.headers.get("Content-Type")).toBe("application/json");
    expect(response?.headers.get("Allow")).toBe("POST, OPTIONS");
    await expect(response?.json()).resolves.toEqual({ error: "Method not allowed" });
  });

  it("allows POST requests through to existing auth and validation paths", () => {
    const response = requirePostMethod(
      new Request("https://gradeai.test/functions/v1/explain-grade", { method: "POST" }),
      {},
    );

    expect(response).toBeNull();
  });

  it("keeps auth checks before rate limiting on newly limited functions", () => {
    for (const file of [
      "supabase/functions/bulk-create-students/index.ts",
      "supabase/functions/send-workflow-notification-email/index.ts",
    ]) {
      const source = readRepoFile(file);
      const authIndex = Math.max(source.indexOf("requireLecturer(req)"), source.indexOf("requireUser(req)"));
      const rateLimitIndex = source.indexOf("applyRateLimit(req");

      expect(authIndex).toBeGreaterThan(-1);
      expect(rateLimitIndex).toBeGreaterThan(-1);
      expect(authIndex).toBeLessThan(rateLimitIndex);
    }
  });

  it("returns a blocked result for the new bulk student upload rate-limit scope", () => {
    const req = new Request("https://gradeai.test/functions/v1/bulk-create-students", {
      headers: { "x-forwarded-for": "203.0.113.20" },
    });

    applyRateLimit(req, {
      scope: "bulk-create-students",
      limit: 1,
      windowMs: 60_000,
      userId: "lecturer-1",
      now: 1_000,
    });
    const blocked = applyRateLimit(req, {
      scope: "bulk-create-students",
      limit: 1,
      windowMs: 60_000,
      userId: "lecturer-1",
      now: 1_100,
    });

    expect(blocked.allowed).toBe(false);
  });

  it("returns a blocked result for the workflow email rate-limit scope", () => {
    const req = new Request("https://gradeai.test/functions/v1/send-workflow-notification-email", {
      headers: { "x-forwarded-for": "203.0.113.21" },
    });

    applyRateLimit(req, {
      scope: "send-workflow-notification-email",
      limit: 1,
      windowMs: 60_000,
      userId: "lecturer-1",
      now: 2_000,
    });
    const blocked = applyRateLimit(req, {
      scope: "send-workflow-notification-email",
      limit: 1,
      windowMs: 60_000,
      userId: "lecturer-1",
      now: 2_100,
    });

    expect(blocked.allowed).toBe(false);
  });

  it("keeps the existing workflow email request shape valid", () => {
    const result = WorkflowEmailRequestSchema.safeParse({
      category: "grade-released",
      assignmentId: "6f951f5c-2665-48c8-b404-3ef9b6288882",
      submissionId: "985386a6-9981-48eb-8277-568b0ec4957f",
    });

    expect(result.success).toBe(true);
  });

  it("keeps the existing bulk student upload request shape in the edge function schema", () => {
    const source = readRepoFile("supabase/functions/bulk-create-students/index.ts");

    expect(source).toContain("students: z.array(StudentInputSchema)");
    expect(source).toContain("email: z.string().trim().email()");
    expect(source).toContain("name: z.string().trim().min(1)");
    expect(source).toContain("cohort_id: z.string().trim().min(1)");
    expect(source).toContain("department_id: z.string().trim().min(1)");
  });
});
