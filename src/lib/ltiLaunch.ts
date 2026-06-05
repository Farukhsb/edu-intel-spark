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

const STORAGE_KEY = "gradeai:lti-launch-state";
const DEFAULT_TARGET_PATH = "/dashboard";

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function base64UrlEncode(value: string) {
  const utf8 = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of utf8) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function normalizeTargetPath(targetPath: string | null | undefined) {
  if (!targetPath || !targetPath.trim()) {
    return DEFAULT_TARGET_PATH;
  }

  const resolved = targetPath.trim();
  return resolved.startsWith("/") ? resolved : DEFAULT_TARGET_PATH;
}

function hasRole(roles: readonly string[], matchers: readonly string[]) {
  const lowerRoles = roles.map((role) => role.toLowerCase());
  return matchers.some((matcher) => lowerRoles.some((role) => role.includes(matcher)));
}

export function resolveLtiLaunchTargetBasePath(state: Pick<LtiLaunchState, "roles" | "targetPath">) {
  if (state.targetPath && state.targetPath !== DEFAULT_TARGET_PATH) {
    return normalizeTargetPath(state.targetPath);
  }

  if (hasRole(state.roles, ["learner", "student"])) {
    return "/dashboard/explain-grade";
  }

  if (hasRole(state.roles, ["instructor", "teacher", "teachingassistant", "mentor", "administrator", "contentdeveloper", "designer"])) {
    return "/dashboard/cohort-dashboard";
  }

  return DEFAULT_TARGET_PATH;
}

export function buildLtiLaunchTargetPath(state: LtiLaunchState) {
  const basePath = resolveLtiLaunchTargetBasePath(state);
  const params = new URLSearchParams();

  if (state.provider) params.set("ltiProvider", state.provider);
  if (state.issuer) params.set("ltiIssuer", state.issuer);
  if (state.contextId) params.set("ltiContextId", state.contextId);
  if (state.resourceLinkId) params.set("ltiResourceLinkId", state.resourceLinkId);
  if (state.messageType) params.set("ltiMessageType", state.messageType);

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
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

export function decodeLtiLaunchState(encodedState: string): LtiLaunchState | null {
  try {
    const parsed = JSON.parse(base64UrlDecode(encodedState)) as Partial<LtiLaunchState>;
    if (
      typeof parsed.provider !== "string" ||
      typeof parsed.issuer !== "string" ||
      typeof parsed.launchedAt !== "string" ||
      !Array.isArray(parsed.roles)
    ) {
      return null;
    }

    return {
      provider: parsed.provider,
      issuer: parsed.issuer,
      launchedAt: parsed.launchedAt,
      roles: parsed.roles.filter((role): role is string => typeof role === "string"),
      targetPath: normalizeTargetPath(parsed.targetPath),
      contextId: typeof parsed.contextId === "string" && parsed.contextId.trim() ? parsed.contextId.trim() : null,
      resourceLinkId: typeof parsed.resourceLinkId === "string" && parsed.resourceLinkId.trim() ? parsed.resourceLinkId.trim() : null,
      messageType: typeof parsed.messageType === "string" && parsed.messageType.trim() ? parsed.messageType.trim() : null,
    };
  } catch {
    return null;
  }
}

export function storeLtiLaunchState(state: LtiLaunchState) {
  if (!isBrowserStorageAvailable()) return;
  window.localStorage.setItem(STORAGE_KEY, encodeLtiLaunchState(state));
}

export function readLtiLaunchState(): LtiLaunchState | null {
  if (!isBrowserStorageAvailable()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return decodeLtiLaunchState(raw);
}

export function clearLtiLaunchState() {
  if (!isBrowserStorageAvailable()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function consumeLtiLaunchTargetPath() {
  const state = readLtiLaunchState();
  clearLtiLaunchState();
  return state ? buildLtiLaunchTargetPath(state) : null;
}

export function resolveLtiLaunchTargetPath(targetPath?: string | null) {
  return normalizeTargetPath(targetPath);
}
