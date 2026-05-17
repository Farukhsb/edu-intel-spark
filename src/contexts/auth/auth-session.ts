import { useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { posthog } from "@/lib/posthog";
import { createE2EUser, readE2EAuthState } from "@/lib/e2eAuth";

import { fetchAuthProfile } from "./auth-profile";
import type { Profile } from "./types";

interface UseAuthSessionSyncArgs {
  isDemo: boolean;
  locationPathname: string;
  navigate: NavigateFunction;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setProfileError: (value: string | null) => void;
  setPendingVerificationEmail: (value: string | null) => void;
  setLoading: (value: boolean) => void;
  setIsDemo: (value: boolean) => void;
}

export const useAuthSessionSync = ({
  isDemo,
  locationPathname,
  navigate,
  setUser,
  setProfile,
  setProfileError,
  setPendingVerificationEmail,
  setLoading,
  setIsDemo,
}: UseAuthSessionSyncArgs) => {
  useEffect(() => {
    const applyAuthenticatedUser = async (sessionUser: User) => {
      setPendingVerificationEmail(null);
      setUser(sessionUser);
      const { profile, profileError } = await fetchAuthProfile({
        userId: sessionUser.id,
        email: sessionUser.email,
      });
      setProfile(profile);
      setProfileError(profileError);
      setLoading(false);
    };

    const clearAuthenticatedState = () => {
      setUser(null);
      setProfile(null);
      setProfileError(null);
      posthog.reset();
      setLoading(false);
    };

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
        void applyAuthenticatedUser(session.user);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (isDemo) return;

      if (event === "PASSWORD_RECOVERY" && locationPathname !== "/reset-password") {
        navigate(`/reset-password${window.location.search}${window.location.hash}`, { replace: true });
      }

      if (session?.user) {
        void applyAuthenticatedUser(session.user);
      } else {
        clearAuthenticatedState();
      }
    });

    return () => subscription.unsubscribe();
  }, [
    isDemo,
    locationPathname,
    navigate,
    setIsDemo,
    setLoading,
    setPendingVerificationEmail,
    setProfile,
    setProfileError,
    setUser,
  ]);
};
