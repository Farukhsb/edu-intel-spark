const HYBRID_IMPORT_ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export function isHybridGradeImportEnabled() {
  const value = import.meta.env.VITE_HYBRID_IMPORT_ENABLED;
  if (typeof value !== "string") return false;
  return HYBRID_IMPORT_ENABLED_VALUES.has(value.trim().toLowerCase());
}

export function getHybridGradeImportTemplateHref() {
  return "/grade-import-template.csv";
}
