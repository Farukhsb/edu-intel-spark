import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  from: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    warn: mocks.warn,
  },
}));

describe("admin audit event logging", () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.from.mockReset();
    mocks.warn.mockReset();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({
      insert: mocks.insert,
    });
  });

  it("inserts a report export audit row with institution scope", async () => {
    const { logAdminAuditEvent } = await import("@/lib/audit/adminAuditEvents");

    await logAdminAuditEvent({
      actorId: "admin-1",
      actorRole: "admin",
      institutionId: "institution-1",
      actionType: "report_exported",
      details: {
        report_name: "external_examiner_export",
        format: "csv",
        row_count: 14,
      },
    });

    expect(mocks.from).toHaveBeenCalledWith("admin_audit_log");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "admin-1",
        actor_role: "admin",
        institution_id: "institution-1",
        action_type: "report_exported",
        details: expect.objectContaining({
          report_name: "external_examiner_export",
          format: "csv",
        }),
      }),
    );
  });

  it("returns quietly when actor context is missing", async () => {
    const { logAdminAuditEvent } = await import("@/lib/audit/adminAuditEvents");

    await logAdminAuditEvent({
      actorId: null,
      actorRole: "admin",
      actionType: "lms_connection_saved",
    });

    expect(mocks.from).not.toHaveBeenCalled();
  });
});
