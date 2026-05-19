export const getFirstName = (fullName: string | null | undefined, fallback = "there") => {
  const first = fullName?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : fallback;
};

export const COHORT_LEVELS = [
  { value: "foundation", label: "Foundation Year" },
  { value: "year1", label: "Year 1 (Level 4)" },
  { value: "year2", label: "Year 2 (Level 5)" },
  { value: "year3", label: "Year 3 (Level 6)" },
  { value: "year4", label: "Year 4 (Level 6 / Integrated Masters)" },
  { value: "postgrad_taught", label: "Postgraduate Taught (Masters)" },
  { value: "postgrad_research", label: "Postgraduate Research (MPhil / PhD)" },
  { value: "professional", label: "Professional / CPD" },
  { value: "other", label: "Other" },
] as const;

export const formatCohortLevel = (value: string | null | undefined): string => {
  if (!value) return "Not set";

  const match = COHORT_LEVELS.find((level) => level.value === value);
  if (match) return match.label;

  const legacy: Record<string, string> = {
    "100": "Year 1",
    "200": "Year 2",
    "300": "Year 3",
    "400": "Year 4",
  };

  return legacy[value] ?? value;
};
