import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PerformanceTrends from "@/pages/dashboard/PerformanceTrends";

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
        initialEntries={["/dashboard/performance?risk=high-plus&scoreBand=lt40"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <PerformanceTrends />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Average Grades Over Time")).toBeInTheDocument();
    expect(screen.getByText("Filtered intervention view")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 student matching the current risk and score criteria\./)).toBeInTheDocument();
    expect(screen.getAllByText("Mariam Okeke").length).toBeGreaterThan(0);
    expect(screen.queryByText("No graded submissions yet. Performance trends will appear once assignments are graded.")).not.toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });
});
