export const copyTextToClipboard = async (value: string): Promise<boolean> => {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard?.writeText) return false;

  try {
    await clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

export const buildAbsoluteAppUrl = (path: string): string => {
  const origin = globalThis.window?.location?.origin ?? "";
  if (!origin) return path;
  return new URL(path, origin).toString();
};
