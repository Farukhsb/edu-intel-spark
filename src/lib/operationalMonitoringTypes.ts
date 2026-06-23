export interface OperationalMonitoringModerationLike {
  status: string;
  createdAt: string;
  updatedAt: string;
  integrityRiskScore: number | null;
}

export interface OperationalMonitoringSubmissionLike {
  status: string;
}

export interface OperationalMonitoringWorkflowRunLike {
  id: string;
  status: "failed" | "running" | "succeeded";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  workflowName: string;
  provider: string;
  model: string | null;
  providerRetryCount: number;
  gradingPassCount: number | null;
  failureCategory: string | null;
  details?: Record<string, unknown> | null;
}

export interface OperationalMonitoringNotificationLike {
  deliveryStatus: string;
  createdAt: string;
  sentAt: string | null;
  lastError: string | null;
}

export interface OperationalHealthItem {
  label: string;
  statusLabel: string;
  tone: "healthy" | "warning" | "placeholder";
  detail: string;
  signalType: "live" | "inferred" | "placeholder";
}

export interface OperationalFailureCard {
  title: string;
  value: string;
  tone: "healthy" | "warning" | "placeholder";
  detail: string;
  action: string;
  signalType: "live" | "inferred" | "placeholder";
}

export interface OperationalAlertCard {
  title: string;
  value: string;
  threshold: string;
  tone: "healthy" | "warning" | "placeholder";
  detail: string;
  action: string;
  signalType: "live" | "inferred" | "placeholder";
}

export interface OperationalMonitoringSnapshot {
  healthItems: OperationalHealthItem[];
  failureCards: OperationalFailureCard[];
  alertCards: OperationalAlertCard[];
}
