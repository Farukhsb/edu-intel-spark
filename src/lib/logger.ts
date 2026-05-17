import { captureAppError } from "@/lib/sentry";

type SafeContext = Record<string, unknown> | undefined;

const SENSITIVE_KEYS = new Set([
  "submission",
  "submissions",
  "grade",
  "grades",
  "feedback",
  "prompt",
  "prompts",
  "content",
  "documentText",
  "document_text",
  "extractedText",
  "extracted_text",
  "env",
  "environment",
  "token",
  "key",
  "secret",
]);

const sanitizeContext = (context?: SafeContext): SafeContext => {
  if (!context) return undefined;

  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      SENSITIVE_KEYS.has(key) ? "[REDACTED]" : value,
    ]),
  );
};

const isErrorRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readStringField = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
};

const readNumberField = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
};

const toSafeErrorName = (error: unknown) => {
  if (!(error instanceof Error)) {
    if (!isErrorRecord(error)) return "UnknownError";

    const namedCandidate =
      readStringField(error, "name") ||
      readStringField(error, "errorName") ||
      readStringField(error, "type");

    if (namedCandidate) return namedCandidate;

    if (
      readStringField(error, "code") ||
      readStringField(error, "message") ||
      readNumberField(error, "status") !== undefined ||
      readNumberField(error, "statusCode") !== undefined
    ) {
      return "SupabaseError";
    }

    return "UnknownError";
  }

  const normalizedName = error.name?.trim();
  return normalizedName || "Error";
};

const toSafeErrorMetadata = (error: unknown): SafeContext => {
  if (!isErrorRecord(error)) return undefined;

  const metadata: Record<string, unknown> = {};
  const code = readStringField(error, "code");
  const hint = readStringField(error, "hint");
  const details = readStringField(error, "details");
  const status = readNumberField(error, "status") ?? readNumberField(error, "statusCode");

  if (code) metadata.errorCode = code;
  if (hint) metadata.errorHint = hint;
  if (details) metadata.errorDetails = details;
  if (status !== undefined) metadata.errorStatus = status;

  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

const toSafeError = (error: unknown, fallbackMessage: string) => {
  const safeError = new Error(fallbackMessage);
  safeError.name = toSafeErrorName(error);
  return safeError;
};

const writeConsole = (
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: SafeContext,
  error?: unknown,
) => {
  const isDevelopment = (import.meta.env.VITE_APP_ENV || "development") === "development";
  if (!isDevelopment) return;

  const safeContext = sanitizeContext(context);
  if (level === "error") {
    console.error(message, error, safeContext);
    return;
  }

  if (level === "warn") {
    console.warn(message, safeContext);
    return;
  }

  if (level === "info") {
    console.info(message, safeContext);
    return;
  }

  console.debug(message, safeContext);
};

export const log = {
  debug(message: string, context?: SafeContext) {
    writeConsole("debug", message, context);
  },
  info(message: string, context?: SafeContext) {
    writeConsole("info", message, context);
  },
  warn(message: string, context?: SafeContext) {
    writeConsole("warn", message, context);
  },
  error(message: string, error?: unknown, context?: SafeContext) {
    const safeContext = sanitizeContext({
      ...toSafeErrorMetadata(error),
      ...context,
    });
    const safeError = toSafeError(error, message);
    captureAppError(safeError, {
      message,
      errorName: safeError.name,
      ...safeContext,
    });
    writeConsole("error", message, safeContext, error);
  },
};

export const loggerInternals = {
  sanitizeContext,
  toSafeError,
  toSafeErrorName,
};
