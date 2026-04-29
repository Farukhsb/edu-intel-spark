import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AssignmentDetail from "@/pages/dashboard/AssignmentDetail";
import Assignments from "@/pages/dashboard/Assignments";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: false,
    role: "student",
    user: { id: "student-1", email: "student@example.com" },
    profile: { id: "student-1", email: "student@example.com", role: "student" },
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

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("student assignment due-date visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState.isDemo = false;
    mocks.authState.role = "student";
    mocks.authState.user = { id: "student-1", email: "student@example.com" };
    mocks.authState.profile = { id: "student-1", email: "student@example.com", role: "student" };
    mocks.supabase.storage.from.mockReturnValue({
      upload: vi.fn(),
      createSignedUrl: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("hides overdue published assignments from the student list", async () => {
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "assignments") {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "future-assignment",
                  title: "Visible Assignment",
                  description: "Future due date",
                  module_code: "CS101",
                  lecturer_id: "lecturer-1",
                  max_score: 100,
                  due_date: "2999-04-29T13:00:00.000Z",
                  status: "published",
                  created_at: "2026-04-28T12:00:00.000Z",
                  rubric: [],
                },
                {
                  id: "past-assignment",
                  title: "Expired Assignment",
                  description: "Past due date",
                  module_code: "CS102",
                  lecturer_id: "lecturer-1",
                  max_score: 100,
                  due_date: "2000-04-29T11:00:00.000Z",
                  status: "published",
                  created_at: "2026-04-27T12:00:00.000Z",
                  rubric: [],
                },
              ],
              error: null,
            }),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Assignments />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Visible Assignment")).toBeInTheDocument();
    expect(screen.queryByText("Expired Assignment")).not.toBeInTheDocument();
  });

  it("blocks direct student access to an overdue assignment detail page", async () => {
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "assignments") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "past-assignment",
                  title: "Expired Assignment",
                  description: "Past due date",
                  module_code: "CS102",
                  lecturer_id: "lecturer-1",
                  max_score: 100,
                  due_date: "2000-04-29T11:00:00.000Z",
                  status: "published",
                  rubric: [],
                },
              }),
            })),
          })),
        };
      }

      if (table === "submissions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [] }),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    render(
      <MemoryRouter
        initialEntries={["/dashboard/assignments/past-assignment"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/dashboard/assignments/:id" element={<AssignmentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Assignment not found or access denied")).toBeInTheDocument();
    });
    expect(screen.queryByText("Expired Assignment")).not.toBeInTheDocument();
  });
});
