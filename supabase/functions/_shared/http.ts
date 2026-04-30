export function createMethodNotAllowedResponse(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      Allow: "POST, OPTIONS",
    },
  });
}

export function requirePostMethod(req: Request, corsHeaders: Record<string, string>) {
  if (req.method === "POST") return null;
  return createMethodNotAllowedResponse(corsHeaders);
}
