import type { User } from "@supabase/supabase-js";

import type { AppRole, PublicSignupRole } from "@/lib/roles";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  avatar_url: string | null;
  cohort_id: string | null;
  department_name: string | null;
  // Temporary compatibility mirror. New UI logic should read department_name.
  department_id: string | null;
  institution_id?: string | null;
  must_change_password: boolean;
}

export interface AuthContextType {
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
    departmentName?: string
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
