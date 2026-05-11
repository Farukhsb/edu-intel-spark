const FORCE_PASSWORD_CHANGE_ROUTE = "/force-password-change";
const PASSWORD_CHANGE_ALLOWED_PATHS = new Set([
  FORCE_PASSWORD_CHANGE_ROUTE,
  "/reset-password",
]);

interface PasswordChangeRedirectInput {
  isAuthenticated: boolean;
  isDemo: boolean;
  mustChangePassword: boolean;
  pathname: string;
}

export const getForcedPasswordChangeRoute = () => FORCE_PASSWORD_CHANGE_ROUTE;

export const getPasswordChangeRedirectPath = ({
  isAuthenticated,
  isDemo,
  mustChangePassword,
  pathname,
}: PasswordChangeRedirectInput): string | null => {
  if (!isAuthenticated || isDemo) {
    return null;
  }

  if (mustChangePassword && !PASSWORD_CHANGE_ALLOWED_PATHS.has(pathname)) {
    return FORCE_PASSWORD_CHANGE_ROUTE;
  }

  if (!mustChangePassword && pathname === FORCE_PASSWORD_CHANGE_ROUTE) {
    return "/dashboard";
  }

  return null;
};
