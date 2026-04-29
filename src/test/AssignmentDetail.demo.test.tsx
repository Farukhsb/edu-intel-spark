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
    expect(screen.getByText("Demo Mode — synthetic sample data")).toBeInTheDocument();
    expect(screen.getByText("Algorithms Report Workflow")).toBeInTheDocument();
    expect(screen.getByText("Workflow Actions")).toBeInTheDocument();
    expect(screen.getByText("Rubric")).toBeInTheDocument();
    expect(screen.getByText("Integrity Flags")).toBeInTheDocument();
    expect(screen.getByText(/Review what AI receives/)).toBeInTheDocument();
    expect(screen.getByText("Daniel Okafor")).toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
    expect(mocks.supabase.storage.from).not.toHaveBeenCalled();
  });

  it("shows only the synthetic student view in demo student mode", async () => {
    mocks.authState.role = "student";
    mocks.authState.user = { id: "demo-student", email: "student@gradeai.com" };
    mocks.authState.profile = {
      id: "demo-student",
      email: "student@gradeai.com",
      role: "student",
    };

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
    expect(screen.getByText("Open file")).toBeInTheDocument();
    expect(screen.getByText("Very strong work with clear methodology, accurate analysis, and well-supported conclusions. To push further, narrow the recommendation to a more concrete deployment scenario.")).toBeInTheDocument();
    expect(screen.queryByText("Daniel Okafor")).not.toBeInTheDocument();
    expect(screen.queryByText("Integrity Flags")).not.toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });
});
