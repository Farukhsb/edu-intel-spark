import type { LmsProviderId } from "../../lms-sync/types.ts";

export type LtiPlatformRegistration = {
  provider: LmsProviderId;
  issuer: string;
  clientId: string;
  authLoginUrl: string;
  authTokenUrl: string;
  jwksUrl: string;
};

