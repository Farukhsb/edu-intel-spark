import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ImprovementPlan from "@/pages/dashboard/ImprovementPlan";

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
    render(
      <MemoryRouter>
        <ImprovementPlan />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Best Next Moves" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /refresh/i })).not.toBeInTheDocument();
    expect(mocks.supabase.functions.invoke).not.toHaveBeenCalled();
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("keeps the demo focus section visible without invoking AI refresh", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <MemoryRouter>
        <ImprovementPlan />
      </MemoryRouter>,
    );

    expect(screen.getByText("Priority 1 - CS205: Dynamic Programming Structure")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getAllByText("+5 to +8 marks | ~15 min").length).toBeGreaterThan(0);
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
    render(
      <MemoryRouter>
        <ImprovementPlan />
      </MemoryRouter>,
    );

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
          title: "Algorithms Coursework",
          module_code: "CS101",
          max_score: 100,
        },
      ],
      error: null,
    });

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "submissions") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "submission-1",
                      assignment_id: "assignment-1",
                      student_id: "student-1",
                      submitted_at: "2026-04-20T10:00:00.000Z",
                    },
                  ],
                }),
            }),
          }),
        };
      }

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
              }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    render(
      <MemoryRouter>
        <ImprovementPlan />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "CS101 - Algorithms Coursework" })).toBeInTheDocument();
    expect(screen.queryByText("No improvement plan yet")).not.toBeInTheDocument();
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("get_student_grade_assignment_metadata");
    expect(screen.getByText("Priority 1 - CS101: Testing")).toBeInTheDocument();
    expect(screen.getByText("+5 to +8 marks | ~15 min")).toBeInTheDocument();
    expect(screen.getByText("No visible test evidence.")).toBeInTheDocument();
    expect(screen.getByText(/add operation outputs or screenshots that show the program working/i)).toBeInTheDocument();
    expect(screen.getByText(/The marker can verify correctness directly from visible outputs/i)).toBeInTheDocument();
    expect(screen.getAllByText("CS101 - Algorithms Coursework").length).toBeGreaterThan(0);
  });

  it("collapses a fully completed real module plan by default", async () => {
    mocks.authState.isDemo = false;
    mocks.supabase.rpc.mockResolvedValue({
      data: [
        {
          submission_id: "submission-1",
          assignment_id: "assignment-1",
          title: "Testing",
          module_code: null,
          max_score: 100,
        },
      ],
      error: null,
    });

    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "submissions") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "submission-1",
                      assignment_id: "assignment-1",
                      student_id: "student-1",
                      submitted_at: "2026-04-20T10:00:00.000Z",
                    },
                  ],
                }),
            }),
          }),
        };
      }

      if (table === "improvement_plan_progress") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ task_key: "testing-overall-quality-0", completed: true }],
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
                    final_score: 1,
                    ai_score: 1,
                    ai_breakdown: [
                      { criterion: "Overall quality", score: 0.1, max_score: 10 },
                    ],
                  },
                ],
              }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    render(
      <MemoryRouter>
        <ImprovementPlan />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Completed module plan")).toBeInTheDocument();
    expect(screen.getAllByText("Testing").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /show completed plan/i })).toBeInTheDocument();
    expect(screen.queryByText("What to improve before your next submission")).not.toBeInTheDocument();
    expect(screen.queryByText("All current tasks are completed for this module.")).not.toBeInTheDocument();
  });
});
