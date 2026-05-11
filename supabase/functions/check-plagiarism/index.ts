import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, jsonError, requireLecturer } from "../_shared/auth.ts";
import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { registerCheckPlagiarismEntrypoint } from "./bootstrap.ts";

registerCheckPlagiarismEntrypoint({
  serve,
  createAdminClient,
  requireLecturer,
  jsonError,
  getCorsHeaders,
  createCorsForbiddenResponse,
});
