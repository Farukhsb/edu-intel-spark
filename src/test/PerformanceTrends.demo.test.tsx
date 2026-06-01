import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DemoPerformanceTrends from "@/pages/dashboard/DemoPerformanceTrends";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: true,
    user: null,
  },
  supabase: {
    from: vi.fn(),
  },
  toast: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  Line: () => <div />,
  Bar: () => <div />,
  Cell: () => <div />,
}));

describe("PerformanceTrends demo mode", () => {
  beforeEach(() => {
    mocks.authState.isDemo = true;
    mocks.authState.user = null;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders synthetic performance data and skips Supabase reads in demo mode", async () => {
    render(
      <MemoryRouter
        initialEntries={["/demo/dashboard/performance?risk=high-plus&scoreBand=lt40"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <DemoPerformanceTrends />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Average Grades Over Time")).toBeInTheDocument();
    expect(screen.getByText("Teaching Focus")).toBeInTheDocument();
    expect(screen.getByText("Immediate intervention position")).toBeInTheDocument();
    expect(screen.getByText("Open early support signals and act on high-risk students")).toBeInTheDocument();
    expect(await screen.findByText("Filtered intervention view")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 student matching the current risk and score criteria\./)).toBeInTheDocument();
    expect(screen.getAllByText("Mariam Okeke").length).toBeGreaterThan(0);
    expect(screen.queryByText("No graded submissions yet. Performance trends will appear once assignments are graded.")).not.toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });
});
