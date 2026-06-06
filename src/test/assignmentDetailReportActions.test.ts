import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: {
    error: vi.fn(),
  },
  logReportExportEvent: vi.fn(),
  createObjectURL: vi.fn(() => "blob:reviewed-reports"),
  revokeObjectURL: vi.fn(),
  click: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("@/lib/audit/exportAuditEvents", () => ({
  logReportExportEvent: mocks.logReportExportEvent,
}));

import { useAssignmentDetailReportActions } from "@/pages/dashboard/assignment-detail/state/useAssignmentDetailReportActions";

describe("useAssignmentDetailReportActions", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: mocks.createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: mocks.revokeObjectURL,
    });
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "a") {
        return {
          click: mocks.click,
          href: "",
          download: "",
        } as unknown as HTMLAnchorElement;
      }

      return originalCreateElement(tagName);
    }) as typeof document.createElement);
  });

  afterEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: originalRevokeObjectURL,
    });
    vi.restoreAllMocks();
  });

  it("blocks student exports", () => {
    const { exportReviewedReports } = useAssignmentDetailReportActions({
      assignment: { id: "assignment-1", title: "Policy", module_code: "POL301" } as never,
      actorId: "student-1",
      actorRole: "student",
      institutionId: "institution-1",
      grades: {},
      navigate: vi.fn(),
      submissions: [],
    });

    exportReviewedReports();

    expect(mocks.toast.error).toHaveBeenCalledWith("Only lecturers and admins can export reviewed reports");
    expect(mocks.logReportExportEvent).not.toHaveBeenCalled();
  });

  it("logs lecturer exports and keeps institution metadata", () => {
    const { exportReviewedReports } = useAssignmentDetailReportActions({
      assignment: { id: "assignment-1", title: "Policy", module_code: "POL301" } as never,
      actorId: "lecturer-1",
      actorRole: "lecturer",
      institutionId: "institution-1",
      grades: {
        "submission-1": {
          final_score: 72,
          lecturer_score: 70,
          ai_score: 68,
          final_feedback: "Final",
          lecturer_feedback: "Lecturer",
          ai_feedback: "AI",
        } as never,
      },
      navigate: vi.fn(),
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          student_name: "Sam Student",
          student_email: "sam@example.edu",
          file_name: "submission.pdf",
          status: "released",
          submitted_at: "2026-06-01T10:00:00.000Z",
        } as never,
      ],
    });

    exportReviewedReports();

    expect(mocks.click).toHaveBeenCalledTimes(1);
    expect(mocks.logReportExportEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "lecturer-1",
        actorRole: "lecturer",
        institutionId: "institution-1",
        reportName: "reviewed_reports",
        format: "csv",
        rowCount: 1,
      }),
    );
  });
});
