import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { safeFormatDate } from "@/lib/date";
import { formatCohortLevel } from "@/lib/formatters";

import type { SelectedUserPreview } from "../types";
import { ROLE_BADGE_STYLES, toStatusBadgeClass } from "./shared";

export const UserSummaryDialog = ({
  user,
  onOpenChange,
}: {
  user: SelectedUserPreview;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>User summary</DialogTitle>
        <DialogDescription>
          Admin-safe profile summary. Detailed student activity remains on lecturer-scoped pages and should be exposed through a dedicated admin detail view later.
        </DialogDescription>
      </DialogHeader>
      {user ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</p>
              <p className="mt-2 text-sm font-medium">{user.fullName || "Unknown user"}</p>
            </div>
            <div className="rounded-xl border border-border/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
              <p className="mt-2 text-sm font-medium">{user.email || "Not available"}</p>
            </div>
            <div className="rounded-xl border border-border/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</p>
              <div className="mt-2">
                <Badge variant="outline" className={`capitalize ${toStatusBadgeClass(user.role, ROLE_BADGE_STYLES)}`}>
                  {user.role}
                </Badge>
              </div>
            </div>
            <div className="rounded-xl border border-border/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</p>
              <p className="mt-2 text-sm font-medium">{user.departmentName || "Not set"}</p>
            </div>
            <div className="rounded-xl border border-border/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Level / Cohort</p>
              <p className="mt-2 text-sm font-medium">{formatCohortLevel(user.cohortId)}</p>
            </div>
            <div className="rounded-xl border border-border/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Password reset required?</p>
              <p className="mt-2 text-sm font-medium">{user.mustChangePassword ? "Required" : "No"}</p>
            </div>
            <div className="rounded-xl border border-border/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Joined</p>
              <p className="mt-2 text-sm font-medium">
                {safeFormatDate(user.createdAt, "MMM d, yyyy", "Not available")}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            Role changes should remain confirmed and logged. Cross-platform user activity, account disabling, and reset workflows are not wired into this admin screen yet.
          </div>
        </div>
      ) : null}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
