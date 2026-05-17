export interface DashboardShellContext {
  workspaceLabel: string;
  workspaceHint: string;
}

export const getDashboardShellContext = ({
  isAdmin,
  isLecturerEquivalent,
  activeSectionLabel,
  activeSectionDescription,
  activeLinkLabel,
}: {
  isAdmin: boolean;
  isLecturerEquivalent: boolean;
  activeSectionLabel: string | null;
  activeSectionDescription: string | null;
  activeLinkLabel: string | null;
}): DashboardShellContext => {
  if (activeSectionLabel && activeSectionDescription) {
    return {
      workspaceLabel: activeSectionLabel,
      workspaceHint: `${activeLinkLabel ?? "Current page"} sits in ${activeSectionDescription.toLowerCase()}.`,
    };
  }

  if (isAdmin) {
    return {
      workspaceLabel: "Admin workspace",
      workspaceHint: "Use this area to monitor platform health, users, and institution-wide workflow signals.",
    };
  }

  if (isLecturerEquivalent) {
    return {
      workspaceLabel: "Academic workspace",
      workspaceHint: "Use this area to manage teaching workflow, review pressure, and cohort follow-up.",
    };
  }

  return {
    workspaceLabel: "Student workspace",
    workspaceHint: "Use this area to review results, assignments, and your next support actions.",
  };
};
