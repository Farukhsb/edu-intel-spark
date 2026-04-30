import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ImprovementPlan from "@/pages/dashboard/ImprovementPlan";

const renderWithRouter = (ui: React.ReactNode) =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {ui}
    </MemoryRouter>,
  );

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: true,
    user: { id: "student-1" },
  },
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: {
      invoke: vi.fn(),
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
  toast: mocks.toast,
}));

vi.mock("@/lib/logger", () => ({
  log: mocks.logger,
}));

vi.mock("lucide-react", () => {
  const Icon = () => <svg data-testid="icon" />;

  return {
    Bell: Icon,
    BookOpen: Icon,
    Check: Icon,
    CheckCircle2: Icon,
    Circle: Icon,
    Loader2: Icon,
    RefreshCw: Icon,
    Target: Icon,
    TrendingDown: Icon,
    TrendingUp: Icon,
  };
});

vi.mock("recharts", () => ({
  CartesianGrid: () => <div />,
  Line: () => <div />,
  LineChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
}));

describe("ImprovementPlan explanation validation", () => {
  beforeEach(() => {
    mocks.authState.isDemo = true;
    mocks.authState.user = { id: "student-1" };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders suggested focus areas without a misleading refresh action", () => {
    renderWithRouter(<ImprovementPlan />);

    expect(screen.getByRole("heading", { name: "Best Next Moves" })).toBeInTheDocument();
    expect(
      screen.getByText(/Focused on the weakest repeated criteria so you know which skills to strengthen for future assignments/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /refresh/i })).not.toBeInTheDocument();
    expect(mocks.supabase.functions.invoke).not.toHaveBeenCalled();
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("keeps the demo focus section visible without invoking AI refresh", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderWithRouter(<ImprovementPlan />);

    expect(screen.getByText("Priority 1 - CS205: Dynamic Programming Structure")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getAllByText(/(Good|Strong|High) recovery opportunity \| (short|12 min|15 min|20 min) review/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /Based on (direct criterion feedback from graded work|repeated low criterion scores with some supporting feedback|limited evidence from current graded work, so this guidance is intentionally broad)\./,
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/The solution structure is not fully visible/i)).toBeInTheDocument();
    expect(screen.getAllByText(/state the recurrence relation before coding/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Marker can follow the recurrence/i)).toBeInTheDocument();
    expect(mocks.supabase.functions.invoke).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(screen.getAllByText("CS301 - Data Structures").length).toBeGreaterThan(0);
    expect(screen.queryByText("Review lecturer feedback before next lab")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /show completed tasks \(1\)/i }).length).toBeGreaterThan(0);

    consoleError.mockRestore();
  });

  it("reveals completed tasks only when the completed section is expanded", () => {
    renderWithRouter(<ImprovementPlan />);

    expect(screen.queryByText("Review lecturer feedback before next lab")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /show completed tasks \(1\)/i })[0]);

    expect(screen.getByText("Review lecturer feedback before next lab")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hide completed tasks/i })).toBeInTheDocument();
  });

  it("builds a plan for a real student using assignment metadata RPC", async () => {
    mocks.authState.isDemo = false;
    mocks.supabase.rpc.mockResolvedValue({
      data: [
        {
          submission_id: "submission-1",
          assignment_id: "assignment-1",
          assignment_title: "Algorithms Coursework",
          module_code: "CS101",
          max_score: 100,
          file_name: "algorithms.pdf",
          file_url: "",
          submission_status: "released",
          submitted_at: "2026-04-20T10:00:00.000Z",
          final_score: 68,
          ai_score: 68,
          final_feedback: null,
          ai_feedback: null,
          ai_breakdown: [
            {
              criterion: "Analysis",
              score: 6,
              max_score: 10,
              feedback: "Your discussion of AI in assessment describes concepts but does not clearly evaluate their impact.",
            },
            {
              criterion: "Testing",
              score: 5,
              max_score: 10,
              feedback: "No visible test evidence.",
            },
          ],
        },
      ],
      error: null,
    });

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "improvement_plan_progress") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [],
              }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    renderWithRouter(<ImprovementPlan />);

    expect(await screen.findByRole("heading", { name: "CS101 - Algorithms Coursework" })).toBeInTheDocument();
    expect(screen.queryByText("No improvement plan yet")).not.toBeInTheDocument();
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("get_student_submission_grade_projection");
    expect(screen.getByText("Priority 1 - CS101: Testing")).toBeInTheDocument();
    expect(screen.getByText("Strong recovery opportunity | 15 min review")).toBeInTheDocument();
    expect(screen.getByText("No visible test evidence.")).toBeInTheDocument();
    expect(screen.getAllByText("Based on direct criterion feedback from graded work.").length).toBeGreaterThan(0);
    expect(screen.getByText(/add operation outputs or screenshots that show the program working/i)).toBeInTheDocument();
    expect(screen.getByText(/The marker can verify correctness directly from visible outputs/i)).toBeInTheDocument();
    expect(screen.getAllByText("CS101 - Algorithms Coursework").length).toBeGreaterThan(0);
  });

  it("falls back to direct student grade queries when the projection RPC is unavailable", async () => {
    mocks.authState.isDemo = false;
    mocks.supabase.rpc.mockResolvedValue({
      data: [],
      error: { message: "function does not exist" },
    });

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "improvement_plan_progress") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [],
              }),
          }),
        };
      }

      if (table === "submissions") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  {
                    id: "submission-1",
                    assignment_id: "assignment-1",
                    file_name: "algorithms.pdf",
                    file_url: "",
                    status: "released",
                    submitted_at: "2026-04-20T10:00:00.000Z",
                    student_id: "student-1",
                  },
                ],
                error: null,
              }),
          }),
        };
      }

      if (table === "grades") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  {
                    submission_id: "submission-1",
                    final_score: 68,
                    ai_score: 68,
                    final_feedback: null,
                    ai_feedback: null,
                    ai_breakdown: [
                      {
                        criterion: "Testing",
                        score: 5,
                        max_score: 10,
                        feedback: "BST deletion and traversal logic are not demonstrated with test output.",
                      },
                    ],
                  },
                ],
                error: null,
              }),
          }),
        };
      }

      if (table === "assignments") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  {
                    id: "assignment-1",
                    title: "Algorithms Coursework",
                    module_code: "CS101",
                    max_score: 100,
                  },
                ],
                error: null,
              }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    renderWithRouter(<ImprovementPlan />);

    expect(await screen.findByRole("heading", { name: "CS101 - Algorithms Coursework" })).toBeInTheDocument();
    expect(screen.getByText("Priority 1 - CS101: Testing")).toBeInTheDocument();
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("shows recovery guidance language for failed work", async () => {
    mocks.authState.isDemo = false;
    mocks.supabase.rpc.mockResolvedValue({
      data: [
        {
          submission_id: "submission-1",
          assignment_id: "assignment-1",
          assignment_title: "Testing",
          module_code: null,
          max_score: 100,
          file_name: "testing.pdf",
          file_url: "",
          submission_status: "released",
          submitted_at: "2026-04-20T10:00:00.000Z",
          final_score: 1,
          ai_score: 1,
          final_feedback: null,
          ai_feedback: null,
          ai_breakdown: [
            { criterion: "Overall quality", score: 0.1, max_score: 10 },
          ],
        },
      ],
      error: null,
    });

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "improvement_plan_progress") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [],
              }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    renderWithRouter(<ImprovementPlan />);

    expect(await screen.findByText("Completed module plan")).toBeInTheDocument();
    expect(screen.getAllByText("Testing").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /show completed plan/i })).toBeInTheDocument();
    expect(screen.queryByText("What to improve before your next submission")).not.toBeInTheDocument();
    expect(screen.queryByText("All current tasks are completed for this module.")).not.toBeInTheDocument();
  });
});
