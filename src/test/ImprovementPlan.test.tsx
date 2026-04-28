import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  supabase: {
    from: vi.fn(),
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

  it("accepts a valid explanation payload and keeps the refresh action safe", async () => {
    mocks.supabase.functions.invoke.mockResolvedValue({
      data: {
        explanation: "Focus on complexity analysis and testing.",
        next_steps: ["Review Big-O notes", "Add edge-case tests"],
        confidence: 0.79,
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <ImprovementPlan />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(mocks.toast.success).toHaveBeenCalledWith("Recommendations refreshed");
    });
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("shows a safe fallback when the explanation payload is invalid", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.supabase.functions.invoke.mockResolvedValue({
      data: {
        explanation: 123,
        next_steps: "Rewrite paragraph one",
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <ImprovementPlan />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(mocks.toast.error).toHaveBeenCalledWith("Failed to refresh recommendations. Existing plan kept.");
    });
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(screen.getByText("CS301 - Data Structures")).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
