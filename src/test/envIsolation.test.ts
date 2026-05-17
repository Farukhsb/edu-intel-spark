import { describe, expect, it, vi } from "vitest";

describe("environment bootstrap isolation", () => {
  it("allows the Supabase client module to load before env is needed", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      getEnv: () => {
        throw new Error("Invalid environment configuration: VITE_SUPABASE_URL");
      },
    }));

    const loadClientModule = import("@/integrations/supabase/client");
    await expect(loadClientModule).resolves.toHaveProperty("supabase");

    const { supabase } = await loadClientModule;
    expect(() => supabase.from("profiles")).toThrow(/VITE_SUPABASE_URL/);

    vi.doUnmock("@/lib/env");
  });

  it("allows AuthContext to load before Supabase env is needed", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      getEnv: () => {
        throw new Error("Invalid environment configuration: VITE_SUPABASE_URL");
      },
    }));

    await expect(import("@/contexts/AuthContext")).resolves.toHaveProperty("AuthProvider");

    vi.doUnmock("@/lib/env");
  });
});
