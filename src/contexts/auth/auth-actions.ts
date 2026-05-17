import { clearE2EAuthState, readE2EAuthState } from "@/lib/e2eAuth";
import { getPasswordResetRedirectUrl } from "@/lib/authUrls";
import { toDepartmentColumns } from "@/lib/department";
import { supabase } from "@/integrations/supabase/client";

import type { AppRole, PublicSignupRole } from "@/lib/roles";
import type { Profile } from "./types";

export const signUpWithPassword = async ({
  email,
  password,
  fullName,
  role,
  cohortId,
  departmentId,
}: {
  email: string;
  password: string;
  fullName: string;
  role: PublicSignupRole;
  cohortId?: string;
  departmentId?: string;
}) => {
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
  const initialProfile: Profile | null = hasActiveSession
    ? {
        id: data.user.id,
        full_name: fullName,
        email,
        role,
        avatar_url: null,
        cohort_id: role === "student" ? (cohortId || null) : null,
        ...toDepartmentColumns(departmentId),
        must_change_password: false,
      }
    : null;

  return {
    requiresEmailConfirmation: !hasActiveSession,
    initialProfile,
  };
};

export const signInWithPassword = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
};

export const signOutAuthSession = async () => {
  await supabase.auth.signOut();
};

export const clearStoredE2EAuth = () => {
  if (!readE2EAuthState()) return false;
  clearE2EAuthState();
  return true;
};

export const completePasswordChangeForUser = async ({
  userId,
  password,
}: {
  userId: string;
  password: string;
}) => {
  const { error: authError } = await supabase.auth.updateUser({ password });
  if (authError) throw authError;

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", userId);

  if (profileUpdateError) {
    throw new Error(
      "Your password was updated, but the account security check could not be completed. Please sign in again and try once more.",
    );
  }
};

export const sendPasswordResetEmail = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl({
      origin: window.location.origin,
      configuredAppUrl: import.meta.env.VITE_APP_URL,
    }),
  });
  if (error) throw error;
};

export const resendSignupVerification = async (pendingVerificationEmail: string | null) => {
  if (!pendingVerificationEmail) {
    throw new Error("No pending verification email is available. Create your account again or contact support.");
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: pendingVerificationEmail,
  });
  if (error) throw error;
};

export const getDemoProfile = (demoRole: AppRole): Profile => {
  if (demoRole === "lecturer") {
    return {
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
  }

  return {
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
};
