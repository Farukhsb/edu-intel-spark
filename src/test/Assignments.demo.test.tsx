import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Assignments from "@/pages/dashboard/Assignments";
import { DEMO_ASSIGNMENTS } from "@/pages/dashboard/demoAssignments";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: true,
    role: "lecturer",
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
    info: vi.fn(),
    success: vi.fn(),
  },
}));

describe("Assignments demo data isolation", () => {
  beforeEach(() => {
    mocks.authState.isDemo = true;
    mocks.authState.role = "lecturer";
    mocks.authState.user = null;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders shared demo assignments without querying Supabase", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Assignments />
      </MemoryRouter>,
    );

    expect(await screen.findByText(DEMO_ASSIGNMENTS[0].title)).toBeInTheDocument();
    expect(screen.getByText("Viewing demo assignment data")).toBeInTheDocument();
    expect(screen.getByText("Create assignment")).toBeInTheDocument();
    expect(screen.getByText("Review marking and integrity")).toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });
});
