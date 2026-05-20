export type AppRole = "lecturer" | "student" | "admin";

export type PublicSignupRole = Exclude<AppRole, "admin">;
export const MANAGED_APP_ROLES: readonly AppRole[] = ["student", "lecturer", "admin"];

export const parseAppRole = (role: string | null | undefined): AppRole | null => {
  if (MANAGED_APP_ROLES.includes(role as AppRole)) {
    return role;
  }

  return null;
};

export const isAdminRole = (role: string | null | undefined): role is "admin" => role === "admin";

export const isLecturerEquivalentRole = (
  role: string | null | undefined,
): role is "lecturer" | "admin" => role === "lecturer" || role === "admin";

export const isStudentRole = (role: string | null | undefined): role is "student" => role === "student";
