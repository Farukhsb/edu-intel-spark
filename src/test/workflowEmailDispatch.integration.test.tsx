import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Assignments from "@/pages/dashboard/Assignments";
import AssignmentDetail from "@/pages/dashboard/AssignmentDetail";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: false,
    role: "lecturer",
    user: { id: "lecturer-1", email: "lecturer@example.com" },
    profile: { id: "lecturer-1", role: "lecturer", full_name: "Dr Lecturer" },
  },
  assignmentsData: {
    assignments: [],
    submissionStats: {},
    studentWorkflow: {},
    loading: false,
    refreshAssignments: vi.fn(),
  },
  assignmentDetailData: {
    assignment: null,
    grades: {},
    integrityReviews: {},
    loading: false,
    moderationCases: {},
    plagiarismFlags: [],
    plagiarismSummary: "",
    reloadSubmissions: vi.fn(),
    setModerationCases: vi.fn(),
    setPlagiarismFlags: vi.fn(),
    setPlagiarismSummary: vi.fn(),
    submissions: [],
  },
  dispatchWorkflowNotificationEmail: vi.fn(),
  queueCommunicationMessage: vi.fn(),
  insertModerationAuditEntry: vi.fn(),
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

vi.mock("@/pages/dashboard/assignments/useAssignmentsData", () => ({
  useAssignmentsData: () => mocks.assignmentsData,
}));

vi.mock("@/pages/dashboard/assignment-detail/useAssignmentDetailData", () => ({
  useAssignmentDetailData: () => mocks.assignmentDetailData,
}));

vi.mock("@/lib/communications", async () => {
  const actual = await vi.importActual<typeof import("@/lib/communications")>("@/lib/communications");
  return {
    ...actual,
    dispatchWorkflowNotificationEmail: mocks.dispatchWorkflowNotificationEmail,
    queueCommunicationMessage: mocks.queueCommunicationMessage,
  };
});

vi.mock("@/lib/moderationWorkflow", async () => {
  const actual = await vi.importActual<typeof import("@/lib/moderationWorkflow")>("@/lib/moderationWorkflow");
  return {
    ...actual,
    insertModerationAuditEntry: mocks.insertModerationAuditEntry,
  };
});

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

describe("workflow email dispatch wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.authState.isDemo = false;
    mocks.authState.role = "lecturer";
    mocks.authState.user = { id: "lecturer-1", email: "lecturer@example.com" };
    mocks.authState.profile = { id: "lecturer-1", role: "lecturer", full_name: "Dr Lecturer" };

    mocks.assignmentsData.assignments = [];
    mocks.assignmentsData.submissionStats = {};
    mocks.assignmentsData.studentWorkflow = {};
    mocks.assignmentsData.loading = false;
    mocks.assignmentsData.refreshAssignments = vi.fn();

    mocks.assignmentDetailData.assignment = null;
    mocks.assignmentDetailData.grades = {};
    mocks.assignmentDetailData.integrityReviews = {};
    mocks.assignmentDetailData.loading = false;
    mocks.assignmentDetailData.moderationCases = {};
    mocks.assignmentDetailData.plagiarismFlags = [];
    mocks.assignmentDetailData.plagiarismSummary = "";
    mocks.assignmentDetailData.reloadSubmissions = vi.fn();
    mocks.assignmentDetailData.setModerationCases = vi.fn();
    mocks.assignmentDetailData.setPlagiarismFlags = vi.fn();
    mocks.assignmentDetailData.setPlagiarismSummary = vi.fn();
    mocks.assignmentDetailData.submissions = [];

    mocks.dispatchWorkflowNotificationEmail.mockResolvedValue({
      ok: true,
      status: "sent",
      reason: null,
    });
    mocks.queueCommunicationMessage.mockResolvedValue({ id: "comm-1" });
    mocks.insertModerationAuditEntry.mockResolvedValue({ error: null });
    mocks.toast.error.mockReset();
    mocks.toast.info.mockReset();
    mocks.toast.success.mockReset();
    mocks.toast.warning.mockReset();

    mocks.supabase.storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: { path: "uploads/student-1/assignment-1/sample.py" },
        error: null,
      }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps assignment publish on in-app bell notifications only", async () => {
    mocks.assignmentsData.assignments = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Algorithms Essay",
        description: "Draft assignment",
        module_code: "CS101",
        lecturer_id: "lecturer-1",
        max_score: 100,
        due_date: null,
        status: "draft",
        created_at: "2026-05-01T10:00:00.000Z",
        rubric: [],
        cohorts: [],
        departments: [],
        target_cohorts: [],
        target_departments: [],
      },
    ];

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "assignments") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }

      if (table === "assignment_cohorts" || table === "assignment_departments") {
        return {
          select: vi.fn(() => ({
            eq: vi
              .fn()
              .mockResolvedValue(
                table === "assignment_cohorts"
                  ? { data: [{ cohort_id: "200" }], error: null }
                  : { data: [], error: null },
              ),
          })),
        };
      }

      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "student-1",
                    full_name: "Student One",
                    email: "student1@example.com",
                    role: "student",
                    cohort_id: "200",
                    department_id: "Computer Science",
                  },
                ],
                error: null,
              }),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Assignments />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(mocks.assignmentsData.refreshAssignments).toHaveBeenCalled();
    });
    expect(mocks.queueCommunicationMessage).toHaveBeenCalled();
    expect(mocks.dispatchWorkflowNotificationEmail).not.toHaveBeenCalled();
  });

  it("keeps assignment publish non-blocking when bell targeting is missing", async () => {
    mocks.assignmentsData.assignments = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Algorithms Essay",
        description: "Draft assignment",
        module_code: "CS101",
        lecturer_id: "lecturer-1",
        max_score: 100,
        due_date: null,
        status: "draft",
        created_at: "2026-05-01T10:00:00.000Z",
        rubric: [],
        cohorts: [],
        departments: [],
        target_cohorts: [],
        target_departments: [],
      },
    ];
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "assignments") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }

      if (table === "assignment_cohorts" || table === "assignment_departments") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }

      if (table === "communication_messages") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Assignments />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(mocks.assignmentsData.refreshAssignments).toHaveBeenCalled();
    });
    expect(mocks.toast.warning).toHaveBeenCalled();
    expect(mocks.dispatchWorkflowNotificationEmail).not.toHaveBeenCalled();
  });

  it("saves a submission-received bell notification after a student submission is saved", async () => {
    mocks.authState.role = "student";
    mocks.authState.user = { id: "student-1", email: "student@example.com" };
    mocks.authState.profile = {
      id: "student-1",
      role: "student",
      full_name: "Student One",
    };

    mocks.assignmentDetailData.assignment = {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Python Lab",
      description: "Upload your code",
      module_code: "CS102",
      max_score: 100,
      due_date: null,
      status: "published",
      lecturer_id: "lecturer-1",
      rubric: [],
    };
    mocks.assignmentDetailData.submissions = [];

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "submissions") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "33333333-3333-4333-8333-333333333333" },
                error: null,
              }),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { container } = render(
      <MemoryRouter
        initialEntries={["/dashboard/assignments/22222222-2222-4222-8222-222222222222"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/dashboard/assignments/:id" element={<AssignmentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(["print('hello')"], "sample.py", {
      type: "text/x-python",
    });

    fireEvent.change(fileInput!, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(mocks.queueCommunicationMessage).toHaveBeenCalled();
    });
    expect(mocks.dispatchWorkflowNotificationEmail).not.toHaveBeenCalled();
  });

  it("keeps student submission successful when the bell notification save resolves", async () => {
    mocks.authState.role = "student";
    mocks.authState.user = { id: "student-1", email: "student@example.com" };
    mocks.authState.profile = {
      id: "student-1",
      role: "student",
      full_name: "Student One",
    };
    mocks.assignmentDetailData.assignment = {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Python Lab",
      description: "Upload your code",
      module_code: "CS102",
      max_score: 100,
      due_date: null,
      status: "published",
      lecturer_id: "lecturer-1",
      rubric: [],
    };
    mocks.assignmentDetailData.submissions = [];

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "submissions") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "33333333-3333-4333-8333-333333333333" },
                error: null,
              }),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { container } = render(
      <MemoryRouter
        initialEntries={["/dashboard/assignments/22222222-2222-4222-8222-222222222222"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/dashboard/assignments/:id" element={<AssignmentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    const file = new File(["print('hello')"], "sample.py", {
      type: "text/x-python",
    });

    fireEvent.change(fileInput!, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(mocks.assignmentDetailData.reloadSubmissions).toHaveBeenCalled();
    });
    expect(mocks.toast.success).toHaveBeenCalledWith("Submission uploaded successfully");
    expect(mocks.dispatchWorkflowNotificationEmail).not.toHaveBeenCalled();
  });

  it("keeps grade release on bell notifications only", async () => {
    mocks.assignmentDetailData.assignment = {
      id: "44444444-4444-4444-8444-444444444444",
      title: "Database Project",
      description: "Final project",
      module_code: "CS203",
      max_score: 100,
      due_date: null,
      status: "published",
      lecturer_id: "lecturer-1",
      rubric: [],
    };
    mocks.assignmentDetailData.submissions = [
      {
        id: "55555555-5555-4555-8555-555555555555",
        assignment_id: "44444444-4444-4444-8444-444444444444",
        student_name: "Student Two",
        student_email: "student2@example.com",
        student_id: "student-2",
        file_name: "project.py",
        file_type: "text/x-python",
        file_url: "uploads/project.py",
        status: "approved",
        submitted_at: "2026-05-01T11:00:00.000Z",
      },
    ];
    mocks.assignmentDetailData.grades = {
      "55555555-5555-4555-8555-555555555555": {
        id: "grade-1",
        submission_id: "55555555-5555-4555-8555-555555555555",
        ai_score: 72,
        ai_feedback: "Good structure",
        ai_breakdown: [],
        assignment_type: "programming",
        grading_confidence: 0.8,
        grading_metadata: null,
        lecturer_score: 75,
        lecturer_feedback: "Approved",
        final_score: 75,
        final_feedback: "Released",
      },
    };

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "submissions") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    render(
      <MemoryRouter
        initialEntries={["/dashboard/assignments/44444444-4444-4444-8444-444444444444"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/dashboard/assignments/:id" element={<AssignmentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByTestId("submission-release-55555555-5555-4555-8555-555555555555"));

    await waitFor(() => {
      expect(mocks.queueCommunicationMessage).toHaveBeenCalled();
    });
    expect(mocks.dispatchWorkflowNotificationEmail).not.toHaveBeenCalled();
  });
});
