import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: true,
    user: { id: "demo-lecturer" },
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

describe("AcademicIntegrity demo mode", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders synthetic integrity cases and skips Supabase reads in demo mode", async () => {
    const { default: AcademicIntegrity } = await import("@/pages/dashboard/AcademicIntegrity");

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AcademicIntegrity />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Academic Integrity Review Queue")).toBeInTheDocument();
    expect(screen.getByText("Reporting Readiness")).toBeInTheDocument();
    expect(screen.getByText("Escalated review position")).toBeInTheDocument();
    expect(screen.getByText("Research Ethics Review Memo")).toBeInTheDocument();
    expect(
      screen.getByText("Complete active investigations and record lecturer decisions"),
    ).toBeInTheDocument();
    expect(screen.getByText("Amina Hassan")).toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: /Review evidence/i })[0]);
    expect(await screen.findByText("AI-writing suspicion evidence")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Active Investigations/i }));
    expect(await screen.findByText("Daniel Reed")).toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });
});
