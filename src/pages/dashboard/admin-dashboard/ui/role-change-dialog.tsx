import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { PendingRoleChange } from "../types";

export const RoleChangeDialog = ({
  pendingRoleChange,
  changingUserId,
  refreshing,
  onOpenChange,
  onConfirm,
}: {
  pendingRoleChange: PendingRoleChange;
  changingUserId: string | null;
  refreshing: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) => (
  <AlertDialog open={Boolean(pendingRoleChange)} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Confirm role change</AlertDialogTitle>
        <AlertDialogDescription>
          {pendingRoleChange ? (
            <>
              Change <strong>{pendingRoleChange.fullName || "this user"}</strong> from{" "}
              <strong>{pendingRoleChange.currentRole}</strong> to <strong>{pendingRoleChange.nextRole}</strong>? This updates
              the profile role and backend mapping together and should remain auditable.
            </>
          ) : null}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={Boolean(changingUserId)}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          disabled={Boolean(changingUserId || refreshing)}
          onClick={(event) => {
            event.preventDefault();
            onConfirm();
          }}
        >
          {changingUserId ? "Updating..." : "Confirm Change"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
