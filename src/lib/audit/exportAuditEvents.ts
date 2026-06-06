import { logAdminAuditEvent } from "@/lib/audit/adminAuditEvents";

type ReportExportEventInput = {
  actorId?: string | null;
  actorRole?: string | null;
  institutionId?: string | null;
  reportName: string;
  format: string;
  rowCount: number;
  redactedStudentIdentity?: boolean;
  scope?: string | null;
  status?: "success" | "failure";
  errorMessage?: string | null;
};

export const logReportExportEvent = async ({
  actorId,
  actorRole,
  institutionId,
  reportName,
  format,
  rowCount,
  redactedStudentIdentity,
  scope,
  status = "success",
  errorMessage,
}: ReportExportEventInput) => {
  await logAdminAuditEvent({
    actorId,
    actorRole,
    institutionId,
    actionType: status === "failure" ? "report_export_failed" : "report_exported",
    details: {
      report_name: reportName,
      format,
      row_count: rowCount,
      redacted_student_identity: redactedStudentIdentity ?? false,
      scope: scope ?? null,
      error_message: errorMessage ?? null,
    },
  });
};
