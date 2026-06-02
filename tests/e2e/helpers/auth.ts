import type { Page } from "@playwright/test";

const STORAGE_KEY = "gradeai:e2e-auth";

type Role = "admin" | "lecturer" | "student";

interface AuthStateOptions {
  role: Role;
  id: string;
  email: string;
  fullName: string;
  cohortId?: string | null;
  departmentId?: string | null;
}

export const setE2EAuth = async (page: Page, options: AuthStateOptions) => {
  const authState = {
    user: {
      id: options.id,
      email: options.email,
    },
    profile: {
      id: options.id,
      full_name: options.fullName,
      email: options.email,
      role: options.role,
      avatar_url: null,
      cohort_id: options.cohortId ?? null,
      department_id: options.departmentId ?? null,
    },
  };

  await page.addInitScript(
    ({ storageKey, authState }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(authState));
    },
    {
      storageKey: STORAGE_KEY,
      authState,
    }
  );

  try {
    await page.evaluate(
      ({ storageKey, authState }) => {
        window.localStorage.setItem(storageKey, JSON.stringify(authState));
      },
      {
        storageKey: STORAGE_KEY,
        authState,
      },
    );
  } catch {
    // The initial Playwright page can be about:blank with an opaque origin.
    // In that case the init script still seeds the next real navigation.
  }
};
