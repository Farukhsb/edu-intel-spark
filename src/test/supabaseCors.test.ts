import { describe, expect, it } from "vitest";
import { createCorsForbiddenResponse, getCorsHeaders } from "../../supabase/functions/_shared/cors";

function makeRequest(origin: string, method = "POST") {
  return new Request("https://example.supabase.co/functions/v1/grade-submission", {
    method,
    headers: { Origin: origin },
  });
}

describe("Supabase shared CORS", () => {
  it("allows the production Cloudflare Pages domain", () => {
    const headers = getCorsHeaders(makeRequest("https://gradeai.pages.dev"));

    expect(headers?.["Access-Control-Allow-Origin"]).toBe("https://gradeai.pages.dev");
  });

  it("allows Cloudflare Pages preview subdomains for this project", () => {
    const req = makeRequest("https://443e6976.gradeai.pages.dev", "OPTIONS");
    const headers = getCorsHeaders(req);
    const response = new Response(null, { headers: headers ?? undefined });

    expect(headers?.["Access-Control-Allow-Origin"]).toBe("https://443e6976.gradeai.pages.dev");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://443e6976.gradeai.pages.dev");
  });

  it("rejects unrelated pages.dev domains", () => {
    const headers = getCorsHeaders(makeRequest("https://evil.pages.dev"));

    expect(headers).toBeNull();
  });

  it("rejects unrelated custom domains", () => {
    const headers = getCorsHeaders(makeRequest("https://example.com"));

    expect(headers).toBeNull();
  });

  it("allows localhost on arbitrary ports for local edge-function development", () => {
    const headers = getCorsHeaders(makeRequest("http://localhost:4173", "OPTIONS"));

    expect(headers?.["Access-Control-Allow-Origin"]).toBe("http://localhost:4173");
  });

  it("allows 127.0.0.1 on arbitrary ports for local edge-function development", () => {
    const headers = getCorsHeaders(makeRequest("http://127.0.0.1:4173", "OPTIONS"));

    expect(headers?.["Access-Control-Allow-Origin"]).toBe("http://127.0.0.1:4173");
  });

  it("returns a forbidden response for rejected origins", async () => {
    const response = createCorsForbiddenResponse();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Origin not allowed" });
  });
});
