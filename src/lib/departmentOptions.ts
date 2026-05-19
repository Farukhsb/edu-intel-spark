export const OTHER_DEPARTMENT_OPTION = "Other" as const;

export const DEPARTMENT_OPTIONS = [
  "Computer Science",
  "Mathematics",
  "Engineering",
  "Business",
  "Economics",
  "Political Science",
  "History",
  "Physics",
  "Biology",
  "Chemistry",
  "Law",
  "Medicine",
  "Psychology",
  "Nursing",
  "Education",
  "Languages",
  OTHER_DEPARTMENT_OPTION,
] as const;

export const ASSIGNMENT_TARGET_DEPARTMENTS = [...DEPARTMENT_OPTIONS];

export const resolveDepartmentValue = (
  selectedDepartment: string | null | undefined,
  customDepartment: string | null | undefined,
) => {
  const trimmedCustomDepartment = customDepartment?.trim() || "";

  if (selectedDepartment === OTHER_DEPARTMENT_OPTION) {
    return trimmedCustomDepartment || null;
  }

  return selectedDepartment?.trim() || null;
};
