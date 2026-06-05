import type { LmsProviderAdapter } from "../../lms/providers.ts";

export async function pullGradebook(provider: LmsProviderAdapter, courseId: string) {
  const assignments = await provider.pullAssignments(courseId);
  const grades = await Promise.all(assignments.map((assignment) => provider.pullGrades(assignment.id.externalId)));

  return { assignments, grades };
}

