const normalizeOptionalString = (value: string | undefined) => {
  const trimmed = value?.trim();

  if (!trimmed || trimmed === "undefined" || trimmed === "null") {
    return undefined;
  }

  return trimmed;
};

const normalizeBooleanFlag = (value: string | undefined) => normalizeOptionalString(value) === "true";

export const getAppEnvironment = () => normalizeOptionalString(import.meta.env.VITE_APP_ENV) ?? "development";

export const getTelemetryFeatures = () => {
  const sentryDsn = normalizeOptionalString(import.meta.env.VITE_SENTRY_DSN);
  const analyticsEnabled = normalizeBooleanFlag(import.meta.env.VITE_ANALYTICS_ENABLED);

  return {
    analyticsEnabled,
    sentryDsn,
    sentryEnabled: Boolean(sentryDsn),
  };
};
