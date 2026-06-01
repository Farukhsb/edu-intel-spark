import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STARTER_ASSIGNMENT_TEMPLATES, SYNTHETIC_ASSIGNMENT_SETS } from "@/data/assignmentSets";
import DemoAssignmentsPage from "@/pages/dashboard/DemoAssignmentsPage";
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
        <DemoAssignmentsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(DEMO_ASSIGNMENTS[0].title)).toBeInTheDocument();
    expect(screen.getByText("Demo Mode — synthetic sample data")).toBeInTheDocument();
    expect(screen.getByText("Active marking position")).toBeInTheDocument();
    expect(screen.getByText("Open the review queue and clear grading, approval, or release blockers")).toBeInTheDocument();
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
          <DemoAssignmentsPage />
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

  it("uses the AI in higher education essay as the first demo assignment set", () => {
    const firstSet = SYNTHETIC_ASSIGNMENT_SETS[0];
    const rubricTotal = firstSet.template.rubric.reduce((sum, criterion) => sum + criterion.weight, 0);

    expect(firstSet.template.title).toBe(
      "Evaluating the Role of Artificial Intelligence in University Assessment and Student Support",
    );
    expect(firstSet.label).toBe("Essay / Critical Analysis example");
    expect(firstSet.template.moduleCode).toBe("EDU401");
    expect(firstSet.template.rubric.map((criterion) => criterion.criterion)).toEqual([
      "Understanding of AI in Higher Education",
      "Critical Analysis and Evaluation",
      "Use of Evidence and Examples",
      "Structure, Clarity, and Academic Writing",
      "Conclusion and Judgement",
    ]);
    expect(rubricTotal).toBe(100);
  });

  it("shows a student-scoped synthetic assignment list in demo mode", async () => {
    mocks.authState.role = "student";
    mocks.authState.user = { id: "demo-student", email: "student@gradeai.com" };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DemoAssignmentsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("My Assignments")).toBeInTheDocument();
    expect(screen.getByText("Released result position")).toBeInTheDocument();
    expect(screen.getByText("Open the released result and review the feedback summary")).toBeInTheDocument();
    expect(screen.getByText("Released result available")).toBeInTheDocument();
    expect(screen.getByText("Submission received")).toBeInTheDocument();
    expect(screen.getAllByText("Open Released Result").length).toBeGreaterThan(0);
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.queryByText("Create assignment")).not.toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });
});
