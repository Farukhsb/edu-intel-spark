import { HttpError } from "../_shared/auth.ts";
import { parseGradeImportCsv } from "../_shared/grade-import.ts";

export async function buildCsvImportRows(params: {
  files: File[];
  csvText: string | null;
  assignmentMaxScore: number;
}) {
  if (params.files.length > 1) {
    throw new HttpError(400, "CSV imports support a single file at a time");
  }

  if (params.files[0]) {
    const text = await params.files[0].text();
    return parseGradeImportCsv(text, params.assignmentMaxScore);
  }

  if (!params.csvText) {
    throw new HttpError(400, "CSV import requires a file or csvText");
  }

  return parseGradeImportCsv(params.csvText, params.assignmentMaxScore);
}
