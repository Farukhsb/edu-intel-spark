import { logError } from "../_shared/log.ts";
import { HttpError, requireAdmin } from "../_shared/auth.ts";
import { resolveLmsSyncConfig } from "./config.ts";
import { LmsIntegrationError } from "./errors.ts";
import { runLmsSync } from "./jobs/run-sync.ts";
import type { LmsSyncRequest, LmsSyncResponse } from "./types.ts";

type LmsSyncBootstrapDeps = {
  serve: (handler: (req: Request) => Response | Promise<Response>) => unknown;
};

function jsonResponse(body: LmsSyncResponse, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readyResponse() {
  const config = resolveLmsSyncConfig();
  return jsonResponse({
    success: true,
    provider: config.defaultProvider,
    syncMode: "full",
    message: "LMS sync service is ready.",
    summary: {
      coursesSynced: 0,
      assignmentsSynced: 0,
      submissionsSynced: 0,
      gradesSynced: 0,
      eventsSynced: 0,
    },
    warnings: config.enabled ? [] : ["LMS sync is disabled."],
  });
}

export function registerLmsSyncEntrypoint(deps: LmsSyncBootstrapDeps) {
  return deps.serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    if (req.method === "GET") {
      return readyResponse();
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", Allow: "GET, POST, OPTIONS" },
      });
    }

    try {
      await requireAdmin(req);
      const body = await req.json().catch(() => null) as Partial<LmsSyncRequest> | null;
      if (!body || typeof body !== "object") {
        throw new LmsIntegrationError("Request body is required.");
      }

      const provider = body.provider || resolveLmsSyncConfig().defaultProvider;
      if (body.assignmentId && !body.courseId) {
        throw new LmsIntegrationError("assignmentId requires courseId for LMS sync.");
      }
      const response = await runLmsSync({
        provider,
        institutionId: typeof body.institutionId === "string" ? body.institutionId : undefined,
        institutionSlug: typeof body.institutionSlug === "string" ? body.institutionSlug : undefined,
        courseId: typeof body.courseId === "string" ? body.courseId : undefined,
        assignmentId: typeof body.assignmentId === "string" ? body.assignmentId : undefined,
        syncMode: body.syncMode || "incremental",
      });

      return jsonResponse(response);
    } catch (error) {
      logError("lms-sync error", error);
      const message = error instanceof LmsIntegrationError ? error.message : "Failed to process LMS sync request";
      return new Response(JSON.stringify({ error: message }), {
        status: error instanceof HttpError ? error.status : 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}
