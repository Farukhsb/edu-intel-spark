type LogContext = Record<string, unknown> | undefined;

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  if (error && typeof error === "object") {
    return Object.fromEntries(
      Object.entries(error as Record<string, unknown>).filter(([, value]) => value !== undefined),
    );
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
  };
};

export function logInfo(message: string, context?: LogContext) {
  if (context) {
    console.log(message, context);
    return;
  }

  console.log(message);
}

export function logWarn(message: string, context?: LogContext) {
  if (context) {
    console.warn(message, context);
    return;
  }

  console.warn(message);
}

export function logError(message: string, error?: unknown, context?: LogContext) {
  const payload = {
    ...(context ?? {}),
    ...(error === undefined ? {} : { error: serializeError(error) }),
  };

  if (Object.keys(payload).length > 0) {
    console.error(message, payload);
    return;
  }

  console.error(message);
}
