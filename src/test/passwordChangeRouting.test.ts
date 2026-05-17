import { describe, expect, it } from "vitest";

import { getForcedPasswordChangeRoute, getPasswordChangeRedirectPath } from "@/lib/passwordChangeRouting";

describe("password change route guard", () => {
  it("redirects authenticated flagged users away from dashboard routes", () => {
    expect(
      getPasswordChangeRedirectPath({
        isAuthenticated: true,
        isDemo: false,
        mustChangePassword: true,
        pathname: "/dashboard",
      }),
    ).toBe(getForcedPasswordChangeRoute());
  });

  it("allows flagged users onto the forced password-change route", () => {
    expect(
      getPasswordChangeRedirectPath({
        isAuthenticated: true,
        isDemo: false,
        mustChangePassword: true,
        pathname: getForcedPasswordChangeRoute(),
      }),
    ).toBeNull();
  });

  it("allows flagged users to complete the reset-password flow", () => {
    expect(
      getPasswordChangeRedirectPath({
        isAuthenticated: true,
        isDemo: false,
        mustChangePassword: true,
        pathname: "/reset-password",
      }),
    ).toBeNull();
  });

  it("returns unflagged users from the forced route to the dashboard", () => {
    expect(
      getPasswordChangeRedirectPath({
        isAuthenticated: true,
        isDemo: false,
        mustChangePassword: false,
        pathname: getForcedPasswordChangeRoute(),
      }),
    ).toBe("/dashboard");
  });
});
