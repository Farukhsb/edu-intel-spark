import { z } from "zod";

const optionalUrl = z.union([z.string().url(), z.literal(""), z.undefined()]).transform((value) => value || undefined);
const optionalString = z.union([z.string().min(1), z.literal(""), z.undefined()]).transform((value) => value || undefined);
const optionalBooleanFlag = z
  .union([z.literal("true"), z.literal("false"), z.literal(""), z.undefined()])
  .transform((value) => value === "true");

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: optionalString,
  VITE_SUPABASE_ANON_KEY: optionalString,
  VITE_APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  VITE_SENTRY_DSN: optionalUrl,
  VITE_APP_URL: optionalUrl,
  VITE_POSTHOG_KEY: optionalString,
  VITE_POSTHOG_HOST: optionalUrl,
  VITE_ANALYTICS_ENABLED: optionalBooleanFlag,
  VITE_SUPABASE_PROJECT_ID: optionalString,
  VITE_INSTITUTION_SLUG: optionalString,
});

type ParsedEnv = z.infer<typeof EnvSchema>;

export type AppEnv = Omit<ParsedEnv, "VITE_SUPABASE_PUBLISHABLE_KEY" | "VITE_SUPABASE_ANON_KEY"> & {
  VITE_SUPABASE_PUBLISHABLE_KEY: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

export function parseEnv(rawEnv: Record<string, unknown>): AppEnv {
  const normalizedEnv = {
    ...rawEnv,
    VITE_APP_ENV: rawEnv.VITE_APP_ENV === "test" ? "development" : rawEnv.VITE_APP_ENV,
  };

  const parsed = EnvSchema.safeParse(normalizedEnv);
  if (parsed.success) {
    const publishableKey =
      parsed.data.VITE_SUPABASE_PUBLISHABLE_KEY ?? parsed.data.VITE_SUPABASE_ANON_KEY;

    if (!publishableKey) {
      throw new Error(
        "Invalid environment configuration: VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY",
      );
    }

    return {
      ...parsed.data,
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    };
  }

  const variableNames = [...new Set(parsed.error.issues.map((issue) => issue.path[0]).filter((key): key is string => typeof key === "string"))];
  throw new Error(
    `Invalid environment configuration: ${variableNames.join(", ") || "unknown variable"}`,
  );
}

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnv(import.meta.env);
  }

  return cachedEnv;
}

export const env = new Proxy({} as AppEnv, {
  get(_target, property) {
    return getEnv()[property as keyof AppEnv];
  },
});
