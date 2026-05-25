import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: mocks.signUp,
    },
  },
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    VITE_APP_ENV: "development",
    VITE_ANALYTICS_ENABLED: false,
    VITE_INSTITUTION_SLUG: "uni-alpha",
  }),
}));

import { signUpWithPassword } from "@/contexts/auth/auth-actions";

describe("auth actions", () => {
  beforeEach(() => {
    mocks.signUp.mockReset();
    mocks.signUp.mockResolvedValue({
      data: {
        user: { id: "user-1" },
        session: null,
      },
      error: null,
    });
  });

  it("includes the configured institution slug in signup metadata", async () => {
    await signUpWithPassword({
      email: "student@example.edu",
      password: "StrongPass123!",
      fullName: "Student Ada",
      role: "student",
      cohortId: "year1",
      departmentName: "Computer Science",
    });

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "student@example.edu",
      password: "StrongPass123!",
      options: {
        data: {
          full_name: "Student Ada",
          role: "student",
          cohort_id: "year1",
          institution_slug: "uni-alpha",
          department_name: "Computer Science",
          department_id: "Computer Science",
        },
      },
    });
  });
});
