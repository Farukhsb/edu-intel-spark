export type NewAssignmentInput = {
  title: string;
  moduleCode: string;
  maxScore: number;
  dueDate: string | null;
  description: string | null;
};

export function parseImportScope(value: unknown) {
  const scope = typeof value === "string" ? value.trim().toLowerCase() : "";
  return scope === "new_assignment" ? "new_assignment" : "existing_assignment";
}

export function parseNewAssignment(params: {
  title: unknown;
  moduleCode: unknown;
  maxScore: unknown;
  dueDate: unknown;
  description: unknown;
}): NewAssignmentInput | null {
  const title = typeof params.title === "string" ? params.title.trim() : "";
  const moduleCode = typeof params.moduleCode === "string" ? params.moduleCode.trim() : "";
  const maxScoreValue = typeof params.maxScore === "number"
    ? params.maxScore
    : typeof params.maxScore === "string"
      ? Number(params.maxScore)
      : Number.NaN;
  const dueDate = typeof params.dueDate === "string" && params.dueDate.trim() ? params.dueDate.trim() : null;
  const description = typeof params.description === "string" && params.description.trim() ? params.description.trim() : null;

  if (!title && !moduleCode && !Number.isFinite(maxScoreValue) && !dueDate && !description) {
    return null;
  }

  return {
    title,
    moduleCode,
    maxScore: Number.isFinite(maxScoreValue) && maxScoreValue > 0 ? maxScoreValue : 100,
    dueDate,
    description,
  };
}
