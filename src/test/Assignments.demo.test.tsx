import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STARTER_ASSIGNMENT_TEMPLATES } from "@/data/assignmentSets";
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
    expect(screen.getByText("Demo Mode — synthetic sample data")).toBeInTheDocument();
    expect(screen.getByText("Create assignment")).toBeInTheDocument();
    expect(screen.getByText("Review marking and integrity")).toBeInTheDocument();
    expect(screen.getByText("Reusable assignment sets")).toBeInTheDocument();
    expect(screen.getAllByText("Assignment set").length).toBeGreaterThan(0);
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("normalizes missing demo arrays before rendering assignment cards", async () => {
    const originalAssignment = DEMO_ASSIGNMENTS[0];
    DEMO_ASSIGNMENTS[0] = {
      ...originalAssignment,
      rubric: undefined as never,
      target_cohorts: undefined as never,
      target_departments: undefined as never,
    };

    try {
      render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Assignments />
        </MemoryRouter>,
      );

      expect(await screen.findByText(originalAssignment.title)).toBeInTheDocument();
      expect(mocks.supabase.from).not.toHaveBeenCalled();
    } finally {
      DEMO_ASSIGNMENTS[0] = originalAssignment;
    }
  });

  it("exposes reusable starter templates in code for later lecturer prefills", () => {
    expect(STARTER_ASSIGNMENT_TEMPLATES.length).toBeGreaterThan(0);
    expect(STARTER_ASSIGNMENT_TEMPLATES[0].template.rubric.length).toBeGreaterThan(0);
  });
});
