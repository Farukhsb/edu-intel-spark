// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { parseLtiLaunch } from "../../supabase/functions/lms-sync/lti13/launch";
import { loadLtiRegistration } from "../../supabase/functions/lms-sync/lti13/registration";
import { verifyLtiJwt } from "../../supabase/functions/lms-sync/lti13/jwt";
import {
  buildLtiLaunchTargetPath,
  decodeLtiLaunchState,
  encodeLtiLaunchState,
} from "@/lib/ltiLaunch";

const originalEnv = {
  LTI_CANVAS_ISSUER: process.env.LTI_CANVAS_ISSUER,
  LTI_CANVAS_CLIENT_ID: process.env.LTI_CANVAS_CLIENT_ID,
  LTI_CANVAS_AUTH_LOGIN_URL: process.env.LTI_CANVAS_AUTH_LOGIN_URL,
  LTI_CANVAS_AUTH_TOKEN_URL: process.env.LTI_CANVAS_AUTH_TOKEN_URL,
  LTI_CANVAS_JWKS_URL: process.env.LTI_CANVAS_JWKS_URL,
};

afterEach(() => {
  for (const key of Object.keys(originalEnv) as Array<keyof typeof originalEnv>) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function toBase64Url(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return Buffer.from(bytes).toString("base64url");
}

async function createSignedLtiToken(payload: Record<string, unknown>) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );

  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const header = {
    alg: "RS256",
    kid: "test-key",
    typ: "JWT",
  };
  const signingInput = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  );

  return {
    token: `${signingInput}.${toBase64Url(new Uint8Array(signature))}`,
    jwks: {
      keys: [
        {
          ...publicJwk,
          kid: "test-key",
          use: "sig",
          alg: "RS256",
        },
      ],
    },
  };
}

describe("LTI 1.3 launch", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("encodes and decodes the app launch state", () => {
    const encoded = encodeLtiLaunchState({
      provider: "canvas",
      issuer: "https://canvas.example.edu",
      targetPath: "/dashboard",
      launchedAt: "2026-06-05T15:00:00.000Z",
      roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
      contextId: "course-9",
      resourceLinkId: "resource-7",
      messageType: "LtiResourceLinkRequest",
    });

    expect(decodeLtiLaunchState(encoded)).toEqual({
      provider: "canvas",
      issuer: "https://canvas.example.edu",
      targetPath: "/dashboard",
      launchedAt: "2026-06-05T15:00:00.000Z",
      roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
      contextId: "course-9",
      resourceLinkId: "resource-7",
      messageType: "LtiResourceLinkRequest",
    });

    expect(
      buildLtiLaunchTargetPath({
        provider: "canvas",
        issuer: "https://canvas.example.edu",
        targetPath: "/dashboard",
        launchedAt: "2026-06-05T15:00:00.000Z",
        roles: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
        contextId: "course-9",
        resourceLinkId: "resource-7",
        messageType: "LtiResourceLinkRequest",
      }),
    ).toBe("/dashboard/explain-grade?ltiProvider=canvas&ltiIssuer=https%3A%2F%2Fcanvas.example.edu&ltiContextId=course-9&ltiResourceLinkId=resource-7&ltiMessageType=LtiResourceLinkRequest");
  });

  it("loads provider registration from env", () => {
    process.env.LTI_CANVAS_ISSUER = "https://canvas.example.edu";
    process.env.LTI_CANVAS_CLIENT_ID = "canvas-client";
    process.env.LTI_CANVAS_AUTH_LOGIN_URL = "https://canvas.example.edu/api/lti/authorize_redirect";
    process.env.LTI_CANVAS_AUTH_TOKEN_URL = "https://canvas.example.edu/login/oauth2/token";
    process.env.LTI_CANVAS_JWKS_URL = "https://canvas.example.edu/api/lti/security/jwks";

    expect(loadLtiRegistration("canvas")).toEqual({
      provider: "canvas",
      issuer: "https://canvas.example.edu",
      clientId: "canvas-client",
      authLoginUrl: "https://canvas.example.edu/api/lti/authorize_redirect",
      authTokenUrl: "https://canvas.example.edu/login/oauth2/token",
      jwksUrl: "https://canvas.example.edu/api/lti/security/jwks",
    });
  });

  it("verifies a signed LTI launch token and builds the context", async () => {
    const registration = {
      provider: "canvas" as const,
      issuer: "https://canvas.example.edu",
      clientId: "canvas-client",
      authLoginUrl: "https://canvas.example.edu/api/lti/authorize_redirect",
      authTokenUrl: "https://canvas.example.edu/login/oauth2/token",
      jwksUrl: "https://canvas.example.edu/api/lti/security/jwks",
    };

    const { token, jwks } = await createSignedLtiToken({
      iss: registration.issuer,
      sub: "student-123",
      aud: registration.clientId,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      nonce: "nonce-123",
      "https://purl.imsglobal.org/spec/lti/claim/deployment_id": "deployment-42",
      "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
      "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
      "https://purl.imsglobal.org/spec/lti/claim/resource_link": { id: "resource-7" },
      "https://purl.imsglobal.org/spec/lti/claim/context": { id: "course-9" },
      "https://purl.imsglobal.org/spec/lti/claim/roles": [
        "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
      ],
    });

    const fetchMock = vi.fn(async () => new Response(JSON.stringify(jwks), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(verifyLtiJwt(token, registration, { fetchImpl: fetchMock as typeof fetch }))
      .resolves.toMatchObject({
        payload: {
          iss: registration.issuer,
          sub: "student-123",
        },
      });

    const request = new Request("https://gradeai.test/functions/v1/lti-launch", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        id_token: token,
        provider: "canvas",
        target_link_uri: "https://canvas.example.edu/lti/launch",
      }).toString(),
    });

    await expect(
      parseLtiLaunch(request, {
        resolveRegistration: () => registration,
        fetchImpl: fetchMock as typeof fetch,
      }),
    ).resolves.toEqual({
      provider: "canvas",
      issuer: registration.issuer,
      clientId: registration.clientId,
      deploymentId: "deployment-42",
      resourceLinkId: "resource-7",
      userId: "student-123",
      roles: [
        "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
      ],
      targetLinkUri: "https://canvas.example.edu/lti/launch",
      messageType: "LtiResourceLinkRequest",
      version: "1.3.0",
      contextId: "course-9",
      nonce: "nonce-123",
      claims: expect.objectContaining({
        iss: registration.issuer,
        sub: "student-123",
      }),
    });
  });
});
