import { FunctionsHttpError } from "@supabase/supabase-js";

import { formatSubmissionStatus, type ModerationAction } from "@/lib/moderation";
import type { Json } from "@/integrations/supabase/types";

export const actionLabel = (action: ModerationAction) => formatSubmissionStatus(action);

export const asJson = (value: unknown): Json => value as Json;

export const getFunctionErrorMessage = async (error: unknown, fallback: string) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
        return payload.error;
      }
    } catch {
      return error.message || fallback;
    }

    return error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
};
