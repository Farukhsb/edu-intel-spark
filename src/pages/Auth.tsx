import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonLoadingLabel } from "@/components/ui/loading-state";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAuthReadiness } from "@/lib/authReadiness";
import { DEPARTMENT_OPTIONS } from "@/lib/departmentOptions";
import { COHORT_LEVELS } from "@/lib/formatters";

const getErrorMessage = (message: string): string => {
  if (message.includes("already registered") || message.includes("already been registered")) return "This email is already registered. Try signing in instead.";
  if (message.includes("Invalid login")) return "Invalid email or password.";
  if (message.includes("Email not confirmed")) return "Please check your email to confirm your account.";
  if (message.includes("rate limit") || message.includes("too many")) return "Too many attempts. Please wait a moment and try again.";
  return message || "Something went wrong. Please try again.";
};

const getErrorFromUnknown = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong. Please try again.";

const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 15;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[a-z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  if (score < 30) return { score, label: "Weak", color: "bg-destructive" };
  if (score < 60) return { score, label: "Fair", color: "bg-warning" };
  if (score < 80) return { score, label: "Good", color: "bg-primary" };
  return { score: 100, label: "Strong", color: "bg-success" };
};

const Auth = () => {
  const { signIn, signUp, resetPassword, resendVerification, pendingVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState<"lecturer" | "student">("student");
  const [signupCohort, setSignupCohort] = useState("");
  const [signupDepartment, setSignupDepartment] = useState("");

  const passwordStrength = getPasswordStrength(signupPassword);
  const readiness = getAuthReadiness({
    forgotPassword: showForgotPassword,
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast({ title: "Missing fields", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await signIn(loginEmail, loginPassword);
      navigate("/dashboard");
    } catch (err) {
      toast({ title: "Login failed", description: getErrorMessage(getErrorFromUnknown(err)), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    if (signupPassword.length < 8) {
      toast({ title: "Weak password", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (signupRole === "student" && !signupCohort) {
      toast({ title: "Missing level", description: "Please select your level/year.", variant: "destructive" });
      return;
    }
    if (!signupDepartment) {
      toast({ title: "Missing department", description: "Please select your department.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await signUp(
        signupEmail,
        signupPassword,
        signupName,
        signupRole,
        signupCohort,
        signupDepartment
      );

      if (result.requiresEmailConfirmation) {
        toast({
          title: "Account created",
          description: "Please check your email to confirm your account before signing in.",
        });
        return;
      }

      toast({ title: "Account created!", description: "Welcome to GradeAI." });
      navigate("/dashboard");
    } catch (err) {
      toast({ title: "Signup failed", description: getErrorMessage(getErrorFromUnknown(err)), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast({ title: "Email required", description: "Please enter your email.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await resetPassword(resetEmail);
      toast({ title: "Reset email sent", description: "Check your inbox for a password reset link to choose a new password." });
      setShowForgotPassword(false);
    } catch (err) {
      toast({ title: "Reset failed", description: getErrorMessage(getErrorFromUnknown(err)), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      await resendVerification();
      toast({
        title: "Verification email resent",
        description: pendingVerificationEmail
          ? `Check ${pendingVerificationEmail} for a new confirmation link.`
          : "Check your inbox for a new confirmation link.",
      });
    } catch (err) {
      toast({
        title: "Resend failed",
        description: getErrorMessage(getErrorFromUnknown(err)),
        variant: "destructive",
      });
    } finally {
      setResendingVerification(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <Button variant="ghost" onClick={() => setShowForgotPassword(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to login
          </Button>
          <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
            <CardContent className="grid gap-4 p-6">
              <div className="rounded-lg border bg-background/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Access Readiness</p>
                <p className="mt-2 text-sm font-semibold">{readiness.postureLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">{readiness.likelyChallenge}</p>
                <p className="mt-3 text-sm font-medium">{readiness.bestNextAction}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>Enter your email and we'll send a reset link</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@university.ac.uk" required />
                </div>
                <Button className="w-full" type="submit" disabled={loading}>
                  {loading ? <ButtonLoadingLabel label="Sending..." /> : "Send Reset Link"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Brain className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold">GradeAI</h1>
          <p className="text-muted-foreground">AI-Powered Academic Marking & Intelligence Platform</p>
        </div>

        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <CardContent className="grid gap-4 p-6">
            <div className="rounded-lg border bg-background/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Access Readiness</p>
              <p className="mt-2 text-sm font-semibold">{readiness.postureLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{readiness.likelyChallenge}</p>
              <p className="mt-3 text-sm font-medium">{readiness.bestNextAction}</p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue={pendingVerificationEmail ? "signup" : "login"} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>Sign in to your account</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@university.ac.uk" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input id="login-password" type={showPassword ? "text" : "password"} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowForgotPassword(true)}>
                    Forgot password?
                  </button>
                  <Button className="w-full" type="submit" disabled={loading}>
                    {loading ? <ButtonLoadingLabel label="Signing in..." /> : "Sign In"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card>
              <CardHeader>
                <CardTitle>Create account</CardTitle>
                <CardDescription>Join GradeAI as a lecturer or student</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingVerificationEmail ? (
                  <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <p className="text-sm font-semibold">Email confirmation pending</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      We are waiting for {pendingVerificationEmail} to confirm the account before sign-in.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3"
                      onClick={handleResendVerification}
                      disabled={resendingVerification}
                    >
                      {resendingVerification ? <ButtonLoadingLabel label="Resending..." /> : "Resend verification email"}
                    </Button>
                  </div>
                ) : null}
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name *</Label>
                    <Input id="signup-name" value={signupName} onChange={(e) => setSignupName(e.target.value)} placeholder="Dr. Jane Smith" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email *</Label>
                    <Input id="signup-email" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} placeholder="you@university.ac.uk" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password * (min 8 characters)</Label>
                    <div className="relative">
                      <Input id="signup-password" type={showPassword ? "text" : "password"} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} minLength={8} required />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {signupPassword.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Strength</span>
                          <span className={passwordStrength.score >= 80 ? "text-success" : passwordStrength.score >= 60 ? "text-primary" : "text-destructive"}>
                            {passwordStrength.label}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${passwordStrength.color}`} style={{ width: `${passwordStrength.score}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>I am a *</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["lecturer", "student"] as const).map((r) => (
                        <button key={r} type="button" onClick={() => setSignupRole(r)} className={`rounded-lg border-2 p-3 text-center text-sm font-medium capitalize transition-colors ${signupRole === r ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Department *</Label>
                    <Select value={signupDepartment} onValueChange={setSignupDepartment}>
                      <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENT_OPTIONS.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {signupRole === "student" && (
                    <div className="space-y-2">
                      <Label>Level / Year *</Label>
                      <Select value={signupCohort} onValueChange={setSignupCohort}>
                        <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                        <SelectContent>
                          {COHORT_LEVELS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button className="w-full" type="submit" disabled={loading}>
                    {loading ? <ButtonLoadingLabel label="Creating account..." /> : "Create Account"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you are using a pilot academic platform.
          {" "}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Read the privacy notice
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default Auth;
