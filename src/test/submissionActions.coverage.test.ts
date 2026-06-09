import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSubmissionFileActions } from "@/pages/dashboard/assignment-detail/workflows/useSubmissionFileActions";
import {
  getSubmissionUploadFailureReason,
  loadTargetedStudentProfiles,
  normalizeStudentKey,
  persistWorkflowNotification,
  uploadSubmissionFile,
} from "@/pages/dashboard/assignment-detail/workflows/submissionActions";
import type { AssignmentDetailSubmission } from "@/pages/dashboard/assignment-detail/types";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  queueCommunicationMessage: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logAcademicAccessEvent: vi.fn(),
  storageFrom: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@/lib/communications", () => ({
  queueCommunicationMessage: mocks.queueCommunicationMessage,
}));

vi.mock("@/lib/logger", () => ({
  log: {
    warn: mocks.logWarn,
    error: mocks.logError,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "lecturer-1",
    },
    profile: {
      role: "lecturer",
      institution_id: "institution-1",
    },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.supabaseFrom,
    storage: {
      from: mocks.storageFrom,
    },
  },
}));

const createSubmission = (overrides: Partial<AssignmentDetailSubmission> = {}): AssignmentDetailSubmission => ({
  id: "submission-1",
  assignment_id: "assignment-1",
  student_name: "Ada Ibrahim",
  student_email: "ada@example.edu",
  file_name: "ada-essay.pdf",
  file_type: "application/pdf",
  file_url: "submissions/ada-essay.pdf",
  status: "submitted",
  submitted_at: "2026-04-21T10:00:00Z",
  student_id: "student-1",
  ...overrides,
});

const makeAssignmentLookup = (result: { data?: unknown; error?: Error | null }) => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve(result)),
  })),
});

const makeProfilesQuery = (result: { data?: unknown; error?: Error | null }) => {
  const query = {
    or: vi.fn(() => Promise.resolve(result)),
    in: vi.fn(() => Promise.resolve(result)),
  };

  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => query),
    })),
    query,
  };
};

describe("submission actions coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("covers student key normalization and upload failure reason fallbacks", () => {
    expect(normalizeStudentKey("Ada-Ibrahim.pdf")).toBe("ada ibrahim");
    expect(normalizeStudentKey(null)).toBe("");
    expect(normalizeStudentKey("  REPORT_final  ")).toBe("report final");
    expect(getSubmissionUploadFailureReason(undefined)).toBeNull();
    expect(getSubmissionUploadFailureReason({ message: "  upload failed  " })).toBe("upload failed");
    expect(getSubmissionUploadFailureReason({ message: "x".repeat(180) })).toHaveLength(160);
  });

  it("loads targeted student profiles through the cohort-only path", async () => {
    const cohortLookup = makeAssignmentLookup({ data: [{ cohort_id: "cohort-a" }], error: null });
    const departmentLookup = makeAssignmentLookup({ data: [], error: null });
    const profilesQuery = makeProfilesQuery({
      data: [{ id: "student-1", role: "student", cohort_id: "cohort-a" }],
      error: null,
    });

    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "assignment_cohorts") return cohortLookup;
      if (table === "assignment_departments") return departmentLookup;
      if (table === "profiles") return profilesQuery;
      throw new Error(`Unexpected table ${table}`);
    });

    const profiles = await loadTargetedStudentProfiles("assignment-1");

    expect(profiles).toEqual([{ id: "student-1", role: "student", cohort_id: "cohort-a" }]);
    expect(profilesQuery.query.in).toHaveBeenCalledWith("cohort_id", ["cohort-a"]);
    expect(profilesQuery.query.or).not.toHaveBeenCalled();
  });

  it("loads targeted student profiles through the department-only path", async () => {
    const cohortLookup = makeAssignmentLookup({ data: [], error: null });
    const departmentLookup = makeAssignmentLookup({ data: [{ department_name: "Law" }], error: null });
    const profilesQuery = makeProfilesQuery({
      data: [{ id: "student-2", role: "student", department_name: "Law" }],
      error: null,
    });

    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "assignment_cohorts") return cohortLookup;
      if (table === "assignment_departments") return departmentLookup;
      if (table === "profiles") return profilesQuery;
      throw new Error(`Unexpected table ${table}`);
    });

    const profiles = await loadTargetedStudentProfiles("assignment-1");

    expect(profiles).toEqual([{ id: "student-2", role: "student", department_name: "Law" }]);
    expect(profilesQuery.query.in).toHaveBeenCalledWith("department_name", ["Law"]);
    expect(profilesQuery.query.or).not.toHaveBeenCalled();
  });

  it("loads targeted student profiles through the combined path and returns early when nothing matches", async () => {
    const cohortLookup = makeAssignmentLookup({ data: [{ cohort_id: "cohort-a" }], error: null });
    const departmentLookup = makeAssignmentLookup({ data: [{ department_name: "Law" }], error: null });
    const profilesQuery = makeProfilesQuery({
      data: [{ id: "student-3", role: "student", cohort_id: "cohort-a", department_name: "Law" }],
      error: null,
    });

    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "assignment_cohorts") return cohortLookup;
      if (table === "assignment_departments") return departmentLookup;
      if (table === "profiles") return profilesQuery;
      throw new Error(`Unexpected table ${table}`);
    });

    const profiles = await loadTargetedStudentProfiles("assignment-1");

    expect(profiles).toEqual([
      { id: "student-3", role: "student", cohort_id: "cohort-a", department_name: "Law" },
    ]);
    expect(profilesQuery.query.or).toHaveBeenCalledWith("cohort_id.in.(cohort-a),department_name.in.(Law)");

    mocks.supabaseFrom.mockReset();
    const emptyCohort = makeAssignmentLookup({ data: [], error: null });
    const emptyDepartment = makeAssignmentLookup({ data: [], error: null });
    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "assignment_cohorts") return emptyCohort;
      if (table === "assignment_departments") return emptyDepartment;
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(loadTargetedStudentProfiles("assignment-1")).resolves.toEqual([]);
  });

  it("throws when cohort, department, or profile queries fail", async () => {
    const cohortError = new Error("cohort failed");
    const departmentError = new Error("department failed");
    const profileError = new Error("profile failed");

    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "assignment_cohorts") {
        return makeAssignmentLookup({ data: null, error: cohortError });
      }
      if (table === "assignment_departments") {
        return makeAssignmentLookup({ data: null, error: departmentError });
      }
      if (table === "profiles") {
        return makeProfilesQuery({ data: null, error: profileError });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(loadTargetedStudentProfiles("assignment-1")).rejects.toThrow("cohort failed");

    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "assignment_cohorts") {
        return makeAssignmentLookup({ data: [], error: null });
      }
      if (table === "assignment_departments") {
        return makeAssignmentLookup({ data: null, error: departmentError });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(loadTargetedStudentProfiles("assignment-1")).rejects.toThrow("department failed");

    const cohortLookup = makeAssignmentLookup({ data: [{ cohort_id: "cohort-a" }], error: null });
    const departmentLookup = makeAssignmentLookup({ data: [], error: null });
    const profilesQuery = makeProfilesQuery({ data: null, error: profileError });
    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "assignment_cohorts") return cohortLookup;
      if (table === "assignment_departments") return departmentLookup;
      if (table === "profiles") return profilesQuery;
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(loadTargetedStudentProfiles("assignment-1")).rejects.toThrow("profile failed");
  });

  it("persists workflow notifications across success, warning, and error paths", async () => {
    mocks.queueCommunicationMessage
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error("queue failed"));

    await persistWorkflowNotification(
      { category: "submission", recipientId: "student-1" } as never,
      { assignmentId: "assignment-1", workflow: "submission" },
    );
    await persistWorkflowNotification(
      { category: "submission", recipientId: "student-1" } as never,
      { assignmentId: "assignment-1", workflow: "submission" },
    );
    await persistWorkflowNotification(
      { category: "submission", recipientId: "student-1" } as never,
      { assignmentId: "assignment-1", workflow: "submission" },
    );

    expect(mocks.logWarn).toHaveBeenCalledWith(
      "Workflow notification did not persist",
      expect.objectContaining({
        assignmentId: "assignment-1",
        workflow: "submission",
      }),
    );
    expect(mocks.logError).toHaveBeenCalledWith(
      "Workflow notification failed",
      expect.any(Error),
      expect.objectContaining({
        assignmentId: "assignment-1",
        workflow: "submission",
      }),
    );
  });

  it("validates and uploads submission files across metadata, bytes, success, and storage failures", async () => {
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ data: { path: "student-1/assignment-1/1700000000000_notes.txt" }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("upload failed") });

    mocks.storageFrom.mockReturnValue({ upload });

    const validTxt = new File(["hello"], "folder/notes.txt", { type: "text/plain" });
    const result = await uploadSubmissionFile(validTxt, "student-1", "assignment-1", vi.fn());
    expect(result.fileName).toBe("folder_notes.txt");
    expect(result.storagePath).toBe("student-1/assignment-1/1700000000000_notes.txt");
    expect(upload).toHaveBeenCalledWith(
      "student-1/assignment-1/1700000000000_folder_notes.txt",
      validTxt,
      expect.objectContaining({
        contentType: "text/plain",
      }),
    );

    const invalidMetadata = new File(["hello"], "malware.exe", { type: "application/octet-stream" });
    await expect(uploadSubmissionFile(invalidMetadata, "student-1", "assignment-1")).rejects.toThrow(
      "Unsupported file type",
    );

    const invalidPdf = new File(["not-a-pdf"], "essay.pdf", { type: "application/pdf" });
    Object.defineProperty(invalidPdf, "arrayBuffer", {
      value: async () => new TextEncoder().encode("not-a-pdf").buffer,
    });
    await expect(uploadSubmissionFile(invalidPdf, "student-1", "assignment-1")).rejects.toThrow(
      "This PDF appears corrupted or incomplete",
    );

    const failingTxt = new File(["hello"], "notes.txt", { type: "text/plain" });
    await expect(uploadSubmissionFile(failingTxt, "student-1", "assignment-1")).rejects.toThrow(
      "upload failed",
    );
  });

  it("reports submission file open failures through toast error handling", async () => {
    mocks.storageFrom.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: new Error("signed-url failed") }),
    });

    const { result } = renderHook(() => useSubmissionFileActions());

    await act(async () => {
      await result.current.openSubmissionFile(createSubmission({ file_url: "submissions/ada-essay.pdf" }));
    });

    expect(mocks.logError).toHaveBeenCalledWith(
      "Failed to open submission file",
      expect.any(Error),
      expect.objectContaining({
        submissionId: "submission-1",
      }),
    );
    expect(mocks.toastError).toHaveBeenCalledWith("Could not open the file");
  });
});
