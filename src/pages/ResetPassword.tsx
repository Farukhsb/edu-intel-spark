import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const getHashParams = () => {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(hash);
};

const getRecoveryParams = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = getHashParams();

  return {
    code: searchParams.get("code"),
    tokenHash: searchParams.get("token_hash") ?? hashParams.get("token_hash"),
    type: searchParams.get("type") ?? hashParams.get("type"),
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token"),
    errorCode: searchParams.get("error_code") ?? hashParams.get("error_code"),
  };
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [linkChecked, setLinkChecked] = useState(false);
  const [isRecovered, setIsRecovered] = useState(false);

  useEffect(() => {
    let mounted = true;

    const markReady = (ready: boolean) => {
      if (!mounted) return;
      setRecoveryReady(ready);
      setLinkChecked(true);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        markReady(true);
        return;
      }

      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") && session) {
        markReady(true);
      }
    });

    const initializeRecovery = async () => {
      const {
        code,
        tokenHash,
        type,
        accessToken,
        refreshToken,
        errorCode,
      } = getRecoveryParams();

      const { data: initialSession } = await supabase.auth.getSession();
      if (initialSession.session) {
        markReady(true);
        return;
      }

      const isRecoveryFlow = type === "recovery";
      if (!isRecoveryFlow || errorCode) {
        markReady(false);
        return;
      }

      let error = null;

      if (code) {
        ({ error } = await supabase.auth.exchangeCodeForSession(code));
      } else if (tokenHash) {
        ({ error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        }));
      } else if (accessToken && refreshToken) {
        ({ error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }));
      } else {
        markReady(false);
        return;
      }

      if (error) {
        markReady(false);
        return;
      }

      const { data: restoredSession } = await supabase.auth.getSession();
      if (!mounted) return;

      if (restoredSession.session) {
        window.history.replaceState({}, document.title, "/reset-password");
        markReady(true);
        return;
      }

      markReady(false);
    };

    void initializeRecovery();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      const isWeakOrCompromised =
        error.message.toLowerCase().includes("weak") ||
        error.message.toLowerCase().includes("compromised") ||
        error.message.toLowerCase().includes("hibp") ||
        error.status === 422;

      toast({
        title: isWeakOrCompromised ? "Password not secure enough" : "Password reset failed",
        description: isWeakOrCompromised
          ? "This password has appeared in a data breach and cannot be used. Please choose a stronger, unique password."
          : error.message,
        variant: "destructive",
      });
      return;
    }

    setIsRecovered(true);
    toast({
      title: "Password updated",
      description: "You can now sign in with your new password.",
    });

    window.history.replaceState({}, document.title, "/reset-password");
    setTimeout(() => navigate("/auth"), 1200);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <Button asChild variant="ghost" className="w-fit">
          <Link to="/auth">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to login
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <KeyRound className="h-6 w-6" />
            </div>
            <CardTitle>Choose a new password</CardTitle>
            <CardDescription>
              Set a fresh password for your account and sign back in securely.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!linkChecked ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Verifying your reset link...
              </div>
            ) : !recoveryReady ? (
              <Alert>
                <AlertTitle>Invalid or expired link</AlertTitle>
                <AlertDescription>
                  Request a new password reset email and open the latest link directly in your browser, since some email apps can consume one-time reset links early.
                </AlertDescription>
              </Alert>
            ) : isRecovered ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Password updated</AlertTitle>
                <AlertDescription>
                  Redirecting you to sign in with your new password.
                </AlertDescription>
              </Alert>
            ) : (
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
                  {loading ? "Updating password..." : "Update password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
