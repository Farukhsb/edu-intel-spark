import type { createAdminClient, jsonError, requireLecturer } from "../_shared/auth.ts";
import type { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { createCheckPlagiarismHandler } from "./handler.ts";

type CheckPlagiarismBootstrapDeps = {
  serve: (handler: (req: Request) => Response | Promise<Response>) => unknown;
  createAdminClient: typeof createAdminClient;
  requireLecturer: typeof requireLecturer;
  jsonError: typeof jsonError;
  getCorsHeaders: typeof getCorsHeaders;
  createCorsForbiddenResponse: typeof createCorsForbiddenResponse;
};

export function registerCheckPlagiarismEntrypoint(deps: CheckPlagiarismBootstrapDeps) {
  return deps.serve(
    createCheckPlagiarismHandler({
      createAdminClient: deps.createAdminClient,
      requireLecturer: deps.requireLecturer,
      jsonError: deps.jsonError,
      getCorsHeaders: deps.getCorsHeaders,
      createCorsForbiddenResponse: deps.createCorsForbiddenResponse,
    }),
  );
}
