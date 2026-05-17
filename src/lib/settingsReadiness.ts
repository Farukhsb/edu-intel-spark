import { isLecturerEquivalentRole } from "@/lib/roles";

export interface SettingsReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export const getSettingsReadiness = ({
  role,
  fullName,
  email,
  departmentName,
}: {
  role: string | null | undefined;
  fullName: string | null | undefined;
  email: string | null | undefined;
  departmentName: string | null | undefined;
}): SettingsReadiness => {
  const missingFields = [
    !fullName ? "name" : null,
    !email ? "email" : null,
    !departmentName ? "department" : null,
  ].filter(Boolean) as string[];

  if (missingFields.length > 0) {
    return {
      postureLabel: "Profile completion position",
      likelyChallenge: `${missingFields[0]} is still missing from your account record`,
      bestNextAction: "Ask your administrator to complete the missing account details before they affect workflow visibility",
    };
  }

  if (isLecturerEquivalentRole(role)) {
    return {
      postureLabel: "Teaching workflow position",
      likelyChallenge: "Role and department settings now control lecturer-only workflow access",
      bestNextAction: "Check that your account details still match the teaching context you need to manage",
    };
  }

  if (role === "student") {
    return {
      postureLabel: "Student access position",
      likelyChallenge: "Your profile details shape which academic support and assignment workflows you can see",
      bestNextAction: "Keep your account details accurate so released results and support flows stay aligned",
    };
  }

  return {
    postureLabel: "Account access position",
    likelyChallenge: "This account relies on role and department metadata to unlock the correct dashboard areas",
    bestNextAction: "Confirm the account setup with an administrator if access looks incomplete",
  };
};
