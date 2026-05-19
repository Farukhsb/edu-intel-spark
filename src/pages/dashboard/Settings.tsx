import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ButtonLoadingLabel } from "@/components/ui/loading-state";
import { User, Shield } from "lucide-react";
import { getDepartmentName } from "@/lib/department";
import {
  DEPARTMENT_OPTIONS,
  OTHER_DEPARTMENT_OPTION,
  resolveDepartmentValue,
} from "@/lib/departmentOptions";
import { COHORT_LEVELS, formatCohortLevel } from "@/lib/formatters";
import { isLecturerEquivalentRole } from "@/lib/roles";
import { getSettingsReadiness } from "@/lib/settingsReadiness";
import { log } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { profile, signOut, updateProfile } = useAuth();
  const { toast } = useToast();
  const departmentName = getDepartmentName(profile);
  const profileDepartmentSelection =
    departmentName && DEPARTMENT_OPTIONS.includes(departmentName as (typeof DEPARTMENT_OPTIONS)[number])
      ? departmentName
      : departmentName
        ? OTHER_DEPARTMENT_OPTION
        : "";
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [selectedDepartmentName, setSelectedDepartmentName] = useState(profileDepartmentSelection);
  const [customDepartmentName, setCustomDepartmentName] = useState(
    profileDepartmentSelection === OTHER_DEPARTMENT_OPTION ? departmentName ?? "" : "",
  );
  const [cohortId, setCohortId] = useState(profile?.cohort_id ?? "");
  const [saving, setSaving] = useState(false);
  const readiness = getSettingsReadiness({
    role: profile?.role,
    fullName: profile?.full_name,
    email: profile?.email,
    departmentName,
  });

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setSelectedDepartmentName(profileDepartmentSelection);
    setCustomDepartmentName(profileDepartmentSelection === OTHER_DEPARTMENT_OPTION ? departmentName ?? "" : "");
    setCohortId(profile?.cohort_id ?? "");
  }, [departmentName, profile?.cohort_id, profile?.full_name, profileDepartmentSelection]);

  const resetForm = () => {
    setFullName(profile?.full_name ?? "");
    setSelectedDepartmentName(profileDepartmentSelection);
    setCustomDepartmentName(profileDepartmentSelection === OTHER_DEPARTMENT_OPTION ? departmentName ?? "" : "");
    setCohortId(profile?.cohort_id ?? "");
  };

  const handleProfileUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      await updateProfile({
        fullName,
        departmentName: resolveDepartmentValue(selectedDepartmentName, customDepartmentName),
        cohortId: profile?.role === "student" ? cohortId || null : null,
      });
      toast({
        title: "Profile updated",
        description: "Your account details have been saved.",
      });
    } catch (error) {
      log.error("Failed to update profile settings", error, {
        userId: profile?.id,
      });
      toast({
        title: "Profile update failed",
        description: "Your changes could not be saved. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold font-display">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-base">Account Setup</CardTitle>
          <CardDescription>
            Check that your profile details are complete and that your role is set correctly for this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 pt-0 md:grid-cols-3">
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current position</p>
            <p className="mt-2 text-sm font-semibold">{readiness.postureLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Based on your role and the account details currently available on your profile.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What to check</p>
            <p className="mt-2 text-sm font-semibold">{readiness.likelyChallenge}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This is the setup issue most likely to affect what parts of the platform you can use cleanly.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next step</p>
            <p className="mt-2 text-sm font-semibold">{readiness.bestNextAction}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use this to decide whether everything is ready to use or whether an account setup issue needs attention.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </CardTitle>
          <CardDescription>Your institution-managed account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{profile?.full_name || "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{profile?.email || "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant={isLecturerEquivalentRole(profile?.role) ? "default" : "secondary"}>
              {profile?.role || "-"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Department</span>
            <span className="text-sm font-medium">{departmentName || "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Level / Cohort</span>
            <span className="text-sm font-medium">{formatCohortLevel(profile?.cohort_id)}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            These details are managed by your institution or platform administrator. If your name, department, role, or
            level is incorrect, contact an administrator to request a correction.
          </p>

          <form onSubmit={handleProfileUpdate} className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="settings-full-name">Full name</Label>
              <Input
                id="settings-full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-department">Department</Label>
              <Select
                value={selectedDepartmentName}
                onValueChange={(value) => {
                  setSelectedDepartmentName(value);
                  if (value !== OTHER_DEPARTMENT_OPTION) {
                    setCustomDepartmentName("");
                  }
                }}
              >
                <SelectTrigger id="settings-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedDepartmentName === OTHER_DEPARTMENT_OPTION ? (
              <div className="space-y-2">
                <Label htmlFor="settings-custom-department">Please specify your department</Label>
                <Input
                  id="settings-custom-department"
                  value={customDepartmentName}
                  onChange={(event) => setCustomDepartmentName(event.target.value)}
                  placeholder="Enter your department"
                />
              </div>
            ) : null}
            {profile?.role === "student" ? (
              <div className="space-y-2">
                <Label htmlFor="settings-cohort">Level / Cohort</Label>
                <Select value={cohortId} onValueChange={setCohortId}>
                  <SelectTrigger id="settings-cohort">
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
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <ButtonLoadingLabel label="Saving..." /> : "Save Profile"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Role Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your role controls which academic records and workflows you can access. For governance and security reasons,
            role changes are handled by an administrator.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={signOut}>
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
