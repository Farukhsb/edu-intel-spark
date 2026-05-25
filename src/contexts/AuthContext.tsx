import React, { createContext, useContext, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { AppRole, PublicSignupRole } from "@/lib/roles";
import type { User } from "@supabase/supabase-js";
import {
  clearStoredE2EAuth,
  completePasswordChangeForUser,
  getDemoProfile,
  resendSignupVerification,
  sendPasswordResetEmail,
  signInWithPassword,
  signOutAuthSession,
  signUpWithPassword,
} from "@/contexts/auth/auth-actions";
import { fetchAuthProfile } from "@/contexts/auth/auth-profile";
import { useAuthSessionSync } from "@/contexts/auth/auth-session";
import type { AuthContextType, Profile } from "@/contexts/auth/types";
export type { AuthContextType, Profile } from "@/contexts/auth/types";

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
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

  useAuthSessionSync({
    isDemo,
    locationPathname: location.pathname,
    navigate,
    setUser,
    setProfile,
    setProfileError,
    setPendingVerificationEmail,
    setLoading,
    setIsDemo,
  });

  const refreshProfile = async () => {
    if (!user || isDemo) return;
    const result = await fetchAuthProfile({ userId: user.id, email: user.email });
    setProfile(result.profile);
    setProfileError(result.profileError);
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: PublicSignupRole,
    cohortId?: string,
    departmentName?: string
  ) => {
    const { requiresEmailConfirmation, initialProfile } = await signUpWithPassword({
      email,
      password,
      fullName,
      role,
      cohortId,
      departmentName,
    });

    if (initialProfile) {
      setPendingVerificationEmail(null);
      setProfile(initialProfile);
    } else {
      setPendingVerificationEmail(email);
    }

    return {
      requiresEmailConfirmation,
    };
  };

  const signIn = async (email: string, password: string) => {
    await signInWithPassword(email, password);
    setPendingVerificationEmail(null);
  };

  const handleSignOut = async () => {
    if (clearStoredE2EAuth()) {
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
    await signOutAuthSession();
    setProfile(null);
    setProfileError(null);
    setPendingVerificationEmail(null);
  };

  const completePasswordChange = async (password: string) => {
    if (!user) {
      throw new Error("You must be signed in to update your password.");
    }

    await completePasswordChangeForUser({ userId: user.id, password });
    setProfile((current) => (current ? { ...current, must_change_password: false } : current));
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(email);
  };

  const resendVerification = async () => {
    await resendSignupVerification(pendingVerificationEmail);
  };

  const enterDemo = (demoRole: AppRole) => {
    setIsDemo(true);
    setProfile(getDemoProfile(demoRole));
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
