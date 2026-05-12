import type { AdminGovernanceStatus } from "../types";

export const toGovernanceStatus = (available: boolean, rowCount: number): AdminGovernanceStatus =>
  !available ? "unavailable" : rowCount > 0 ? "available" : "empty";
