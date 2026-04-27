import { describe, expect, it } from "vitest";

import { parseEnv } from "@/lib/env";

describe("environment validation", () => {
  const baseEnv = {
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    VITE_APP_ENV: "staging",
  };

  it("parses a valid environment shape", () => {
    const parsed = parseEnv(baseEnv);

    expect(parsed.VITE_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(parsed.VITE_SUPABASE_PUBLISHABLE_KEY).toBe("test-publishable-key");
    expect(parsed.VITE_APP_ENV).toBe("staging");
  });

  it("fails when the Supabase URL is missing", () => {
    expect(() =>
      parseEnv({
        VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      }),
    ).toThrow(/VITE_SUPABASE_URL/);
  });

  it("fails when the Supabase URL is invalid", () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        VITE_SUPABASE_URL: "not-a-url",
      }),
    ).toThrow(/VITE_SUPABASE_URL/);
  });

  it("fails when the publishable key is empty", () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        VITE_SUPABASE_PUBLISHABLE_KEY: "",
      }),
    ).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("accepts a valid optional Sentry DSN", () => {
    const parsed = parseEnv({
      ...baseEnv,
      VITE_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
    });

    expect(parsed.VITE_SENTRY_DSN).toBe("https://public@example.ingest.sentry.io/1");
  });

  it("accepts an empty optional Sentry DSN", () => {
    const parsed = parseEnv({
      ...baseEnv,
      VITE_SENTRY_DSN: "",
    });

    expect(parsed.VITE_SENTRY_DSN).toBeUndefined();
  });

  it("defaults app environment to development when missing", () => {
    const parsed = parseEnv({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    });

    expect(parsed.VITE_APP_ENV).toBe("development");
  });
});
