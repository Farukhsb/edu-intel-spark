import type { ExternalExaminerExportRow } from "@/types/academic";

export type ExternalExaminerExportIncludeOptions = {
  scores: boolean;
  feedback: boolean;
  moderation: boolean;
  aiBreakdown: boolean;
  studentIdentity: boolean;
};

const csvEscape = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;

const buildSummaryLines = (rows: ExternalExaminerExportRow[]) => {
  const scores = rows.map((row) => row.finalScore).filter((score): score is number => score != null);
  const averageScore = scores.length > 0 ? Math.round(scores.reduce((left, right) => left + right, 0) / scores.length) : 0;
  const passRate = scores.length > 0 ? Math.round((scores.filter((score) => score >= 40).length / scores.length) * 100) : 0;
  const moderated = rows.filter((row) => row.lecturerScore != null).length;

  return [
    "",
    "",
    "EXTERNAL EXAMINER SUMMARY",
    `Report Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Total Submissions: ${rows.length}`,
    `Average Score: ${averageScore}%`,
    `Pass Rate: ${passRate}%`,
    `Moderation Coverage: ${rows.length > 0 ? Math.round((moderated / rows.length) * 100) : 0}% (${moderated}/${rows.length})`,
    "",
    "GRADE DISTRIBUTION",
    `1st (>=70%): ${rows.filter((row) => row.classification === "1st").length}`,
    `2:1 (60-69%): ${rows.filter((row) => row.classification === "2:1").length}`,
    `2:2 (50-59%): ${rows.filter((row) => row.classification === "2:2").length}`,
    `3rd (40-49%): ${rows.filter((row) => row.classification === "3rd").length}`,
    `Fail (<40%): ${rows.filter((row) => row.classification === "Fail").length}`,
  ];
};

export const buildExternalExaminerCsv = (
  rows: ExternalExaminerExportRow[],
  includeOptions: ExternalExaminerExportIncludeOptions,
) => {
  const headers: string[] = [];
  if (includeOptions.studentIdentity) headers.push("Student Name", "Student Email");
  headers.push("Assignment", "Module Code");
  if (includeOptions.scores) headers.push("AI Score", "Lecturer Score", "Final Score", "Classification", "Source");
  if (includeOptions.feedback) headers.push("AI Feedback", "Lecturer Feedback", "Final Feedback");
  if (includeOptions.moderation) headers.push("Status", "Submitted", "Reviewed", "Reviewed By");

  const csvRows = rows.map((row) => {
    const csvRow: string[] = [];
    if (includeOptions.studentIdentity) csvRow.push(csvEscape(row.studentName), csvEscape(row.studentEmail));
    csvRow.push(csvEscape(row.assignmentTitle), csvEscape(row.moduleCode));
    if (includeOptions.scores) {
      csvRow.push(
        String(row.aiScore ?? ""),
        String(row.lecturerScore ?? ""),
        String(row.finalScore ?? ""),
        row.classification,
        csvEscape(row.gradeSource ?? ""),
      );
    }
    if (includeOptions.feedback) {
      csvRow.push(
        csvEscape(row.aiFeedback),
        csvEscape(row.lecturerFeedback),
        csvEscape(row.finalFeedback),
      );
    }
    if (includeOptions.moderation) csvRow.push(row.status, row.submittedAt, row.reviewedAt, csvEscape(row.reviewedBy));
    return csvRow.join(",");
  });

  return [headers.join(","), ...csvRows].join("\n");
};

export const buildDetailedExternalExaminerCsv = (
  rows: ExternalExaminerExportRow[],
  includeOptions: ExternalExaminerExportIncludeOptions,
) => `${buildExternalExaminerCsv(rows, includeOptions)}\n${buildSummaryLines(rows).join("\n")}`;
