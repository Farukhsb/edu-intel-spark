import type { LtiPlatformRegistration } from "./platform.ts";

export type LtiJwtHeader = {
  alg: string;
  kid?: string;
  typ?: string;
};

export type LtiJwtPayload = Record<string, unknown> & {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  nbf?: number;
};

type VerifyLtiJwtOptions = {
  fetchImpl?: typeof fetch;
  clockToleranceSeconds?: number;
};

type JwtParts = {
  header: LtiJwtHeader;
  payload: LtiJwtPayload;
  signingInput: string;
  signature: Uint8Array;
};

const SUPPORTED_ALGORITHMS = new Set(["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"]);
const CLOCK_TOLERANCE_SECONDS = 300;

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeBase64UrlString(value: string) {
  return new TextDecoder().decode(decodeBase64Url(value));
}

function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseJwt(token: string): JwtParts {
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart) {
    throw new Error("Invalid LTI JWT format.");
  }

  let header: LtiJwtHeader;
  let payload: LtiJwtPayload;
  try {
    header = JSON.parse(decodeBase64UrlString(headerPart)) as LtiJwtHeader;
    payload = JSON.parse(decodeBase64UrlString(payloadPart)) as LtiJwtPayload;
  } catch {
    throw new Error("LTI JWT could not be decoded.");
  }

  if (!header.alg || typeof header.alg !== "string") {
    throw new Error("LTI JWT header is missing an algorithm.");
  }

  if (!SUPPORTED_ALGORITHMS.has(header.alg)) {
    throw new Error(`Unsupported LTI JWT algorithm: ${header.alg}`);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("LTI JWT payload is invalid.");
  }

  return {
    header,
    payload,
    signingInput: `${headerPart}.${payloadPart}`,
    signature: decodeBase64Url(signaturePart),
  };
}

function getAlgorithmSpec(alg: string) {
  if (alg.startsWith("RS")) {
    return {
      algorithm: { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${alg.slice(2)}` as "SHA-256" | "SHA-384" | "SHA-512" },
      importAlgorithm: { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${alg.slice(2)}` as "SHA-256" | "SHA-384" | "SHA-512" },
    };
  }

  const namedCurve = alg === "ES256"
    ? "P-256"
    : alg === "ES384"
      ? "P-384"
      : "P-521";

  return {
    algorithm: { name: "ECDSA", hash: `SHA-${alg.slice(2)}` as "SHA-256" | "SHA-384" | "SHA-512" },
    importAlgorithm: { name: "ECDSA", namedCurve },
  };
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    return [value];
  }

  return [];
}

function getClaim<T>(payload: Record<string, unknown>, claim: string): T | null {
  const value = payload[claim];
  return value === undefined ? null : (value as T);
}

function validateStandardClaims(
  payload: LtiJwtPayload,
  registration: LtiPlatformRegistration,
  nowMs: number,
  clockToleranceSeconds: number,
) {
  if (payload.iss !== registration.issuer) {
    throw new Error("LTI issuer does not match the configured registration.");
  }

  const audiences = asStringArray(payload.aud);
  if (!audiences.includes(registration.clientId)) {
    throw new Error("LTI audience does not include the configured client ID.");
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  const tolerance = Math.max(0, Math.trunc(clockToleranceSeconds));

  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    throw new Error("LTI JWT is missing a valid expiration time.");
  }

  if (payload.exp < nowSeconds - tolerance) {
    throw new Error("LTI JWT has expired.");
  }

  if (typeof payload.nbf === "number" && payload.nbf > nowSeconds + tolerance) {
    throw new Error("LTI JWT is not yet valid.");
  }

  if (typeof payload.iat === "number" && payload.iat > nowSeconds + tolerance) {
    throw new Error("LTI JWT issue time is not yet valid.");
  }

  if (typeof payload.sub !== "string" || !payload.sub.trim()) {
    throw new Error("LTI JWT is missing the subject claim.");
  }
}

async function loadVerificationKey(
  registration: LtiPlatformRegistration,
  header: LtiJwtHeader,
  fetchImpl: typeof fetch,
) {
  const response = await fetchImpl(registration.jwksUrl);
  if (!response.ok) {
    throw new Error(`Unable to load LTI JWKS from ${registration.jwksUrl}`);
  }

  const jwks = await response.json().catch(() => null) as { keys?: JsonWebKey[] } | null;
  const keys = jwks?.keys ?? [];
  if (keys.length === 0) {
    throw new Error("LTI JWKS does not contain any keys.");
  }

  const matchingKeys = header.kid
    ? keys.filter((key) => key.kid === header.kid)
    : keys.length === 1
      ? [keys[0]]
      : [];

  if (matchingKeys.length === 0) {
    throw new Error("LTI JWKS does not contain a matching signing key.");
  }

  const key = matchingKeys[0];
  if (!key || key.kty !== "RSA" && key.kty !== "EC") {
    throw new Error("LTI JWKS signing key is not supported.");
  }

  const { importAlgorithm } = getAlgorithmSpec(header.alg);
  return await crypto.subtle.importKey(
    "jwk",
    key,
    importAlgorithm,
    false,
    ["verify"],
  );
}

export function decodeLtiJwt(token: string) {
  return parseJwt(token);
}

export async function verifyLtiJwt(
  token: string,
  registration: LtiPlatformRegistration,
  options: VerifyLtiJwtOptions = {},
) {
  const { header, payload, signingInput, signature } = parseJwt(token);
  validateStandardClaims(
    payload,
    registration,
    options.clockToleranceSeconds === undefined ? Date.now() : Date.now(),
    options.clockToleranceSeconds ?? CLOCK_TOLERANCE_SECONDS,
  );

  const verificationKey = await loadVerificationKey(registration, header, options.fetchImpl ?? fetch);
  const { algorithm } = getAlgorithmSpec(header.alg);
  const verified = await crypto.subtle.verify(
    algorithm,
    verificationKey,
    signature,
    new TextEncoder().encode(signingInput),
  );

  if (!verified) {
    throw new Error("LTI JWT signature could not be verified.");
  }

  return {
    header,
    payload,
    signingInput,
    signature: encodeBase64Url(signature),
  };
}
