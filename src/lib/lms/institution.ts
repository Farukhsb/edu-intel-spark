import type { LmsProviderId } from "./types";

export type LmsInstitutionConnection = {
  institutionId: string;
  institutionSlug: string;
  provider: LmsProviderId;
  baseUrl: string;
  enabled: boolean;
};

export function normalizeLmsBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed;
}

export function isLmsConnectionEnabled(connection: LmsInstitutionConnection) {
  return connection.enabled && Boolean(connection.baseUrl.trim());
}

