import { FunctionsHttpError } from "@supabase/supabase-js";

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
