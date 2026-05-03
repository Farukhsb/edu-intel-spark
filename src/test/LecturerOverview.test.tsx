import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import LecturerOverview from "@/pages/dashboard/LecturerOverview";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: false,
    user: { id: "lecturer-1" },
    profile: { full_name: "Dr Ada Lovelace" },
  },
  navigate: vi.fn(),
  supabase: { from: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("lucide-react", () => {
  const Icon = ({ "data-testid": testId }: { "data-testid"?: string }) => (
    <svg data-testid={testId ?? "icon"} />
  );

  return {
    AlertTriangle: Icon,
    ArrowRight: Icon,
    BarChart3: Icon,
    CheckCircle: Icon,
    Clock: Icon,
    Download: Icon,
    FileText: Icon,
    Loader2: () => <svg data-testid="loading-spinner" />,
    Sparkles: Icon,
    Target: Icon,
    Users: Icon,
  };
});

vi.mock("recharts", () => ({
  Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => <div />,
  Cell: () => <div />,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
}));

type DashboardData = {
  assignments?: Array<Record<string, unknown>>;
  submissions?: Array<Record<string, unknown>>;
  grades?: Array<Record<string, unknown>>;
  keepAssignmentsPending?: boolean;
};

const setupSupabase = ({
  assignments = [],
  submissions = [],
  grades = [],
  keepAssignmentsPending = false,
}: DashboardData) => {
  mocks.supabase.from.mockImplementation((table: string) => ({
    select: vi.fn(() => {
      if (table === "assignments") {
        return {
          eq: vi.fn(() =>
            keepAssignmentsPending
              ? new Promise(() => {})
              : Promise.resolve({ data: assignments, error: null })
          ),
        };
      }

      if (table === "submissions") {
        return {
          in: vi.fn(() => Promise.resolve({ data: submissions, error: null })),
        };
      }

      if (table === "grades") {
        return {
          in: vi.fn(() => Promise.resolve({ data: grades, error: null })),
        };
      }

      return Promise.resolve({ data: [], error: null });
    }),
  }));
};

const renderLecturerOverview = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LecturerOverview />
    </MemoryRouter>
  );

describe("LecturerOverview", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.authState.isDemo = false;
    mocks.authState.user = { id: "lecturer-1" };
    mocks.authState.profile = { full_name: "Dr Ada Lovelace" };
  });

  it("renders without crashing with dashboard data", async () => {
    setupSupabase({
      assignments: [{ id: "assignment-1", title: "Algorithms", max_score: 100 }],
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          student_id: "student-1",
          student_name: "Sam Student",
          student_email: "sam@example.com",
          file_name: "essay.pdf",
          status: "released",
          submitted_at: "2026-04-01T00:00:00.000Z",
        },
      ],
      grades: [{ submission_id: "submission-1", ai_score: 72, final_score: 74 }],
    });

    renderLecturerOverview();

    expect(await screen.findByText("Welcome back, Dr")).toBeInTheDocument();
    expect(screen.getByText("Sam Student")).toBeInTheDocument();
    expect(screen.getByText("Algorithms")).toBeInTheDocument();
  });

  it("shows a loading state while dashboard data is loading", () => {
    setupSupabase({ keepAssignmentsPending: true });

    renderLecturerOverview();

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("shows empty states when no dashboard data is returned", async () => {
    setupSupabase({ assignments: [] });

    renderLecturerOverview();

    expect(await screen.findByText("No submissions yet")).toBeInTheDocument();
    expect(screen.getByText("No grades yet")).toBeInTheDocument();
    expect(screen.getByText("0 active assignments")).toBeInTheDocument();
    expect(screen.getByText("0 active students")).toBeInTheDocument();
  });

  it("renders basic overview UI elements", async () => {
    setupSupabase({
      assignments: [{ id: "assignment-1", title: "Algorithms", max_score: 100 }],
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          student_id: "student-1",
          student_name: "Sam Student",
          student_email: "sam@example.com",
          file_name: "essay.pdf",
          status: "released",
          submitted_at: "2026-04-01T00:00:00.000Z",
        },
      ],
      grades: [{ submission_id: "submission-1", ai_score: 72, final_score: 74 }],
    });

    renderLecturerOverview();

    await waitFor(() => {
      expect(screen.getByText("Active Students")).toBeInTheDocument();
    });
    expect(screen.getByText("Reporting Readiness")).toBeInTheDocument();
    expect(screen.getByText("Live delivery position")).toBeInTheDocument();
    expect(screen.getByText("1 active assignment still need routine monitoring")).toBeInTheDocument();
    expect(
      screen.getByText("Track live submissions and keep release-ready work moving through the workflow"),
    ).toBeInTheDocument();
    expect(screen.getByText("Awaiting Review")).toBeInTheDocument();
    expect(screen.getByText("Average Grade")).toBeInTheDocument();
    expect(screen.getByText("At-Risk Students")).toBeInTheDocument();
    expect(screen.getByText("Recent Submissions")).toBeInTheDocument();
    expect(screen.getByText("Grade Distribution")).toBeInTheDocument();
    expect(screen.getByText("Attention Needed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review submissions/i })).toBeInTheDocument();
  });
});
