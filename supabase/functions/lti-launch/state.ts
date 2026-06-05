export type LtiLaunchState = {
  provider: string;
  issuer: string;
  targetPath: string;
  launchedAt: string;
  roles: string[];
  contextId?: string | null;
  resourceLinkId?: string | null;
  messageType?: string | null;
};

const DEFAULT_TARGET_PATH = "/dashboard";

function base64UrlEncode(value: string) {
  const utf8 = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of utf8) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizeTargetPath(targetPath: string | null | undefined) {
  if (!targetPath || !targetPath.trim()) {
    return DEFAULT_TARGET_PATH;
  }

  const resolved = targetPath.trim();
  return resolved.startsWith("/") ? resolved : DEFAULT_TARGET_PATH;
}

export function encodeLtiLaunchState(state: LtiLaunchState) {
  return base64UrlEncode(JSON.stringify({
    ...state,
    targetPath: normalizeTargetPath(state.targetPath),
    contextId: state.contextId ?? null,
    resourceLinkId: state.resourceLinkId ?? null,
    messageType: state.messageType ?? null,
  }));
}
