export type DepartmentRecord = {
  department_name?: string | null;
  department_id?: string | null;
} | null | undefined;

export const getDepartmentName = (record: DepartmentRecord): string | null =>
  record?.department_name ?? record?.department_id ?? null;

export const toDepartmentColumns = (departmentName: string | null | undefined) => {
  const normalized = departmentName?.trim() || null;

  return {
    department_name: normalized,
    department_id: normalized,
  };
};
