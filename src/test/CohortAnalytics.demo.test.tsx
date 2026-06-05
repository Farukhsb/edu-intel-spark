import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DemoCohortAnalytics from "@/pages/dashboard/DemoCohortAnalytics";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: true,
    user: null,
  },
  supabase: {
    from: vi.fn(),
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
    success: vi.fn(),
  },
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
}));

describe("DemoCohortAnalytics", () => {
  beforeEach(() => {
    mocks.authState.isDemo = true;
    mocks.authState.user = null;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders demo cohort insights with a reporting-readiness summary and skips Supabase reads", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DemoCohortAnalytics />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Cohort Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Immediate intervention position")).toBeInTheDocument();
    expect(screen.getAllByText("High-risk student cluster detected").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Open the risk workflow and prioritise the highest-risk students.")
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: /Personal tutor/i })).toBeInTheDocument();
    expect(screen.getAllByText("Grade Distribution").length).toBeGreaterThan(0);
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });
});
