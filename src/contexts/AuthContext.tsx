import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { posthog } from "@/lib/posthog";
import type { User } from "@supabase/supabase-js";

type AppRole = "lecturer" | "student";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  avatar_url: string | null;
  cohort_id: string | null;
  department_id: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  profileError: string | null;
  isDemo: boolean;
  signUp: (email: string, password: string, fullName: string, role: AppRole, cohortId?: string, departmentId?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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
  department_id: null,
};

const DEMO_STUDENT_PROFILE: Profile = {
  id: "demo-student",
  full_name: "Demo Student",
  email: "student@gradeai.com",
  role: "student",
  avatar_url: null,
  cohort_id: "200",
  department_id: "Computer Science",
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const fetchProfile = async (userId: string, email: string | undefined) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (data) {
      setProfile({
        id: data.id,
        full_name: data.full_name,
        email: data.email ?? email ?? null,
        role: data.role === "lecturer" ? "lecturer" : "student",
        avatar_url: data.avatar_url,
        cohort_id: null,
        department_id: null,
      });
      posthog.identify(userId, { email });
    } else {
      setProfileError("Profile not found");
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user.email).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isDemo) return;
      if (session?.user) {
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
  }, [isDemo]);

  const signUp = async (email: string, password: string, fullName: string, role: AppRole, cohortId?: string, departmentId?: string) => {
    if (password.length < 8) throw new Error("Password must be at least 8 characters");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Signup failed");

    // The handle_new_user trigger creates the profile automatically.
    // Set profile optimistically.
    setProfile({
      id: data.user.id,
      full_name: fullName,
      email,
      role,
      avatar_url: null,
      cohort_id: role === "student" ? (cohortId || null) : null,
      department_id: departmentId || null,
    });
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const handleSignOut = async () => {
    if (isDemo) {
      setIsDemo(false);
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
    setProfile(null);
    setProfileError(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const resendVerification = async () => {
    // Supabase auto-confirms, so this is a no-op
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
        user: isDemo ? ({ id: profile?.id, email: profile?.email } as any) : user,
        profile,
        role: profile?.role ?? null,
        loading,
        profileError,
        isDemo,
        signUp,
        signIn,
        signOut: handleSignOut,
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
