import { getEnv } from "../_shared/env.ts";
import type { LmsProviderId } from "./types.ts";

export type LmsSyncConfig = {
  enabled: boolean;
  defaultProvider: LmsProviderId;
  defaultInstitutionId?: string;
  defaultInstitutionSlug?: string;
  canvasBaseUrl?: string;
  canvasAccessToken?: string;
  blackboardBaseUrl?: string;
  moodleBaseUrl?: string;
};

export function resolveLmsSyncConfig(): LmsSyncConfig {
  const defaultProvider = (getEnv("LMS_DEFAULT_PROVIDER")?.trim().toLowerCase() as LmsProviderId) || "canvas";

  return {
    enabled: getEnv("LMS_SYNC_ENABLED")?.trim().toLowerCase() === "true",
    defaultProvider: defaultProvider === "blackboard" || defaultProvider === "moodle" ? defaultProvider : "canvas",
    defaultInstitutionId: getEnv("LMS_DEFAULT_INSTITUTION_ID")?.trim() || undefined,
    defaultInstitutionSlug: getEnv("LMS_DEFAULT_INSTITUTION_SLUG")?.trim() || undefined,
    canvasBaseUrl: getEnv("CANVAS_BASE_URL")?.trim() || undefined,
    canvasAccessToken: getEnv("CANVAS_ACCESS_TOKEN")?.trim() || undefined,
    blackboardBaseUrl: getEnv("BLACKBOARD_BASE_URL")?.trim() || undefined,
    moodleBaseUrl: getEnv("MOODLE_BASE_URL")?.trim() || undefined,
  };
}
