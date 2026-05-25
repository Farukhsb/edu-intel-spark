import { useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { posthog } from "@/lib/posthog";
import { createE2EUser, readE2EAuthState } from "@/lib/e2eAuth";
import { log } from "@/lib/logger";

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

type AuthErrorLike = {
  code?: string | null;
  name?: string | null;
  message?: string | null;
  status?: number | null;
  __isAuthError?: boolean | null;
};

const toAuthErrorRecord = (error: unknown): AuthErrorLike | null =>
  typeof error === "object" && error !== null ? (error as AuthErrorLike) : null;

const isRefreshTokenNotFoundError = (error: unknown) => {
  const record = toAuthErrorRecord(error);
  if (!record) return false;

  const message = String(record.message ?? "").toLowerCase();
  return record.code === "refresh_token_not_found" || message.includes("refresh token not found");
};

const isPublicAuthRoute = (pathname: string) =>
  pathname === "/auth" || pathname === "/reset-password";

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
      setPendingVerificationEmail(null);
      posthog.reset();
      setLoading(false);
    };

    const handleSessionFailure = (error: unknown, context: "getSession" | "applyAuthenticatedUser") => {
      if (isRefreshTokenNotFoundError(error)) {
        log.warn("Auth session refresh token was not found; clearing client session state", {
          context,
          locationPathname,
        });
        clearAuthenticatedState();
        if (!isPublicAuthRoute(locationPathname)) {
          navigate("/auth", { replace: true });
        }
        return;
      }

      log.error("Auth session synchronisation failed", error, {
        context,
        locationPathname,
      });
      clearAuthenticatedState();
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

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          void applyAuthenticatedUser(session.user).catch((error) => {
            handleSessionFailure(error, "applyAuthenticatedUser");
          });
        } else {
          setLoading(false);
        }
      })
      .catch((error) => {
        handleSessionFailure(error, "getSession");
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (isDemo) return;

      if (event === "PASSWORD_RECOVERY" && locationPathname !== "/reset-password") {
        navigate(`/reset-password${window.location.search}${window.location.hash}`, { replace: true });
      }

      if (session?.user) {
        void applyAuthenticatedUser(session.user).catch((error) => {
          handleSessionFailure(error, "applyAuthenticatedUser");
        });
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

export const authSessionInternals = {
  isPublicAuthRoute,
  isRefreshTokenNotFoundError,
};
