export function safeFormatDate(dateStr: string | null | undefined, fallback = "N/A"): string {
  if (!dateStr) return fallback;
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return fallback;
  }
}

export function safeToLocaleDate(dateStr: string | null | undefined, fallback = "N/A"): string {
  return safeFormatDate(dateStr, fallback);
}

export function format(date: Date, pattern: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => n.toString().padStart(2, "0");
  
  return pattern
    .replace("yyyy", date.getFullYear().toString())
    .replace("MMM", months[date.getMonth()])
    .replace("dd", pad(date.getDate()))
    .replace("d", date.getDate().toString())
    .replace("HH", pad(date.getHours()))
    .replace("mm", pad(date.getMinutes()))
    .replace(/'/g, "");
}
