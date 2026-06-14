import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { updateAdminManagedUserProfile } from "@/lib/adminUsers";
import { log } from "@/lib/logger";

import type { AdminManagedProfileInput, AdminUserRow, PendingRoleChange } from "../types";
import { getFunctionErrorMessage } from "./actions.helpers";

export const runRoleChange = async ({
  pendingRoleChange,
  reload,
  close,
}: {
  pendingRoleChange: PendingRoleChange;
  reload: () => Promise<void>;
  close: () => void;
}) => {
  if (!pendingRoleChange) return;

  try {
    const { error } = await supabase.functions.invoke("admin-set-user-role", {
      body: {
        targetUserId: pendingRoleChange.userId,
        nextRole: pendingRoleChange.nextRole,
      },
    });

    if (error) throw error;

    toast.success(`${pendingRoleChange.fullName || "User"} is now set to ${pendingRoleChange.nextRole}.`);
    close();
    await reload();
  } catch (error) {
    log.error("Failed to update user role", error, {
      targetUserId: pendingRoleChange?.userId,
      nextRole: pendingRoleChange?.nextRole,
    });
    toast.error(await getFunctionErrorMessage(error, "Role change could not be completed."));
    throw error;
  }
};

export const runRoleMetadataSync = async ({
  targetUser,
  reload,
}: {
  targetUser: AdminUserRow;
  reload: () => Promise<void>;
}) => {
  try {
    const { error } = await supabase.functions.invoke("admin-set-user-role", {
      body: {
        targetUserId: targetUser.id,
        syncOnly: true,
      },
    });

    if (error) throw error;

    toast.success(`Auth metadata synced for ${targetUser.fullName || "user"}.`);
    await reload();
  } catch (error) {
    log.error("Failed to sync auth metadata for user", error, {
      targetUserId: targetUser.id,
    });
    toast.error(await getFunctionErrorMessage(error, "Auth metadata could not be synced."));
    throw error;
  }
};

export const runManagedProfileSave = async ({
  input,
  reload,
  close,
}: {
  input: AdminManagedProfileInput;
  reload: () => Promise<void>;
  close: () => void;
}) => {
  try {
    await updateAdminManagedUserProfile(input);
    toast.success(`Profile updated for ${input.fullName.trim() || "user"}.`);
    close();
    await reload();
  } catch (error) {
    log.error("Failed to update managed user profile", error, {
      targetUserId: input.targetUserId,
    });
    toast.error("User profile could not be updated.");
    throw error;
  }
};
