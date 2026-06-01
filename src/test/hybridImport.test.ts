import { afterEach, describe, expect, it, vi } from "vitest";

import { isHybridGradeImportEnabled } from "@/lib/hybridImport";

describe("hybrid import flag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to enabled when the VITE flag is blank", () => {
    vi.stubEnv("VITE_HYBRID_IMPORT_ENABLED", "");

    expect(isHybridGradeImportEnabled()).toBe(true);
  });

  it("respects explicit disable values", () => {
    vi.stubEnv("VITE_HYBRID_IMPORT_ENABLED", "false");

    expect(isHybridGradeImportEnabled()).toBe(false);
  });

  it("accepts enabled values", () => {
    vi.stubEnv("VITE_HYBRID_IMPORT_ENABLED", "true");

    expect(isHybridGradeImportEnabled()).toBe(true);
  });
});
