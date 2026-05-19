import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEPARTMENT_OPTIONS } from "@/lib/departmentOptions";
import { COHORT_LEVELS } from "@/lib/formatters";
import type { AppRole } from "@/lib/roles";

import type { AdminManagedProfileInput, AdminUserRow } from "../types";

const MANAGED_ROLE_OPTIONS: AppRole[] = ["student", "lecturer", "admin"];

export const EditUserProfileDialog = ({
  user,
  saving,
  onSave,
  onOpenChange,
}: {
  user: AdminUserRow | null;
  saving: boolean;
  onSave: (input: AdminManagedProfileInput) => void;
  onOpenChange: (open: boolean) => void;
}) => {
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState<AppRole>("student");
  const [departmentName, setDepartmentName] = React.useState("");
  const [cohortId, setCohortId] = React.useState("");
  const [mustChangePassword, setMustChangePassword] = React.useState(false);
  const departmentOptions =
    departmentName && !DEPARTMENT_OPTIONS.includes(departmentName as (typeof DEPARTMENT_OPTIONS)[number])
      ? [departmentName, ...DEPARTMENT_OPTIONS]
      : DEPARTMENT_OPTIONS;

  React.useEffect(() => {
    setFullName(user?.fullName ?? "");
    setRole(user?.role ?? "student");
    setDepartmentName(user?.departmentName ?? "");
    setCohortId(user?.cohortId ?? "");
    setMustChangePassword(user?.mustChangePassword ?? false);
  }, [user]);

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update institution-managed profile fields. Email, auth-provider identity, and account creation records are intentionally read-only here.
          </DialogDescription>
        </DialogHeader>
        {user ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-edit-full-name">Full name</Label>
              <Input id="admin-edit-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-edit-role">Role</Label>
              <Select
                value={role}
                onValueChange={(value: AppRole) => {
                  setRole(value);
                  if (value !== "student") {
                    setCohortId("");
                  }
                }}
              >
                <SelectTrigger id="admin-edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {MANAGED_ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-edit-department">Department</Label>
              <Select value={departmentName} onValueChange={setDepartmentName}>
                <SelectTrigger id="admin-edit-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departmentOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {role === "student" ? (
              <div className="space-y-2">
                <Label htmlFor="admin-edit-cohort">Level / Cohort</Label>
                <Select value={cohortId} onValueChange={setCohortId}>
                  <SelectTrigger id="admin-edit-cohort">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {COHORT_LEVELS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="flex items-center justify-between rounded-xl border border-border/70 p-4">
              <div className="space-y-1">
                <Label htmlFor="admin-edit-must-change-password">Password reset required?</Label>
                <p className="text-sm text-muted-foreground">Require the user to change their password before entering the dashboard again.</p>
              </div>
              <Switch
                id="admin-edit-must-change-password"
                checked={mustChangePassword}
                onCheckedChange={setMustChangePassword}
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving || !user}
            onClick={() =>
              user &&
              onSave({
                targetUserId: user.id,
                fullName,
                role,
                departmentName: departmentName || null,
                cohortId: role === "student" ? cohortId || null : null,
                mustChangePassword,
              })
            }
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
