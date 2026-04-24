export type AppRole = "lecturer" | "student" | "admin";

export type PublicSignupRole = Exclude<AppRole, "admin">;

export const parseAppRole = (role: string | null | undefined): AppRole | null => {
  if (role === "lecturer" || role === "student" || role === "admin") {
    return role;
  }

  return null;
};

export const isAdminRole = (role: string | null | undefined): role is "admin" => role === "admin";

export const isLecturerEquivalentRole = (
  role: string | null | undefined,
): role is "lecturer" | "admin" => role === "lecturer" || role === "admin";

export const isStudentRole = (role: string | null | undefined): role is "student" => role === "student";
