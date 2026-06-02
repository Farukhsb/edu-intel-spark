import { afterEach, describe, expect, it, vi } from "vitest";

import { getSiteUrl } from "@/lib/seo";

describe("seo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to window.location.origin when VITE_APP_URL is unset", () => {
    vi.stubEnv("VITE_APP_URL", "");

    expect(getSiteUrl()).toBe(window.location.origin);
  });

  it("uses VITE_APP_URL when it is configured", () => {
    vi.stubEnv("VITE_APP_URL", "https://example.edu/");

    expect(getSiteUrl()).toBe("https://example.edu");
  });
});
