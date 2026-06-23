import type { OperationalMonitoringWorkflowRunLike } from "@/lib/operationalMonitoringTypes";

export const DAY_MS = 1000 * 60 * 60 * 24;

export const isOlderThanDays = (value: string | null | undefined, days: number, now: number) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  return now - timestamp > days * DAY_MS;
};

export const getParentWorkflowRunId = (row: OperationalMonitoringWorkflowRunLike) => {
  const parentId = row.details?.parent_workflow_run_id;
  return typeof parentId === "string" && parentId.trim() ? parentId : null;
};

export const isTerminalWorkflowRun = (row: OperationalMonitoringWorkflowRunLike) => row.status !== "running";

export const collapseWorkflowRunPairs = (rows: OperationalMonitoringWorkflowRunLike[]) => {
  const terminalParentIds = new Set(
    rows
      .filter((row) => isTerminalWorkflowRun(row))
      .map((row) => getParentWorkflowRunId(row))
      .filter((parentId): parentId is string => Boolean(parentId)),
  );

  return rows.filter((row) => !terminalParentIds.has(row.id) || isTerminalWorkflowRun(row));
};
