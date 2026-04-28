import type { User } from "@supabase/supabase-js";
import { log } from "@/lib/logger";
import { parseAppRole, type AppRole } from "@/lib/roles";

export const E2E_AUTH_STORAGE_KEY = "gradeai:e2e-auth";

export type E2EAuthRole = AppRole;

export interface E2EAuthProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: E2EAuthRole;
  avatar_url: string | null;
  cohort_id: string | null;
  department_id: string | null;
}

interface E2EAuthState {
  user: {
    id: string;
    email?: string | null;
  };
  profile: E2EAuthProfile;
}

const LOCAL_E2E_HOSTS = new Set(["localhost", "127.0.0.1"]);

const isLocalE2EHost = () =>
  typeof window !== "undefined" && LOCAL_E2E_HOSTS.has(window.location.hostname);

export const readE2EAuthState = (): E2EAuthState | null => {
  if (!isLocalE2EHost()) return null;

  try {
    const raw = window.localStorage.getItem(E2E_AUTH_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<E2EAuthState>;
    if (
      !parsed?.user?.id ||
      !parsed?.profile?.id ||
      !parseAppRole(parsed?.profile?.role)
    ) {
      return null;
    }

    return {
      user: {
        id: parsed.user.id,
        email: parsed.user.email ?? parsed.profile.email ?? undefined,
      },
      profile: {
        id: parsed.profile.id,
        full_name: parsed.profile.full_name ?? null,
        email: parsed.profile.email ?? null,
        role: parseAppRole(parsed.profile.role)!,
        avatar_url: parsed.profile.avatar_url ?? null,
        cohort_id: parsed.profile.cohort_id ?? null,
        department_id: parsed.profile.department_id ?? null,
      },
    };
  } catch (error) {
    log.warn("Failed to parse local e2e auth state", {
      host: window.location.hostname,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
};

export const clearE2EAuthState = () => {
  if (!isLocalE2EHost()) return;
  window.localStorage.removeItem(E2E_AUTH_STORAGE_KEY);
};

export const createE2EUser = (state: E2EAuthState): User =>
  ({
    id: state.user.id,
    email: state.user.email ?? undefined,
  }) as unknown as User;

export const getE2EAuthenticatedUserId = () => readE2EAuthState()?.user.id ?? null;
