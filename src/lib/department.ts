export type DepartmentRecord = {
  department_name?: string | null;
  department_id?: string | null;
} | null | undefined;

/**
 * department_name is the canonical application field.
 * department_id is retained temporarily for legacy compatibility because older rows
 * and policies may still reference it. New UI and business logic should read
 * department_name through getDepartmentName().
 */
export const getDepartmentName = (record: DepartmentRecord): string | null =>
  record?.department_name ?? record?.department_id ?? null;

export const toDepartmentColumns = (departmentName: string | null | undefined) => {
  const normalized = departmentName?.trim() || null;

  return {
    department_name: normalized,
    // Temporary compatibility write for older rows/policies.
    // Do not use department_id in new UI logic.
    department_id: normalized,
  };
};
