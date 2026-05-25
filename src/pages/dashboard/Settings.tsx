import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { getDepartmentName } from "@/lib/department";
import { formatCohortLevel } from "@/lib/formatters";
import { isLecturerEquivalentRole, isStudentRole } from "@/lib/roles";
import { getSettingsReadiness } from "@/lib/settingsReadiness";

const Settings = () => {
  const { profile, signOut } = useAuth();
  const departmentName = getDepartmentName(profile);
  const isStudent = isStudentRole(profile?.role);
  const isLecturerEquivalent = isLecturerEquivalentRole(profile?.role);
  const readiness = getSettingsReadiness({
    role: profile?.role,
    fullName: profile?.full_name,
    email: profile?.email,
    departmentName,
  });

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
            <Badge variant={isLecturerEquivalent ? "default" : "secondary"}>
              {profile?.role || "-"}
            </Badge>
          </div>
          {isStudent ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Department</span>
                <span className="text-sm font-medium">{departmentName || "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Level / Cohort</span>
                <span className="text-sm font-medium">{formatCohortLevel(profile?.cohort_id)}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                These details are managed by your institution or platform administrator. If your name, department, role,
                or level is incorrect, contact an administrator to request a correction.
              </p>
            </>
          ) : (
            <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
              <div>
                <p className="text-sm font-medium">Academic Profile</p>
                <p className="text-sm text-muted-foreground">
                  These details are managed by your institution or platform administrator. If your name, department,
                  role, or level is incorrect, contact an administrator to request a correction.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Department</span>
                <span className="text-sm font-medium">{departmentName || "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Role</span>
                <Badge variant={isLecturerEquivalent ? "default" : "secondary"}>{profile?.role || "-"}</Badge>
              </div>
            </div>
          )}
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
          <CardTitle className="text-base">Legal and pilot guidance</CardTitle>
          <CardDescription>
            Read the current pilot terms, privacy position, and data-handling expectations for this platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/privacy">Privacy Notice</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/terms">Terms of Service</Link>
          </Button>
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
