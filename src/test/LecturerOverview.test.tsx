import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    CheckCircle2: Icon,
    Clock: Icon,
    Clock3: Icon,
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
  assignmentsError?: Error | null;
};

const setupSupabase = ({
  assignments = [],
  submissions = [],
  grades = [],
  keepAssignmentsPending = false,
  assignmentsError = null,
}: DashboardData) => {
  mocks.supabase.from.mockImplementation((table: string) => ({
    select: vi.fn(() => {
      if (table === "assignments") {
        return {
          eq: vi.fn(() =>
            assignmentsError
              ? Promise.reject(assignmentsError)
              :
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
    expect(screen.getByRole("button", { name: "Continue workflow" })).toBeInTheDocument();
  });

  it("shows a loading state while dashboard data is loading", () => {
    setupSupabase({ keepAssignmentsPending: true });

    renderLecturerOverview();

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("shows a page-level error state when the overview cannot be loaded", async () => {
    setupSupabase({ assignmentsError: new Error("overview unavailable") });

    renderLecturerOverview();

    expect(await screen.findByText("Lecturer overview unavailable")).toBeInTheDocument();
    expect(screen.getByText("The lecturer overview could not be loaded right now.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows empty states when no dashboard data is returned", async () => {
    setupSupabase({ assignments: [] });

    renderLecturerOverview();

    expect(await screen.findByText("No submissions yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Publish an assignment or check its due date. Student work will appear here once it is submitted.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Priority today")).toBeInTheDocument();
    expect(screen.getByText("Live teaching scope")).toBeInTheDocument();
    expect(screen.getByText("Create or publish the next assignment to start the teaching workflow")).toBeInTheDocument();
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
    expect(screen.getByText("Priority today")).toBeInTheDocument();
    expect(screen.getByText("Live teaching scope")).toBeInTheDocument();
    expect(screen.getByText("Next move")).toBeInTheDocument();
    expect(screen.getByText("No immediate blocker")).toBeInTheDocument();
    expect(screen.getByText("Live delivery position")).toBeInTheDocument();
    expect(screen.getByText("Track submissions from intake to release.")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Review")).toBeInTheDocument();
    expect(screen.getByText("Average Grade")).toBeInTheDocument();
    expect(screen.getByText("At-Risk Students")).toBeInTheDocument();
    expect(screen.getByText("Review next")).toBeInTheDocument();
    expect(screen.getByText("Workflow pipeline")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-stage-submitted")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-stage-ai-graded")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-stage-under-review")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-stage-released")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open assignments/i })).toBeInTheDocument();
  });

  it("opens a focused assignment workflow from recent submissions and the action card", async () => {
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
          status: "under_review",
          submitted_at: "2026-04-01T00:00:00.000Z",
        },
      ],
      grades: [{ submission_id: "submission-1", ai_score: 72, final_score: null }],
    });

    renderLecturerOverview();

    const queueButton = await screen.findByRole("button", { name: "Open review queue" });
    const submissionButton = screen.getByRole("button", { name: "Continue review" });

    fireEvent.click(submissionButton);
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/dashboard/assignments/assignment-1?source=queue&focus=manual-review&from=overview",
    );

    fireEvent.click(queueButton);
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/dashboard/assignments/assignment-1?source=queue&focus=manual-review&from=overview",
    );

    fireEvent.click(screen.getByText("Awaiting Review"));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/dashboard/assignments/assignment-1?source=queue&focus=manual-review&from=overview",
    );
  });

  it("shows pipeline counts using existing submission workflow states", async () => {
    setupSupabase({
      assignments: [
        { id: "assignment-1", title: "Algorithms", max_score: 100 },
        { id: "assignment-2", title: "Databases", max_score: 100 },
      ],
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          student_id: "student-1",
          student_name: "Sam Student",
          student_email: "sam@example.com",
          file_name: "essay.pdf",
          status: "submitted",
          submitted_at: "2026-04-04T00:00:00.000Z",
        },
        {
          id: "submission-2",
          assignment_id: "assignment-1",
          student_id: "student-2",
          student_name: "Riley Student",
          student_email: "riley@example.com",
          file_name: "draft.pdf",
          status: "ai_graded",
          submitted_at: "2026-04-03T00:00:00.000Z",
        },
        {
          id: "submission-3",
          assignment_id: "assignment-2",
          student_id: "student-3",
          student_name: "Ayo Student",
          student_email: "ayo@example.com",
          file_name: "analysis.pdf",
          status: "moderation_pending",
          submitted_at: "2026-04-02T00:00:00.000Z",
        },
        {
          id: "submission-4",
          assignment_id: "assignment-2",
          student_id: "student-4",
          student_name: "Chris Student",
          student_email: "chris@example.com",
          file_name: "final.pdf",
          status: "released",
          submitted_at: "2026-04-01T00:00:00.000Z",
        },
      ],
      grades: [
        { submission_id: "submission-2", ai_score: 67, final_score: null },
        { submission_id: "submission-3", ai_score: 54, final_score: 58 },
        { submission_id: "submission-4", ai_score: 74, final_score: 76 },
      ],
    });

    renderLecturerOverview();

    expect(await screen.findByText("Workflow pipeline")).toBeInTheDocument();

    expect(screen.getByTestId("pipeline-stage-submitted")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-count-submitted")).toHaveTextContent("1");
    expect(screen.getByTestId("pipeline-stage-ai-graded")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-count-ai-graded")).toHaveTextContent("1");
    expect(screen.getByTestId("pipeline-stage-under-review")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-count-under-review")).toHaveTextContent("1");
    expect(screen.getByTestId("pipeline-stage-released")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-count-released")).toHaveTextContent("1");
  });

  it("formats average grade using the grading scale instead of always showing a percentage", async () => {
    setupSupabase({
      assignments: [{ id: "assignment-1", title: "Algorithms", max_score: 10 }],
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
      grades: [{ submission_id: "submission-1", ai_score: 8.9, final_score: null }],
    });

    renderLecturerOverview();

    const averageGradeLabel = await screen.findByText("Average Grade");
    expect(averageGradeLabel).toBeInTheDocument();
    expect(averageGradeLabel.closest("div")).toHaveTextContent("8.9/10");
    expect(screen.queryByText("8.9%")).not.toBeInTheDocument();
  });

  it("keeps the priority queue action aligned with the highlighted backlog assignment", async () => {
    setupSupabase({
      assignments: [
        { id: "assignment-1", title: "Database Normalisation Case Study", max_score: 80 },
        { id: "assignment-2", title: "Network Security Incident Reflection", max_score: 100 },
      ],
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          student_id: "student-1",
          student_name: "Sam Student",
          student_email: "sam@example.com",
          file_name: "essay.pdf",
          status: "under_review",
          submitted_at: "2026-05-08T00:00:00.000Z",
        },
        {
          id: "submission-2",
          assignment_id: "assignment-2",
          student_id: "student-2",
          student_name: "Riley Student",
          student_email: "riley@example.com",
          file_name: "incident-1.pdf",
          status: "submitted",
          submitted_at: "2026-05-05T00:00:00.000Z",
        },
        {
          id: "submission-3",
          assignment_id: "assignment-2",
          student_id: "student-3",
          student_name: "Ayo Student",
          student_email: "ayo@example.com",
          file_name: "incident-2.pdf",
          status: "submitted",
          submitted_at: "2026-05-04T00:00:00.000Z",
        },
        {
          id: "submission-4",
          assignment_id: "assignment-2",
          student_id: "student-4",
          student_name: "Chris Student",
          student_email: "chris@example.com",
          file_name: "incident-3.pdf",
          status: "submitted",
          submitted_at: "2026-05-03T00:00:00.000Z",
        },
      ],
      grades: [],
    });

    renderLecturerOverview();

    expect(await screen.findByText("Current pressure point")).toBeInTheDocument();
    expect(screen.getAllByText("Network Security Incident Reflection").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Open review queue" }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/dashboard/assignments/assignment-2?source=notification&focus=submission-review&from=overview",
    );
  });
});
