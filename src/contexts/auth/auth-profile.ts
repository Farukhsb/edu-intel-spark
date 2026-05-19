import { supabase } from "@/integrations/supabase/client";
import { getDepartmentName } from "@/lib/department";
import { posthog } from "@/lib/posthog";
import { parseAppRole } from "@/lib/roles";

import type { Profile } from "./types";

const PROFILE_FETCH_RETRY_COUNT = 5;
const PROFILE_FETCH_RETRY_DELAY_MS = 400;

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  avatar_url: string | null;
  cohort_id: string | null;
  department_name: string | null;
  department_id: string | null;
  must_change_password: boolean | null;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchProfileRow = async (userId: string): Promise<ProfileRow | null> => {
  let data: ProfileRow | null = null;

  for (let attempt = 0; attempt < PROFILE_FETCH_RETRY_COUNT; attempt++) {
    const result = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    data = result.data;
    if (data) break;

    if (attempt < PROFILE_FETCH_RETRY_COUNT - 1) {
      await wait(PROFILE_FETCH_RETRY_DELAY_MS);
    }
  }

  return data;
};

export const fetchAuthProfile = async ({
  userId,
  email,
}: {
  userId: string;
  email?: string;
}): Promise<{ profile: Profile | null; profileError: string | null }> => {
  const data = await fetchProfileRow(userId);

  if (!data) {
    return { profile: null, profileError: "Profile not found" };
  }

  const resolvedRole = parseAppRole(data.role);
  if (!resolvedRole) {
    return { profile: null, profileError: `Unsupported role: ${data.role}` };
  }

  const departmentName = getDepartmentName(data);
  const profile: Profile = {
    id: data.id,
    full_name: data.full_name,
    email: data.email ?? email ?? null,
    role: resolvedRole,
    avatar_url: data.avatar_url,
    cohort_id: data.cohort_id ?? null,
    department_name: departmentName,
    // Keep the compatibility mirror populated until legacy reads are removed.
    department_id: departmentName,
    must_change_password: data.must_change_password ?? false,
  };

  posthog.identify(userId);
  return { profile, profileError: null };
};
