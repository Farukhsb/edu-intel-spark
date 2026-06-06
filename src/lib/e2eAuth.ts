import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { getDepartmentName } from "@/lib/department";
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
  institution_id: string | null;
  cohort_id: string | null;
  department_name: string | null;
  department_id: string | null;
  must_change_password: boolean;
}

interface E2EAuthState {
  user: {
    id: string;
    email?: string | null;
  };
  profile: E2EAuthProfile;
}

const E2EAuthStateSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    email: z.string().email().nullable().optional(),
  }),
  profile: z.object({
    id: z.string().min(1),
    full_name: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    role: z.enum(["lecturer", "student", "admin"]),
    avatar_url: z.string().nullable().optional(),
    institution_id: z.string().nullable().optional(),
    cohort_id: z.string().nullable().optional(),
    department_name: z.string().nullable().optional(),
    department_id: z.string().nullable().optional(),
    must_change_password: z.boolean().optional(),
  }),
});

const LOCAL_E2E_HOSTS = new Set(["localhost", "127.0.0.1"]);

const isLocalE2EHost = () =>
  typeof window !== "undefined" && LOCAL_E2E_HOSTS.has(window.location.hostname);

export const readE2EAuthState = (): E2EAuthState | null => {
  if (!isLocalE2EHost()) return null;

  try {
    const raw = window.localStorage.getItem(E2E_AUTH_STORAGE_KEY);
    if (!raw) return null;

    const parsed = E2EAuthStateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return null;
    }

    const role = parseAppRole(parsed.data.profile.role);
    if (!role) return null;

    const departmentName = getDepartmentName(parsed.data.profile);

    return {
      user: {
        id: parsed.data.user.id,
        email: parsed.data.user.email ?? parsed.data.profile.email ?? undefined,
      },
      profile: {
        id: parsed.data.profile.id,
        full_name: parsed.data.profile.full_name ?? null,
        email: parsed.data.profile.email ?? null,
        role,
        avatar_url: parsed.data.profile.avatar_url ?? null,
        institution_id: parsed.data.profile.institution_id ?? null,
        cohort_id: parsed.data.profile.cohort_id ?? null,
        department_name: departmentName,
        department_id: departmentName,
        must_change_password: parsed.data.profile.must_change_password ?? false,
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
