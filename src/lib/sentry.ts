import * as Sentry from "@sentry/react";

export function initSentry() {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (!sentryDsn) {
    return;
  }

  const appEnvironment = import.meta.env.VITE_APP_ENV || "development";

  Sentry.init({
    dsn: sentryDsn,
    environment: appEnvironment,

    // Keep this false for GradeAI because the app handles student and assessment data.
    sendDefaultPii: false,

    tracesSampleRate: appEnvironment === "production" ? 0.1 : 1.0,

    beforeSend(event) {
      if (event.request?.cookies) {
        delete event.request.cookies;
      }

      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }

      return event;
    },
  });
}

export function captureAppError(error: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
  });
}
