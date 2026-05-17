import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  demoAuth: {
    profile: {
      id: "demo-lecturer",
      full_name: "Dr. Demo Lecturer",
      email: "demo@gradeai.com",
      role: "lecturer",
    },
    user: {
      id: "demo-lecturer",
      email: "demo@gradeai.com",
    },
    signOut: vi.fn(),
    isDemo: true,
  },
}));

describe("demo bootstrap isolation", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/lib/env");
    vi.doUnmock("@/contexts/AuthContext");
  });

  it("renders top-level demo pages without Supabase env", async () => {
    vi.doMock("@/lib/env", () => ({
      getEnv: () => {
        throw new Error("Invalid environment configuration: VITE_SUPABASE_URL");
      },
    }));

    vi.doMock("@/contexts/AuthContext", () => ({
      useAuth: () => mocks.demoAuth,
    }));

    const [{ DashboardLayout }, { default: AcademicIntegrity }, { default: StudentGrades }] = await Promise.all([
      import("@/components/DashboardLayout"),
      import("@/pages/dashboard/AcademicIntegrity"),
      import("@/pages/dashboard/StudentGrades"),
    ]);

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <AcademicIntegrity />
          <StudentGrades />
        </DashboardLayout>
      </MemoryRouter>,
    );

    expect(await screen.findAllByText("Demo")).not.toHaveLength(0);
    expect(await screen.findByText("Academic Integrity Review Queue")).toBeInTheDocument();
    expect(await screen.findByText("Your results, Dr.")).toBeInTheDocument();
  });
});
