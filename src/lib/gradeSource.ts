export type GradeSource = "ai_graded" | "lecturer_reviewed" | "lecturer_uploaded";

export type GradeSourcePresentation = {
  label: string;
  variant: "default" | "secondary" | "outline";
  className: string;
};

const GRADE_SOURCE_PRESENTATIONS: Record<GradeSource, GradeSourcePresentation> = {
  ai_graded: {
    label: "AI Graded",
    variant: "secondary",
    className: "border-primary/20 text-primary",
  },
  lecturer_reviewed: {
    label: "Lecturer Reviewed",
    variant: "default",
    className: "border-success/30 text-success",
  },
  lecturer_uploaded: {
    label: "Uploaded",
    variant: "outline",
    className: "border-slate-300 text-slate-700",
  },
};

export const getGradeSourcePresentation = (
  source: string | null | undefined,
): GradeSourcePresentation | null => {
  if (!source) return null;
  return GRADE_SOURCE_PRESENTATIONS[source as GradeSource] ?? null;
};
