import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminDashboard from "@/pages/dashboard/AdminDashboard";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
  from: vi.fn(),
  useAuth: vi.fn(),
  consoleError: vi.fn(),
  consoleWarn: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.useAuth(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

const profiles = [
  {
    id: "admin-1",
    full_name: "Admin Person",
    email: "admin@gradeai.test",
    role: "admin",
    department_name: "Computer Science",
    department_id: "Computer Science",
    cohort_id: null,
    institution_id: "institution-1",
    must_change_password: false,
    created_at: "2026-04-28T10:00:00.000Z",
  },
  {
    id: "student-1",
    full_name: "Sam Student",
    email: "student@gradeai.test",
    role: "student",
    department_name: "Economics",
    department_id: "Economics",
    cohort_id: "year1",
    institution_id: "institution-1",
    must_change_password: true,
    created_at: "2026-04-28T10:00:00.000Z",
  },
  {
    id: "lecturer-1",
    full_name: "Dr Ada Lecturer",
    email: "lecturer@gradeai.test",
    role: "lecturer",
    department_name: "Computer Science",
    department_id: "Computer Science",
    cohort_id: null,
    institution_id: "institution-1",
    must_change_password: false,
    created_at: "2026-04-28T10:00:00.000Z",
  },
];

const institution = {
  id: "institution-1",
  name: "Default Institution",
  slug: "default",
  status: "active",
};

const assignments = [
  {
    id: "assignment-1",
    title: "Algorithms Essay",
    module_code: "CS101",
    status: "published",
    due_date: null,
    created_at: "2026-04-28T10:00:00.000Z",
    lecturer_id: "lecturer-1",
  },
];

const submissions = [
  {
    id: "submission-1",
    assignment_id: "assignment-1",
    student_name: "Sam Student",
    student_email: "student@gradeai.test",
    status: "released",
    submitted_at: "2026-04-28T10:00:00.000Z",
    file_name: "essay.pdf",
  },
];

const moderationCases = [
  {
    id: "moderation-1",
    assignment_id: "assignment-1",
    submission_id: "submission-1",
    first_marker_id: "lecturer-1",
    moderator_id: "lecturer-1",
    status: "approved",
    integrity_risk_score: 82,
    confidence_score: 61,
    created_at: "2026-04-28T09:00:00.000Z",
    updated_at: "2026-04-30T10:00:00.000Z",
    trigger_summary: "High similarity detected",
    first_marker_score: 58,
    moderator_score: 61,
    final_agreed_score: 61,
    final_agreed_feedback: "Moderator confirmed final outcome.",
    moderated_at: "2026-04-29T10:00:00.000Z",
    approved_at: "2026-04-30T10:00:00.000Z",
  },
];

const auditRows = [
  {
    id: "audit-1",
    created_at: "2026-04-28T10:00:00.000Z",
    action_type: "role_changed",
    actor_role: "admin",
    target_user_name: "Sam Student",
    target_user_email: "student@gradeai.test",
    details: {
      actor_name: "Admin Person",
      previous_role: "student",
      updated_role: "lecturer",
    },
  },
];

const integrityReviews = [
  {
    id: "review-1",
    submission_id: "submission-1",
    decision: "investigate",
    lecturer_note:
      '{"latestNote":"Review similarity with cohort submission.","history":[],"integritySnapshot":{"totalScore":82,"aiWritingScore":12,"similarityScore":78,"riskLevel":"high","evidence":{"aiWriting":[],"similarity":[]},"flags":["uncited overlap"]}}',
    review_type: "similarity",
    created_at: "2026-04-29T09:00:00.000Z",
    updated_at: "2026-04-30T09:30:00.000Z",
  },
];

const gradeAuditRows = [
  {
    id: "grade-audit-1",
    created_at: "2026-04-30T10:15:00.000Z",
    event_type: "moderation_approved",
    submission_id: "submission-1",
    moderation_case_id: "moderation-1",
    reason: "Moderator approved final score",
  },
];

const workflowNotificationLogs = [
  {
    id: "notification-1",
    created_at: "2026-04-30T11:00:00.000Z",
    delivery_status: "sent",
    sent_at: "2026-04-30T11:02:00.000Z",
    last_error: null,
  },
  {
    id: "notification-2",
    created_at: "2026-04-30T11:30:00.000Z",
    delivery_status: "failed",
    sent_at: null,
    last_error: "Resend rejected",
  },
];

const workflowRuns = [
  {
    id: "workflow-run-1",
    created_at: "2026-04-30T12:00:00.000Z",
    started_at: "2026-04-30T12:00:00.000Z",
    finished_at: "2026-04-30T12:00:06.000Z",
    duration_ms: 6000,
    workflow_name: "grade-submission",
    status: "failed",
    provider: "openai",
    model: "gpt-4o-mini",
    retry_count: 0,
    failure_category: "service_failure",
    details: {
      grading_pass_count: 3,
      provider_retry_count: 0,
      submission_count: 1,
      workflow: "grade-submission",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "failed",
    },
  },
];

const academicAccessEvents = [
  {
    id: "access-1",
    created_at: "2026-04-30T11:30:00.000Z",
    actor_id: "lecturer-1",
    actor_role: "lecturer",
    event_type: "moderation_evidence_viewed",
    resource_type: "moderation_case",
    resource_id: "moderation-1",
    assignment_id: "assignment-1",
    submission_id: "submission-1",
    moderation_case_id: "moderation-1",
    metadata: {
      source: "moderation_review_dialog",
      status: "approved",
    },
  },
];

const largeProfiles = [
  ...profiles,
  ...Array.from({ length: 12 }, (_, index) => ({
    id: `student-extra-${index + 1}`,
    full_name: `Student Extra ${index + 1}`,
    email: `extra${index + 1}@gradeai.test`,
    role: "student",
    department_name: "Mathematics",
    department_id: "Mathematics",
    cohort_id: "year1",
    institution_id: "institution-1",
    must_change_password: false,
    created_at: `2026-04-${String((index % 9) + 10).padStart(2, "0")}T10:00:00.000Z`,
  })),
];

const largeAssignments = [
  ...assignments,
  {
    id: "assignment-2",
    title: "Networks Report",
    module_code: "CS202",
    status: "draft",
    due_date: null,
    created_at: "2026-04-29T10:00:00.000Z",
    lecturer_id: "lecturer-1",
  },
];

const largeSubmissions = [
  ...submissions,
  ...Array.from({ length: 12 }, (_, index) => ({
    id: `submission-extra-${index + 1}`,
    assignment_id: index % 2 === 0 ? "assignment-1" : "assignment-2",
    student_name: `Student Extra ${index + 1}`,
    student_email: `extra${index + 1}@gradeai.test`,
    status: index % 3 === 0 ? "submitted" : "released",
    submitted_at: `2026-04-${String((index % 9) + 10).padStart(2, "0")}T11:00:00.000Z`,
    file_name: index === 4 ? "target-file.pdf" : `essay-${index + 1}.pdf`,
  })),
];

const buildQueryResponse = (
  table: string,
  options?: {
    profilesData?: typeof profiles;
    assignmentsData?: typeof assignments;
    submissionsData?: typeof submissions;
  },
) => {
  const profilesData = options?.profilesData ?? profiles;
  const assignmentsData = options?.assignmentsData ?? assignments;
  const submissionsData = options?.submissionsData ?? submissions;

  if (table === "profiles") {
    return {
      select: () => ({
        order: vi.fn().mockResolvedValue({
          data: profilesData,
          error: null,
        }),
      }),
    };
  }

  if (table === "institutions") {
    return {
      select: () => ({
        limit: () => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: institution,
            error: null,
          }),
        }),
      }),
    };
  }

  if (table === "assignments") {
    return {
      select: (_columns: string, options?: { count?: string; head?: boolean }) => {
        if (options?.head) {
          return Promise.resolve({ count: assignmentsData.length, error: null });
        }

        return {
          order: vi.fn().mockResolvedValue({
            data: assignmentsData,
            error: null,
          }),
        };
      },
    };
  }

  if (table === "submissions") {
    return {
      select: (_columns: string, options?: { count?: string; head?: boolean }) => {
        if (options?.head) {
          return Promise.resolve({ count: submissionsData.length, error: null });
        }

        return {
          order: vi.fn().mockResolvedValue({
            data: submissionsData,
            error: null,
          }),
        };
      },
    };
  }

  if (table === "moderation_cases") {
    return {
      select: () => ({
        order: vi.fn().mockResolvedValue({
          data: moderationCases,
          error: null,
        }),
      }),
    };
  }

  if (table === "admin_audit_log") {
    return {
      select: () => ({
        order: () => ({
          limit: vi.fn().mockResolvedValue({
            data: auditRows,
            error: null,
          }),
        }),
      }),
    };
  }

  if (table === "grade_audit_log") {
    return {
      select: (_columns?: string, options?: { count?: string; head?: boolean }) => {
        if (options?.head) {
          return {
            eq: () => ({
              gte: vi.fn().mockResolvedValue({
                count: 0,
                error: null,
              }),
            }),
          };
        }

        return {
          order: () => ({
            limit: vi.fn().mockResolvedValue({
              data: gradeAuditRows,
              error: null,
            }),
          }),
        };
      },
    };
  }

  if (table === "academic_integrity_reviews") {
    return {
      select: () => ({
        order: () => ({
          limit: vi.fn().mockResolvedValue({
            data: integrityReviews,
            error: null,
          }),
        }),
      }),
    };
  }

  if (table === "academic_access_events") {
    return {
      select: () => ({
        order: () => ({
          limit: vi.fn().mockResolvedValue({
            data: academicAccessEvents,
            error: null,
          }),
        }),
      }),
    };
  }

  if (table === "grades") {
    return {
      select: () => ({
        order: () => ({
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    };
  }

  if (table === "workflow_runs") {
    return {
      select: () => ({
        gte: () => ({
          order: () => ({
            limit: vi.fn().mockResolvedValue({
              data: workflowRuns,
              error: null,
            }),
          }),
        }),
      }),
    };
  }

  if (table === "communication_messages") {
    return {
      select: () => ({
        order: () => ({
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    };
  }

  if (table === "workflow_notification_log") {
    return {
      select: () => ({
        gte: () => ({
          order: () => ({
            limit: vi.fn().mockResolvedValue({
              data: workflowNotificationLogs,
              error: null,
            }),
          }),
        }),
      }),
    };
  }

  throw new Error(`Unexpected table: ${table}`);
};

describe("AdminDashboard", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(console, "error").mockImplementation(mocks.consoleError);
    vi.spyOn(console, "warn").mockImplementation(mocks.consoleWarn);
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.invoke.mockReset();
    mocks.invoke.mockResolvedValue({ error: null });
    mocks.from.mockReset();
    mocks.from.mockImplementation((table: string) => buildQueryResponse(table));
    mocks.useAuth.mockReturnValue({
      profile: { id: "admin-1", role: "admin" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("limits role changes to student and lecturer, requires confirmation, and loads audit history", async () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=users"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /User and role management/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Promote to Lecturer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Demote to Student" })).toBeInTheDocument();
    expect(screen.getAllByText("Economics").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Year 1 (Level 4)").length).toBeGreaterThan(0);
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.queryByText(/Promote to Admin/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Promote to Lecturer" }));

    expect(await screen.findByText("Confirm role change")).toBeInTheDocument();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Sam Student");
    expect(dialog).toHaveTextContent("student");
    expect(dialog).toHaveTextContent("lecturer");

    fireEvent.click(screen.getByRole("button", { name: "Confirm Change" }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("admin-set-user-role", {
        body: {
          targetUserId: "student-1",
          nextRole: "lecturer",
        },
      });
    });

    expect(mocks.from).toHaveBeenCalledWith("admin_audit_log");
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it("opens an admin-safe user summary modal instead of routing students into lecturer-only pages", async () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=users&filter=student"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /User and role management/i })).toBeInTheDocument();
    expect(screen.getByText("Sam Student")).toBeInTheDocument();
    expect(screen.queryByText("Dr Ada Lecturer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(await screen.findByRole("heading", { name: "User summary" })).toBeInTheDocument();
    expect(screen.getByText(/Admin-safe profile summary/i)).toBeInTheDocument();
    expect(screen.getAllByText("Sam Student").length).toBeGreaterThan(0);
    expect(screen.getAllByText("student@gradeai.test").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Economics").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Year 1 (Level 4)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Required").length).toBeGreaterThan(0);
  });

  it("can sync auth metadata for an existing user without changing the database role", async () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=users&filter=student"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /User and role management/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sync auth metadata" }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("admin-set-user-role", {
        body: {
          targetUserId: "student-1",
          syncOnly: true,
        },
      });
    });

    expect(mocks.toastSuccess).toHaveBeenCalledWith("Auth metadata synced for Sam Student.");
  });

  it("lets admins edit institution-managed profile fields through the profile modal", async () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=users&filter=student"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /User and role management/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));

    expect(await screen.findByRole("heading", { name: "Edit profile" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Role" }));
    expect(await screen.findByRole("option", { name: "student" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "lecturer" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "admin" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "moderator" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "external_examiner" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "student" }));
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Samuel Student" },
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Department" }));
    fireEvent.click(await screen.findByRole("option", { name: "Mathematics" }));
    fireEvent.click(screen.getByLabelText("Password reset required?"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith("admin_update_user_profile", {
        target_user_id: "student-1",
        new_full_name: "Samuel Student",
        new_role: "student",
        new_department_name: "Mathematics",
        new_cohort_id: "year1",
        new_must_change_password: false,
      });
    });

    expect(mocks.toastSuccess).toHaveBeenCalledWith("Profile updated for Samuel Student.");
  });

  it("uses observational wording in system health instead of claiming definitive live service health", async () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=system"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Failure dashboard/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /Operational alerts/i })).toBeInTheDocument();
    expect(screen.getByText("Release backlog")).toBeInTheDocument();
    expect(screen.getByText("Stale workflow heartbeat")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /System health/i })).toBeInTheDocument();
    expect(screen.getByText("Read snapshot succeeded")).toBeInTheDocument();
    expect(screen.getByText("AI grading workflow signal")).toBeInTheDocument();
    expect(screen.getByText("1 failed run")).toBeInTheDocument();
    expect(screen.getByText(/Latest grade-submission run failed/i)).toBeInTheDocument();
    expect(screen.getByText("Workflow notification delivery")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
    expect(screen.queryByText(/^Healthy$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Online$/)).not.toBeInTheDocument();
  });

  it("supports user search and pagination in the full users table", async () => {
    mocks.from.mockImplementation((table: string) =>
      buildQueryResponse(table, {
        profilesData: largeProfiles,
        assignmentsData: largeAssignments,
        submissionsData: largeSubmissions,
      }),
    );

    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=users"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /User and role management/i })).toBeInTheDocument();
    expect(screen.getByText(/Users page 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText("Student Extra 1")).toBeInTheDocument();
    expect(screen.queryByText("Student Extra 12")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText(/Users page 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByText("Student Extra 12")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search users"), {
      target: { value: "extra12@gradeai.test" },
    });

    expect(await screen.findByText("Student Extra 12")).toBeInTheDocument();
    expect(screen.queryByText("Student Extra 11")).not.toBeInTheDocument();
  });

  it("supports submission search in the full submissions table", async () => {
    mocks.from.mockImplementation((table: string) =>
      buildQueryResponse(table, {
        profilesData: largeProfiles,
        assignmentsData: largeAssignments,
        submissionsData: largeSubmissions,
      }),
    );

    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=submissions"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Recent submissions/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search submissions"), {
      target: { value: "target-file.pdf" },
    });

    expect(await screen.findByText("target-file.pdf")).toBeInTheDocument();
    expect(screen.queryByText("essay-12.pdf")).not.toBeInTheDocument();
  });

  it("shows bulk student upload in the admin dashboard header", async () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Intervention and Oversight/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bulk Upload Students" })).toBeInTheDocument();
    expect(screen.getByText("Default Institution")).toBeInTheDocument();
    expect(screen.getByText(/Tenant scope:/i)).toHaveTextContent("Tenant scope: default · active");
  });

  it("shows a page-level error state when the admin dashboard cannot be loaded", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            order: vi.fn().mockRejectedValue(new Error("profiles unavailable")),
          }),
        };
      }

      return buildQueryResponse(table);
    });

    render(
      <MemoryRouter
        initialEntries={["/dashboard"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Admin dashboard unavailable")).toBeInTheDocument();
    expect(screen.getByText("Admin dashboard data could not be loaded right now.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows bulk student upload in user management but not in academic oversight views", async () => {
    let view = render(
      <MemoryRouter
        initialEntries={["/dashboard?view=users"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /User and role management/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bulk Upload Students" })).toBeInTheDocument();

    view.unmount();

    view = render(
      <MemoryRouter
        initialEntries={["/dashboard?view=assignments"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Assignment oversight/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bulk Upload Students" })).not.toBeInTheDocument();

    view.unmount();

    view = render(
      <MemoryRouter
        initialEntries={["/dashboard?view=submissions"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Recent submissions/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bulk Upload Students" })).not.toBeInTheDocument();

    view.unmount();

    view = render(
      <MemoryRouter
        initialEntries={["/dashboard?view=moderation"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Integrity and moderation queue/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bulk Upload Students" })).not.toBeInTheDocument();
  });

  it("renders the data access log governance view with real audit rows and no write controls", async () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=data-access-log"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Data access log/i })).toBeInTheDocument();
    expect(screen.getByText(/Using available admin and workflow audit events/i)).toBeInTheDocument();
    expect(screen.getByText("Admin Person")).toBeInTheDocument();
    expect(screen.getByText("Dr Ada Lecturer")).toBeInTheDocument();
    expect(screen.getByText("lecturer")).toBeInTheDocument();
    expect(screen.getByText(/role changed/i)).toBeInTheDocument();
    expect(screen.getByText(/moderation evidence viewed/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Release/i })).not.toBeInTheDocument();
  });

  it("renders the compliance hub with tabbed governance views", async () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=compliance"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Audit and governance views")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Data Access Log" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Academic Integrity Overview" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Moderation Audit" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Policy Exceptions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Data access log/i })).toBeInTheDocument();
  });

  it("renders the academic integrity overview from real integrity review data", async () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=integrity-overview"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Academic integrity overview/i })).toBeInTheDocument();
    expect(screen.getByText("Total integrity reviews")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Algorithms Essay").length).toBeGreaterThan(0);
    expect(screen.getByText("Sam Student")).toBeInTheDocument();
    expect(screen.getByText(/investigate/i)).toBeInTheDocument();
  });

  it("renders the moderation audit from real moderation data", async () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=moderation-audit"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Moderation audit/i })).toBeInTheDocument();
    expect(screen.getByText("Final score 61")).toBeInTheDocument();
    expect(screen.getByText("Moderator confirmed final outcome.")).toBeInTheDocument();
  });

  it("renders the policy exceptions view with the unavailable-check notice", async () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=policy-exceptions"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: /Policy exceptions/i })).toBeInTheDocument();
    expect(screen.getByText(/Not yet recorded: submission text-extraction completeness/i)).toBeInTheDocument();
  });

  it("shows empty governance states when no admin governance rows are visible", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "moderation_cases") {
        return {
          select: () => ({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        };
      }

      if (table === "admin_audit_log" || table === "academic_integrity_reviews" || table === "academic_access_events") {
        return {
          select: () => ({
            order: () => ({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "grade_audit_log") {
        return {
          select: (_columns?: string, options?: { count?: string; head?: boolean }) => {
            if (options?.head) {
              return {
                eq: () => ({
                  gte: vi.fn().mockResolvedValue({
                    count: 0,
                    error: null,
                  }),
                }),
              };
            }

            return {
              order: () => ({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            };
          },
        };
      }

      return buildQueryResponse(table);
    });

    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=data-access-log"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No audit events are visible")).toBeInTheDocument();
  });

  it("shows unavailable governance states when integrity or audit sources cannot be read", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "admin_audit_log") {
        return {
          select: () => ({
            order: () => ({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: new Error("admin audit unavailable"),
              }),
            }),
          }),
        };
      }

      if (table === "grade_audit_log") {
        return {
          select: (_columns?: string, options?: { count?: string; head?: boolean }) => {
            if (options?.head) {
              return {
                eq: () => ({
                  gte: vi.fn().mockResolvedValue({
                    count: null,
                    error: new Error("grade audit unavailable"),
                  }),
                }),
              };
            }

            return {
              order: () => ({
                limit: vi.fn().mockResolvedValue({
                  data: null,
                  error: new Error("grade audit unavailable"),
                }),
              }),
            };
          },
        };
      }

      if (table === "academic_integrity_reviews") {
        return {
          select: () => ({
            order: () => ({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: new Error("integrity unavailable"),
              }),
            }),
          }),
        };
      }

      if (table === "academic_access_events") {
        return {
          select: () => ({
            order: () => ({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: new Error("academic access unavailable"),
              }),
            }),
          }),
        };
      }

      return buildQueryResponse(table);
    });

    render(
      <MemoryRouter
        initialEntries={["/dashboard?view=integrity-overview"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Currently unavailable")).toBeInTheDocument();
  });
});
