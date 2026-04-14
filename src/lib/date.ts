export { format } from "date-fns";

const coerceDate = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const safeFormatDate = (
  value: string | Date | null | undefined,
  pattern: string,
  fallback = "-"
) => {
  const date = coerceDate(value);
  if (!date) return fallback;
  return format(date, pattern);
};

export const safeToLocaleDate = (
  value: string | Date | null | undefined,
  fallback = "-"
) => {
  const date = coerceDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString();
};
