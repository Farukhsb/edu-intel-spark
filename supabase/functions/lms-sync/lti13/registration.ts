import type { LtiPlatformRegistration } from "./platform.ts";
import { getEnv } from "../../_shared/env.ts";

const LTI_PROVIDERS = ["canvas", "blackboard", "moodle"] as const;

function normalizeProviderId(provider: string) {
  const normalized = provider.trim().toLowerCase();
  return (LTI_PROVIDERS as readonly string[]).includes(normalized) ? normalized : null;
}

function loadRegistrationForProvider(provider: (typeof LTI_PROVIDERS)[number]): LtiPlatformRegistration | null {
  const prefix = `LTI_${provider.toUpperCase()}`;
  const issuer = getEnv(`${prefix}_ISSUER`)?.trim();
  const clientId = getEnv(`${prefix}_CLIENT_ID`)?.trim();
  const authLoginUrl = getEnv(`${prefix}_AUTH_LOGIN_URL`)?.trim();
  const authTokenUrl = getEnv(`${prefix}_AUTH_TOKEN_URL`)?.trim();
  const jwksUrl = getEnv(`${prefix}_JWKS_URL`)?.trim();

  if (!issuer || !clientId || !authLoginUrl || !authTokenUrl || !jwksUrl) {
    return null;
  }

  return {
    provider,
    issuer,
    clientId,
    authLoginUrl,
    authTokenUrl,
    jwksUrl,
  };
}

export function loadLtiRegistration(providerOrIssuer: string): LtiPlatformRegistration | null {
  const normalized = providerOrIssuer.trim();
  const provider = normalizeProviderId(normalized);

  if (provider) {
    return loadRegistrationForProvider(provider);
  }

  for (const candidate of LTI_PROVIDERS) {
    const registration = loadRegistrationForProvider(candidate);
    if (registration && registration.issuer === normalized) {
      return registration;
    }
  }

  return null;
}
