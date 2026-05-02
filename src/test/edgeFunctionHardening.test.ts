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
import { sanitizeVisibleAiFeedback } from "../../supabase/functions/_shared/visible-feedback";

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

  it("removes fairness adjustment boilerplate from visible AI feedback", () => {
    expect(
      sanitizeVisibleAiFeedback(
        "Strong evidence and clear structure.\n\nInitial AI score was inconsistent with feedback. A fairness adjustment was applied.",
      ),
    ).toBe("Strong evidence and clear structure.");

    expect(
      sanitizeVisibleAiFeedback(
        "Detailed analysis.\n\n[Initial AI score was inconsistent with feedback. A fairness adjustment was applied.]",
      ),
    ).toBe("Detailed analysis.");

    expect(
      sanitizeVisibleAiFeedback(
        "Lecturer review recommended: borderline mark.\n\nInitial AI score was inconsistent with UK marking bands. A fairness recalibration was applied and lecturer review is recommended.",
      ),
    ).toBe("Lecturer review recommended: borderline mark.");
  });

  it("keeps explicit browser auth headers for direct edge-function fetch calls", () => {
    const assignmentDetailSource = readRepoFile("src/pages/dashboard/AssignmentDetail.tsx");
    const explainGradeSource = readRepoFile("src/pages/dashboard/ExplainGrade.tsx");

    expect(assignmentDetailSource).toContain("PLAGIARISM_CHECK_URL");
    expect(assignmentDetailSource).toContain("supabase.auth.getSession()");
    expect(assignmentDetailSource).toContain("apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(assignmentDetailSource).toContain("Authorization: `Bearer ${session.access_token}`");

    expect(explainGradeSource).toContain("supabase.auth.getSession()");
    expect(explainGradeSource).toContain("apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(explainGradeSource).toContain("Authorization: `Bearer ${accessToken}`");
  });

  it("keeps internal similarity fallback logic non-fatal inside check-plagiarism", () => {
    const source = readRepoFile("supabase/functions/check-plagiarism/index.ts");

    expect(source).toContain('const shouldRunInternalProvider = providerMode === "internal_text_similarity" || providerMode === "both";');
    expect(source).toContain("if (shouldRunInternalProvider && requestedAssignmentId && submissions.length >= 2)");
    expect(source).toContain('logInfo("internal_similarity_started"');
    expect(source).toContain('logInfo("internal_similarity_completed"');
    expect(source).toContain('logError("internal_similarity_pair_failed"');
    expect(source).toContain('logError("internal_similarity_insert_failed"');
    expect(source).toContain("Internal similarity evidence could not be stored, but analysis completed.");
    expect(source).toContain(".filter((finding) =>");
  });
});
