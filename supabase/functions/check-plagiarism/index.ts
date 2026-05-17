import { createAdminClient, jsonError, requireLecturer } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { registerCheckPlagiarismEntrypoint } from "./bootstrap.ts";

registerCheckPlagiarismEntrypoint({
  serve: Deno.serve,
  createAdminClient,
  requireLecturer,
  jsonError,
  getCorsHeaders,
  createCorsForbiddenResponse,
});
