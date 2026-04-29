import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: true,
    user: { id: "demo-lecturer" },
    profile: { role: "lecturer" },
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

describe("ModerationDashboard demo mode", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders synthetic moderation cases and skips Supabase reads in demo mode", async () => {
    const { default: ModerationDashboard } = await import("@/pages/dashboard/ModerationDashboard");

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ModerationDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Moderation Queue")).toBeInTheDocument();
    expect(screen.getByText("Amina Hassan")).toBeInTheDocument();
    expect(screen.getByText("Daniel Reed")).toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: /Review case/i })[0]);
    expect(await screen.findByText("Moderation Review")).toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });
});
