export type LmsProviderTokenRecord = {
  provider: string;
  institutionId: string;
  encryptedToken: string;
  expiresAt: string | null;
};

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEnv } from "../../_shared/env.ts";
import type { LmsProviderId } from "../../lms/types.ts";

type ProviderConnectionTokenSource = {
  accessToken?: string | null;
  accessTokenSecretName?: string | null;
};

function resolveTokenFromEnv(provider: LmsProviderId, secretName?: string | null) {
  if (secretName) {
    const namedSecret = getEnv(secretName);
    if (namedSecret?.trim()) return namedSecret.trim();
  }

  const providerSecret = getEnv(`LMS_PROVIDER_TOKEN_${provider.toUpperCase()}`);
  if (providerSecret?.trim()) return providerSecret.trim();

  return null;
}

export async function resolveLmsProviderToken(
  supabaseAdmin: SupabaseClient,
  provider: LmsProviderId,
  institutionId: string,
  connection?: ProviderConnectionTokenSource | null,
) {
  const secretName = connection?.accessTokenSecretName ?? null;
  const envToken = resolveTokenFromEnv(provider, secretName);
  if (envToken) {
    return envToken;
  }

  const directToken = connection?.accessToken?.trim();
  if (directToken) {
    return directToken;
  }

  const { data, error } = await supabaseAdmin
    .from("lms_provider_tokens")
    .select("encrypted_token, expires_at")
    .eq("provider", provider)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const token = typeof data?.encrypted_token === "string" ? data.encrypted_token.trim() : "";
  return token || null;
}
