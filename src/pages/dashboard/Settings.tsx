import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { User, Shield, Loader2 } from "lucide-react";

const Settings = () => {
  const { profile, updateRole, signOut } = useAuth();
  const [newRole, setNewRole] = useState(profile?.role || "student");
  const [saving, setSaving] = useState(false);

  const handleRoleUpdate = async () => {
    if (newRole === profile?.role) {
      toast.info("Role is already set to " + newRole);
      return;
    }
    setSaving(true);
    try {
      await updateRole(newRole as "lecturer" | "student");
      toast.success(`Role updated to ${newRole}. The page will reload.`);
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      console.error("Role update failed:", err);
      toast.error("Failed to update role: " + (err?.message || "Unknown error"));
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{profile?.full_name || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{profile?.email || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Role</span>
            <Badge variant={profile?.role === "lecturer" ? "default" : "secondary"}>
              {profile?.role || "—"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Role Management
          </CardTitle>
          <CardDescription>Change your account role. This determines which dashboard and features you see.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lecturer">Lecturer</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleRoleUpdate} disabled={saving || newRole === profile?.role}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Updating..." : "Update Role"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Changing your role will reload the page to apply the new dashboard layout.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
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
