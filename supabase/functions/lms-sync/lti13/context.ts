import type { LtiPlatformRegistration } from "./platform.ts";

export type LtiContext = {
  provider: LtiPlatformRegistration["provider"];
  issuer: string;
  clientId: string;
  deploymentId: string;
  resourceLinkId: string;
  userId: string;
  roles: string[];
  targetLinkUri: string | null;
  messageType: string | null;
  version: string | null;
  contextId: string | null;
  nonce: string | null;
  claims: Record<string, unknown>;
};
