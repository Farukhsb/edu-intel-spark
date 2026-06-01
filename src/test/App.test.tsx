import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerState = vi.hoisted(() => ({
  initialEntries: ["/privacy"],
}));

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
  isDemo: false,
  profileError: null as string | null,
  signOut: vi.fn(),
  mustChangePassword: false,
  role: null as "student" | "lecturer" | "admin" | null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: any }) => <>{children}</>,
  useAuth: () => authState,
}));

vi.mock("@/components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: any }) => <>{children}</>,
}));

vi.mock("@/pages/dashboard/StudentGrades", () => ({
  default: () => <div>Student grades page</div>,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    BrowserRouter: ({ children }: { children: any }) => (
      <actual.MemoryRouter
        initialEntries={routerState.initialEntries}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {children}
      </actual.MemoryRouter>
    ),
  };
});

import App from "@/App";

describe("App legal routes", () => {
  afterEach(() => {
    cleanup();
    routerState.initialEntries = ["/privacy"];
    authState.user = null;
    authState.role = null;
  });

  it("renders the privacy notice on /privacy with pilot and decision-support wording", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Privacy notice" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "GradeAI is designed as a decision-support tool. It should not be used to make fully automated final academic decisions about grades, misconduct, progression, or student support.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Pilot data retention note")).toBeInTheDocument();
    expect(
      screen.getByText(/Academic records, submissions, grades, workflow history, and audit data should not be kept indefinitely by default/i),
    ).toBeInTheDocument();
  });

  it("renders the terms of service on /terms with pilot-stage boundaries", async () => {
    routerState.initialEntries = ["/terms"];

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Terms of service" })).toBeInTheDocument();
    expect(screen.getByText("Controlled pilot use")).toBeInTheDocument();
    expect(
      screen.getByText(
        "AI grading, integrity signals, feedback drafting, and student-support insights are decision-support tools. They do not replace lecturer judgement, moderation, approval, release, or formal institutional decision-making.",
      ),
    ).toBeInTheDocument();
  });

  it("redirects direct student access from /dashboard/improvements to the released grades page", async () => {
    routerState.initialEntries = ["/dashboard/improvements"];
    authState.user = { id: "student-1" };
    authState.role = "student";

    render(<App />);

    expect(await screen.findByText("Student grades page")).toBeInTheDocument();
    expect(screen.queryByText("Explain grade page")).not.toBeInTheDocument();
  });

  it("keeps Explain My Grade directly accessible for students", async () => {
    routerState.initialEntries = ["/dashboard/explain-grade"];
    authState.user = { id: "student-1" };
    authState.role = "student";

    render(<App />);

    expect(await screen.findByText("Student grades page")).toBeInTheDocument();
  });
});
