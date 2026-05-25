import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";

export type AdminManagedProfileUpdate = {
  targetUserId: string;
  fullName: string;
  role: AppRole;
  departmentName: string | null;
  cohortId: string | null;
  mustChangePassword: boolean;
};

export const updateAdminManagedUserProfile = async ({
  targetUserId,
  fullName,
  role,
  departmentName,
  cohortId,
  mustChangePassword,
}: AdminManagedProfileUpdate) => {
  const { error } = await supabase.rpc("admin_update_user_profile", {
    target_user_id: targetUserId,
    new_full_name: fullName,
    new_role: role,
    new_department_name: departmentName,
    new_cohort_id: cohortId,
    new_must_change_password: mustChangePassword,
  });

  if (error) {
    throw error;
  }
};
