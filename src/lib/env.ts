import { z } from "zod";

const optionalUrl = z.union([z.string().url(), z.literal(""), z.undefined()]).transform((value) => value || undefined);
const optionalString = z.union([z.string().min(1), z.literal(""), z.undefined()]).transform((value) => value || undefined);

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  VITE_APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  VITE_SENTRY_DSN: optionalUrl,
  VITE_APP_URL: optionalUrl,
  VITE_POSTHOG_KEY: optionalString,
  VITE_POSTHOG_HOST: optionalUrl,
  VITE_SUPABASE_PROJECT_ID: optionalString,
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function parseEnv(rawEnv: Record<string, unknown>): AppEnv {
  const normalizedEnv = {
    ...rawEnv,
    VITE_APP_ENV: rawEnv.VITE_APP_ENV === "test" ? "development" : rawEnv.VITE_APP_ENV,
  };

  const parsed = EnvSchema.safeParse(normalizedEnv);
  if (parsed.success) {
    return parsed.data;
  }

  const variableNames = [...new Set(parsed.error.issues.map((issue) => issue.path[0]).filter((key): key is string => typeof key === "string"))];
  throw new Error(
    `Invalid environment configuration: ${variableNames.join(", ") || "unknown variable"}`,
  );
}

export const env = parseEnv(import.meta.env);
