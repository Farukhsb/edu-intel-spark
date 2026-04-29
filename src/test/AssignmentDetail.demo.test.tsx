import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AssignmentDetail from "@/pages/dashboard/AssignmentDetail";
import { DEMO_ASSIGNMENTS } from "@/pages/dashboard/demoAssignments";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: true,
    role: "lecturer",
    user: null,
    profile: null,
  },
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
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
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("AssignmentDetail demo data isolation", () => {
  beforeEach(() => {
    mocks.authState.isDemo = true;
    mocks.authState.role = "lecturer";
    mocks.authState.user = null;
    mocks.authState.profile = null;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders shared demo assignment workflow data without querying Supabase", async () => {
    render(
      <MemoryRouter
        initialEntries={[`/dashboard/assignments/${DEMO_ASSIGNMENTS[0].id}`]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/dashboard/assignments/:id" element={<AssignmentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(DEMO_ASSIGNMENTS[0].title)).toBeInTheDocument();
    expect(screen.getByText("Viewing demo assignment workflow data")).toBeInTheDocument();
    expect(screen.getByText("Workflow Actions")).toBeInTheDocument();
    expect(screen.getByText("Rubric")).toBeInTheDocument();
    expect(screen.getByText("Integrity Flags")).toBeInTheDocument();
    expect(screen.getByText(/Review what AI receives/)).toBeInTheDocument();
    expect(screen.getByText("Daniel Okafor")).toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
    expect(mocks.supabase.storage.from).not.toHaveBeenCalled();
  });
});
