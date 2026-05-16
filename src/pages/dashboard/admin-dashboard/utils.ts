export const humanizeToken = (value: string) => value.split("_").join(" ");

export const isRecentEnoughToBeOverdue = (value: string) => {
  const ageMs = Date.now() - new Date(value).getTime();
  return ageMs > 1000 * 60 * 60 * 24 * 7;
};
