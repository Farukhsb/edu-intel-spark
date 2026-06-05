import { describe, expect, it } from "vitest";

import { authSessionInternals } from "@/contexts/auth/auth-session";

describe("auth session internals", () => {
  it("detects Supabase refresh_token_not_found errors by code", () => {
    expect(
      authSessionInternals.isRefreshTokenNotFoundError({
        __isAuthError: true,
        code: "refresh_token_not_found",
        message: "Invalid refresh token: refresh token not found",
        status: 400,
      }),
    ).toBe(true);
  });

  it("detects refresh token failures by message", () => {
    expect(
      authSessionInternals.isRefreshTokenNotFoundError({
        message: "Refresh token not found",
      }),
    ).toBe(true);
  });

  it("detects expired or invalid refresh token failures", () => {
    expect(
      authSessionInternals.isRefreshTokenNotFoundError({
        __isAuthError: true,
        code: "invalid_grant",
        message: "Invalid refresh token: refresh token expired",
        status: 400,
      }),
    ).toBe(true);
  });

  it("does not classify unrelated auth errors as refresh token failures", () => {
    expect(
      authSessionInternals.isRefreshTokenNotFoundError({
        __isAuthError: true,
        code: "invalid_credentials",
        message: "Invalid login credentials",
        status: 400,
      }),
    ).toBe(false);
  });

  it("treats auth and reset-password as public auth routes", () => {
    expect(authSessionInternals.isPublicAuthRoute("/auth")).toBe(true);
    expect(authSessionInternals.isPublicAuthRoute("/reset-password")).toBe(true);
    expect(authSessionInternals.isPublicAuthRoute("/dashboard/explain-grade")).toBe(false);
  });
});
