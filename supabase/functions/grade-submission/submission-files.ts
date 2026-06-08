export function normalizeSubmissionStoragePath(fileUrl: string | null | undefined) {
  const trimmed = typeof fileUrl === "string" ? fileUrl.trim() : "";
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, "");
  }

  try {
    const parsed = new URL(trimmed);
    const marker = "/submissions/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export function isSupportedSubmissionFile(fileName: string | null | undefined, fileUrl: string | null | undefined) {
  const candidate = `${fileName ?? ""} ${fileUrl ?? ""}`.toLowerCase();
  return [
    ".pdf",
    ".docx",
    ".txt",
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".java",
    ".c",
    ".cpp",
    ".cc",
    ".cs",
    ".go",
    ".php",
    ".rb",
    ".rs",
    ".swift",
    ".kt",
    ".kts",
    ".scala",
    ".sql",
    ".html",
    ".css",
    ".json",
    ".xml",
    ".yaml",
    ".yml",
    ".sh",
    ".md",
  ].some((extension) => candidate.includes(extension));
}
