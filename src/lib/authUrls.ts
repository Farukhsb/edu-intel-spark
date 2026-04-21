const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getPasswordResetRedirectUrl = ({
  origin,
  configuredAppUrl,
}: {
  origin: string;
  configuredAppUrl?: string | null;
}) => {
  const baseUrl = trimTrailingSlash(configuredAppUrl?.trim() || origin);
  return `${baseUrl}/reset-password`;
};
