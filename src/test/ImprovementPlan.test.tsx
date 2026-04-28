import { cleanup, render, screen } from "@testing-library/react";
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

    expect(screen.getByRole("heading", { name: "Suggested Focus Areas" })).toBeInTheDocument();
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

    expect(screen.getByText("Big-O Reasoning Worksheet")).toBeInTheDocument();
    expect(screen.getByText("Derived from repeated weakness in complexity analysis.")).toBeInTheDocument();
    expect(mocks.supabase.functions.invoke).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(screen.getByText("CS301 - Data Structures")).toBeInTheDocument();

    consoleError.mockRestore();
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
                      { criterion: "Analysis", score: 6, max_score: 10 },
                      { criterion: "Testing", score: 5, max_score: 10 },
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

    expect(await screen.findByText("CS101 - Algorithms Coursework")).toBeInTheDocument();
    expect(screen.queryByText("No improvement plan yet")).not.toBeInTheDocument();
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("get_student_grade_assignment_metadata");
  });
});
