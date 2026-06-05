import type { LtiContext } from "./context.ts";
import { logInfo } from "../../_shared/log.ts";
import { decodeLtiJwt, verifyLtiJwt, type LtiJwtPayload } from "./jwt.ts";
import { loadLtiRegistration } from "./registration.ts";
import type { LtiPlatformRegistration } from "./platform.ts";

type LtiLaunchPayload = {
  idToken: string;
  providerHint: string | null;
  targetLinkUri: string | null;
};

type ParseLtiLaunchOptions = {
  fetchImpl?: typeof fetch;
  resolveRegistration?: (providerOrIssuer: string) => LtiPlatformRegistration | null;
};

function firstString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readLaunchPayload(request: Request): Promise<LtiLaunchPayload> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  let providerHint: string | null = null;
  let targetLinkUri: string | null = null;
  let idToken: string | null = null;

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    idToken = typeof body?.id_token === "string" ? body.id_token.trim() : null;
    providerHint = typeof body?.provider === "string"
      ? body.provider.trim()
      : typeof body?.issuer === "string"
        ? body.issuer.trim()
        : null;
    targetLinkUri = typeof body?.target_link_uri === "string"
      ? body.target_link_uri.trim()
      : typeof body?.targetLinkUri === "string"
        ? body.targetLinkUri.trim()
        : null;
    return {
      idToken: idToken ?? "",
      providerHint,
      targetLinkUri,
    };
  }

  const form = await request.formData().catch(() => null);
  if (form) {
    idToken = firstString(form.get("id_token"));
    providerHint = firstString(form.get("provider")) ?? firstString(form.get("issuer"));
    targetLinkUri = firstString(form.get("target_link_uri")) ?? firstString(form.get("targetLinkUri"));
  }

  return {
    idToken: idToken ?? "",
    providerHint,
    targetLinkUri,
  };
}

function resolveRegistration(
  providerHint: string | null,
  decodedPayload: LtiJwtPayload,
  resolver: NonNullable<ParseLtiLaunchOptions["resolveRegistration"]>,
) {
  const providerOrIssuer = providerHint ?? decodedPayload.iss;
  const registration = resolver(providerOrIssuer);
  if (registration) {
    return registration;
  }

  if (providerHint && providerHint !== decodedPayload.iss) {
    return resolver(decodedPayload.iss);
  }

  return null;
}

function getClaim<T>(payload: Record<string, unknown>, claim: string): T | null {
  const value = payload[claim];
  return value === undefined ? null : (value as T);
}

function getStringClaim(payload: Record<string, unknown>, claim: string) {
  const value = getClaim<unknown>(payload, claim);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRoles(payload: Record<string, unknown>) {
  const claim = "https://purl.imsglobal.org/spec/lti/claim/roles";
  const value = payload[claim];
  if (Array.isArray(value)) {
    return value.filter((role): role is string => typeof role === "string" && role.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function buildLtiContext(
  registration: LtiPlatformRegistration,
  payload: LtiJwtPayload,
  targetLinkUri: string | null,
): LtiContext {
  const resourceLink = getClaim<Record<string, unknown>>(payload, "https://purl.imsglobal.org/spec/lti/claim/resource_link");
  const contextClaim = getClaim<Record<string, unknown>>(payload, "https://purl.imsglobal.org/spec/lti/claim/context");

  const resourceLinkId = typeof resourceLink?.id === "string" && resourceLink.id.trim() ? resourceLink.id.trim() : null;
  const deploymentId = getStringClaim(payload, "https://purl.imsglobal.org/spec/lti/claim/deployment_id");
  const messageType = getStringClaim(payload, "https://purl.imsglobal.org/spec/lti/claim/message_type");
  const version = getStringClaim(payload, "https://purl.imsglobal.org/spec/lti/claim/version");
  const contextId = typeof contextClaim?.id === "string" && contextClaim.id.trim() ? contextClaim.id.trim() : null;

  if (!deploymentId) {
    throw new Error("LTI launch is missing the deployment ID claim.");
  }

  if (!resourceLinkId) {
    throw new Error("LTI launch is missing the resource link ID claim.");
  }

  const userId = typeof payload.sub === "string" && payload.sub.trim() ? payload.sub.trim() : null;
  if (!userId) {
    throw new Error("LTI launch is missing the user subject.");
  }

  return {
    provider: registration.provider,
    issuer: registration.issuer,
    clientId: registration.clientId,
    deploymentId,
    resourceLinkId,
    userId,
    roles: getRoles(payload),
    targetLinkUri,
    messageType,
    version,
    contextId,
    nonce: getStringClaim(payload, "nonce"),
    claims: payload,
  };
}

export async function parseLtiLaunch(
  request: Request,
  options: ParseLtiLaunchOptions = {},
): Promise<LtiContext> {
  const { idToken, providerHint, targetLinkUri } = await readLaunchPayload(request);
  if (!idToken) {
    throw new Error("LTI launch request is missing an id_token.");
  }

  const decoded = decodeLtiJwt(idToken);
  const resolve = options.resolveRegistration ?? loadLtiRegistration;
  const registration = resolveRegistration(providerHint, decoded.payload, resolve);
  if (!registration) {
    throw new Error("No LTI registration is configured for this launch.");
  }

  const verified = await verifyLtiJwt(idToken, registration, {
    fetchImpl: options.fetchImpl,
  });
  const context = buildLtiContext(registration, verified.payload, targetLinkUri);

  logInfo("lti_launch_verified", {
    provider: context.provider,
    issuer: context.issuer,
    clientId: context.clientId,
    deploymentId: context.deploymentId,
  });

  return context;
}
