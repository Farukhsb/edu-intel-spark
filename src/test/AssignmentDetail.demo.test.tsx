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
    expect(screen.getByText("AI in Higher Education Essay Workflow")).toBeInTheDocument();
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
    expect(screen.getByText("An excellent critical analysis of AI in higher education. The essay is clear, balanced, and well-argued, and it makes a persuasive case that AI should be used to support academic judgement rather than replace it. To improve further, add one slightly more developed institutional governance example.")).toBeInTheDocument();
    expect(screen.queryByText("Daniel Okafor")).not.toBeInTheDocument();
    expect(screen.queryByText("Integrity Flags")).not.toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });
});
