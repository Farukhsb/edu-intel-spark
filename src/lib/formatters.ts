export const getFirstName = (fullName: string | null | undefined, fallback = "there") => {
  const first = fullName?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : fallback;
};
