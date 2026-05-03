import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminDashboard from "@/pages/dashboard/AdminDashboard";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
  from: vi.fn(),
  useAuth: vi.fn(),
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
    created_at: "2026-04-28T10:00:00.000Z",
  },
  {
    id: "student-1",
    full_name: "Sam Student",
    email: "student@gradeai.test",
    role: "student",
    created_at: "2026-04-28T10:00:00.000Z",
  },
  {
    id: "lecturer-1",
    full_name: "Dr Ada Lecturer",
    email: "lecturer@gradeai.test",
    role: "lecturer",
    created_at: "2026-04-28T10:00:00.000Z",
  },
];

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

const auditRows = [
  {
    id: "audit-1",
    created_at: "2026-04-28T10:00:00.000Z",
    target_user_name: "Sam Student",
    target_user_email: "student@gradeai.test",
    details: {
      actor_name: "Admin Person",
      previous_role: "student",
      updated_role: "lecturer",
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
          data: [],
          error: null,
        }),
      }),
    };
  }

  if (table === "admin_audit_log") {
    return {
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: vi.fn().mockResolvedValue({
              data: auditRows,
              error: null,
            }),
          }),
        }),
      }),
    };
  }

  if (table === "grade_audit_log") {
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

  throw new Error(`Unexpected table: ${table}`);
};

describe("AdminDashboard", () => {
  beforeEach(() => {
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
    expect(screen.getByText("No role change")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Promote to Lecturer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Demote to Student" })).toBeInTheDocument();
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
    expect(screen.getByText("Profile record only")).toBeInTheDocument();
    expect(screen.getByText("Sam Student")).toBeInTheDocument();
    expect(screen.queryByText("Dr Ada Lecturer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(await screen.findByRole("heading", { name: "User summary" })).toBeInTheDocument();
    expect(screen.getByText(/Admin-safe profile summary/i)).toBeInTheDocument();
    expect(screen.getAllByText("Sam Student").length).toBeGreaterThan(0);
    expect(screen.getAllByText("student@gradeai.test").length).toBeGreaterThan(0);
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

    expect(await screen.findByRole("heading", { name: /System health/i })).toBeInTheDocument();
    expect(screen.getByText("Read snapshot succeeded")).toBeInTheDocument();
    expect(screen.getAllByText("No direct signal").length).toBeGreaterThan(0);
    expect(screen.getByText(/direct grading-run telemetry is not yet exposed here/i)).toBeInTheDocument();
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
});
