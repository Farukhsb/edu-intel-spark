import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ButtonLoadingLabel } from "@/components/ui/loading-state";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const ForcePasswordChange = () => {
  const navigate = useNavigate();
  const { mustChangePassword, completePasswordChange, signOut } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!mustChangePassword) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Use at least 8 characters for your new password.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Make sure both password fields are identical.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await completePasswordChange(password);
      toast({
        title: "Password updated",
        description: "Your account is now ready for normal dashboard access.",
      });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast({
        title: "Password update failed",
        description: error instanceof Error ? error.message : "Your password could not be updated right now.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className="border-amber-300/50 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="p-6">
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Password change required</AlertTitle>
              <AlertDescription>
                This account is still using a temporary onboarding credential. Set a new password before you continue into the dashboard.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Set your permanent password</CardTitle>
            <CardDescription>
              Your temporary onboarding password cannot be used for normal access beyond this step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? <ButtonLoadingLabel label="Updating password..." /> : "Update password"}
              </Button>
            </form>

            <Button
              variant="ghost"
              className="mt-4 w-full"
              onClick={() => {
                void signOut();
              }}
            >
              Sign out instead
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForcePasswordChange;
