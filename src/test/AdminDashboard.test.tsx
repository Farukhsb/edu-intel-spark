import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminDashboard from "@/pages/dashboard/AdminDashboard";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  rpc: vi.fn(),
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

const buildQueryResponse = (table: string) => {
  if (table === "profiles") {
    return {
      select: () => ({
        order: vi.fn().mockResolvedValue({
          data: profiles,
          error: null,
        }),
      }),
    };
  }

  if (table === "assignments") {
    return {
      select: (_columns: string, options?: { count?: string; head?: boolean }) => {
        if (options?.head) {
          return Promise.resolve({ count: assignments.length, error: null });
        }

        return {
          order: vi.fn().mockResolvedValue({
            data: assignments,
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
          return Promise.resolve({ count: submissions.length, error: null });
        }

        return {
          order: vi.fn().mockResolvedValue({
            data: submissions,
            error: null,
          }),
        };
      },
    };
  }

  if (table === "moderation_cases") {
    return {
      select: () => Promise.resolve({ count: 0, error: null }),
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

  throw new Error(`Unexpected table: ${table}`);
};

describe("AdminDashboard", () => {
  beforeEach(() => {
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ error: null });
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

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
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
      expect(mocks.rpc).toHaveBeenCalledWith("admin_set_user_role", {
        p_target_user_id: "student-1",
        p_target_role: "lecturer",
      });
    });

    expect(mocks.from).toHaveBeenCalledWith("admin_audit_log");
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });
});
