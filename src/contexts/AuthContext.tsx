import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { posthog } from "@/lib/posthog";
import { clearE2EAuthState, createE2EUser, readE2EAuthState } from "@/lib/e2eAuth";
import { getPasswordResetRedirectUrl } from "@/lib/authUrls";
import { getDepartmentName, toDepartmentColumns } from "@/lib/department";
import { env } from "@/lib/env";
import { parseAppRole, type AppRole, type PublicSignupRole } from "@/lib/roles";
import type { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  avatar_url: string | null;
  cohort_id: string | null;
  department_name: string | null;
  department_id: string | null;
  must_change_password: boolean;
}

const PROFILE_FETCH_RETRY_COUNT = 5;
const PROFILE_FETCH_RETRY_DELAY_MS = 400;

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  profileError: string | null;
  isDemo: boolean;
  mustChangePassword: boolean;
  pendingVerificationEmail: string | null;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: PublicSignupRole,
    cohortId?: string,
    departmentId?: string
  ) => Promise<{ requiresEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  completePasswordChange: (password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  enterDemo: (demoRole: AppRole) => void;
  exitDemo: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const DEMO_LECTURER_PROFILE: Profile = {
  id: "demo-lecturer",
  full_name: "Dr. Demo Lecturer",
  email: "demo@gradeai.com",
  role: "lecturer",
  avatar_url: null,
  cohort_id: null,
  department_name: null,
  department_id: null,
  must_change_password: false,
};

const DEMO_STUDENT_PROFILE: Profile = {
  id: "demo-student",
  full_name: "Demo Student",
  email: "student@gradeai.com",
  role: "student",
  avatar_url: null,
  cohort_id: "200",
  department_name: "Computer Science",
  department_id: "Computer Science",
  must_change_password: false,
};

const createDemoUser = (profile: Profile | null): User =>
  ({
    id: profile?.id ?? "demo-user",
    email: profile?.email ?? undefined,
  }) as unknown as User;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const fetchProfile = async (userId: string, email: string | undefined) => {
    let data: {
      id: string;
      full_name: string | null;
      email: string | null;
      role: string | null;
      avatar_url: string | null;
      cohort_id: string | null;
      department_name: string | null;
      department_id: string | null;
      must_change_password: boolean | null;
    } | null = null;

    for (let attempt = 0; attempt < PROFILE_FETCH_RETRY_COUNT; attempt++) {
      const result = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      data = result.data;
      if (data) break;

      if (attempt < PROFILE_FETCH_RETRY_COUNT - 1) {
        await wait(PROFILE_FETCH_RETRY_DELAY_MS);
      }
    }

    if (data) {
      const resolvedRole = parseAppRole(data.role);
      if (!resolvedRole) {
        setProfile(null);
        setProfileError(`Unsupported role: ${data.role}`);
        return;
      }

      const departmentName = getDepartmentName(data);

      setProfile({
        id: data.id,
        full_name: data.full_name,
        email: data.email ?? email ?? null,
        role: resolvedRole,
        avatar_url: data.avatar_url,
        cohort_id: data.cohort_id ?? null,
        department_name: departmentName,
        department_id: departmentName,
        must_change_password: data.must_change_password ?? false,
      });
      setProfileError(null);
      posthog.identify(userId);
    } else {
      setProfile(null);
      setProfileError("Profile not found");
    }
  };

  useEffect(() => {
    const e2eAuthState = readE2EAuthState();
    if (e2eAuthState) {
      setIsDemo(false);
      setUser(createE2EUser(e2eAuthState));
      setProfile(e2eAuthState.profile);
      setProfileError(null);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setPendingVerificationEmail(null);
        setUser(session.user);
        fetchProfile(session.user.id, session.user.email).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isDemo) return;

      if (event === "PASSWORD_RECOVERY" && location.pathname !== "/reset-password") {
        navigate(`/reset-password${window.location.search}${window.location.hash}`, { replace: true });
      }

      if (session?.user) {
        setPendingVerificationEmail(null);
        setUser(session.user);
        fetchProfile(session.user.id, session.user.email).finally(() => setLoading(false));
      } else {
        setUser(null);
        setProfile(null);
        setProfileError(null);
        posthog.reset();
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [isDemo, location.pathname, navigate]);

  const refreshProfile = async () => {
    if (!user || isDemo) return;
    await fetchProfile(user.id, user.email);
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: PublicSignupRole,
    cohortId?: string,
    departmentId?: string
  ) => {
    if (password.length < 8) throw new Error("Password must be at least 8 characters");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          cohort_id: role === "student" ? (cohortId || null) : null,
          ...toDepartmentColumns(departmentId),
        },
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Signup failed");

    const hasActiveSession = Boolean(data.session);

    if (hasActiveSession) {
      setPendingVerificationEmail(null);
      setProfile({
        id: data.user.id,
        full_name: fullName,
        email,
        role,
        avatar_url: null,
        cohort_id: role === "student" ? (cohortId || null) : null,
        ...toDepartmentColumns(departmentId),
        must_change_password: false,
      });
    } else {
      setPendingVerificationEmail(email);
    }

    return {
      requiresEmailConfirmation: !hasActiveSession,
    };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setPendingVerificationEmail(null);
  };

  const handleSignOut = async () => {
    if (readE2EAuthState()) {
      clearE2EAuthState();
      setUser(null);
      setProfile(null);
      setProfileError(null);
      setPendingVerificationEmail(null);
      setLoading(false);
      return;
    }

    if (isDemo) {
      setIsDemo(false);
      setProfile(null);
      setPendingVerificationEmail(null);
      return;
    }
    await supabase.auth.signOut();
    setProfile(null);
    setProfileError(null);
    setPendingVerificationEmail(null);
  };

  const completePasswordChange = async (password: string) => {
    if (!user) {
      throw new Error("You must be signed in to update your password.");
    }

    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) throw authError;

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);

    if (profileUpdateError) {
      throw new Error("Your password was updated, but the account security check could not be completed. Please sign in again and try once more.");
    }

    setProfile((current) => (current ? { ...current, must_change_password: false } : current));
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetRedirectUrl({
        origin: window.location.origin,
        configuredAppUrl: env.VITE_APP_URL,
      }),
    });
    if (error) throw error;
  };

  const resendVerification = async () => {
    if (!pendingVerificationEmail) {
      throw new Error("No pending verification email is available. Create your account again or contact support.");
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingVerificationEmail,
    });
    if (error) throw error;
  };

  const enterDemo = (demoRole: AppRole) => {
    setIsDemo(true);
    setProfile(demoRole === "lecturer" ? DEMO_LECTURER_PROFILE : DEMO_STUDENT_PROFILE);
    setLoading(false);
  };

  const exitDemo = () => {
    setIsDemo(false);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user: isDemo ? createDemoUser(profile) : user,
        profile,
        role: profile?.role ?? null,
        loading,
        profileError,
        isDemo,
        mustChangePassword: profile?.must_change_password ?? false,
        pendingVerificationEmail,
        signUp,
        signIn,
        signOut: handleSignOut,
        completePasswordChange,
        refreshProfile,
        resetPassword,
        resendVerification,
        enterDemo,
        exitDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
