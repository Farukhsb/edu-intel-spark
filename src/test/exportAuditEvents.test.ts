import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insert = vi.fn(() => Promise.resolve({ error: null }));
  const from = vi.fn(() => ({ insert }));
  return {
    from,
    insert,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { logReportExportEvent } from "@/lib/audit/exportAuditEvents";

describe("logReportExportEvent", () => {
  beforeEach(() => {
    mocks.from.mockClear();
    mocks.insert.mockClear();
  });

  it("records export events in the admin audit log", async () => {
    await logReportExportEvent({
      actorId: "lecturer-1",
      actorRole: "lecturer",
      institutionId: "institution-1",
      reportName: "external_examiner_export",
      format: "csv",
      rowCount: 12,
      redactedStudentIdentity: true,
      scope: "all",
    });

    expect(mocks.from).toHaveBeenCalledWith("admin_audit_log");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "lecturer-1",
        actor_role: "lecturer",
        institution_id: "institution-1",
        action_type: "report_exported",
      }),
    );
  });
});
