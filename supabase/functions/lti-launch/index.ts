import { createCorsForbiddenResponse, getCorsHeaders } from "../_shared/cors.ts";
import { getEnv } from "../_shared/env.ts";
import { logError } from "../_shared/log.ts";
import { parseLtiLaunch } from "../lms-sync/lti13/launch.ts";
import { requirePostMethod } from "../_shared/http.ts";
import { encodeLtiLaunchState } from "./state.ts";

function jsonResponse(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function resolveAppBaseUrl() {
  return (
    getEnv("APP_BASE_URL")?.trim() ||
    getEnv("PUBLIC_APP_URL")?.trim() ||
    getEnv("APP_URL")?.trim() ||
    getEnv("SITE_URL")?.trim() ||
    "https://gradeai.pages.dev"
  );
}

function buildLaunchState(launch: Awaited<ReturnType<typeof parseLtiLaunch>>) {
  return encodeLtiLaunchState({
    provider: launch.provider,
    issuer: launch.issuer,
    targetPath: "/dashboard",
    launchedAt: new Date().toISOString(),
    roles: launch.roles,
    contextId: launch.contextId,
    resourceLinkId: launch.resourceLinkId,
    messageType: launch.messageType,
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (!corsHeaders) return createCorsForbiddenResponse();

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return jsonResponse(
      {
        success: true,
        message: "LTI launch service is ready.",
      },
      200,
      corsHeaders,
    );
  }

  const methodCheck = requirePostMethod(req, corsHeaders);
  if (methodCheck) {
    return methodCheck;
  }

  try {
    const launch = await parseLtiLaunch(req);
    const appBaseUrl = resolveAppBaseUrl().replace(/\/+$/, "");
    const state = buildLaunchState(launch);
    const redirectUrl = new URL("/lti/launch", appBaseUrl);
    redirectUrl.searchParams.set("state", state);

    return new Response(null, {
      status: 303,
      headers: {
        ...corsHeaders,
        Location: redirectUrl.toString(),
      },
    });
  } catch (error) {
    logError("lti-launch error", error);
    const message = error instanceof Error ? error.message : "Failed to process LTI launch";
    return jsonResponse({ error: message }, error instanceof Error ? 400 : 500, corsHeaders);
  }
});
