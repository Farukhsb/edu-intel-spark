import type { RubricCriterion } from "@/components/RubricBuilder";
export { ASSIGNMENT_TARGET_DEPARTMENTS } from "@/lib/departmentOptions";

export const ASSIGNMENT_TARGET_COHORTS = [
  { value: "100", label: "Level 100" },
  { value: "200", label: "Level 200" },
  { value: "300", label: "Level 300" },
  { value: "400", label: "Level 400" },
] as const;

export interface AssignmentFormState {
  dialogOpen: boolean;
  creating: boolean;
  editingAssignmentId: string | null;
  title: string;
  description: string;
  moduleCode: string;
  maxScore: string;
  dueDate: string;
  rubric: RubricCriterion[];
  selectedCohorts: string[];
  selectedDepartments: string[];
  selectedTemplateId: string;
}

