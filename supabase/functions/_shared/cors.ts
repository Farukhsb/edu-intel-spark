const ALLOWED_ORIGINS = new Set([
  "https://gradeai.pages.dev",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
]);

const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function getCorsHeaders(req: Request): Record<string, string> | null {
  const origin = req.headers.get("Origin");

  if (!origin) {
    return {
      ...BASE_CORS_HEADERS,
    };
  }

  if (!ALLOWED_ORIGINS.has(origin)) {
    return null;
  }

  return {
    ...BASE_CORS_HEADERS,
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}

export function createCorsForbiddenResponse() {
  return new Response(
    JSON.stringify({ error: "Origin not allowed" }),
    {
      status: 403,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
