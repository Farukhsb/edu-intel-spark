import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isDemo: true,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

describe("AccreditationDashboard demo mode", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses synthetic accreditation data and skips Supabase queries on the programme tab", async () => {
    const { default: AccreditationDashboard } = await import("@/pages/dashboard/DemoAccreditationDashboard");

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AccreditationDashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText("Viewing demo accreditation data")).toBeInTheDocument();
    expect(screen.getByText("Overall Compliance")).toBeInTheDocument();
    expect(screen.getByText("Reporting Readiness")).toBeInTheDocument();
    expect(screen.getByText("Current posture")).toBeInTheDocument();
    expect(screen.getByText("Assessment Criteria Transparency")).toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();

    const programmeTab = screen.getByRole("tab", { name: /Programme Reports/i });
    fireEvent.mouseDown(programmeTab);
    fireEvent.click(programmeTab);

    expect(await screen.findByText("PPL502")).toBeInTheDocument();
    expect(screen.getByText("SOC411")).toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });
});
