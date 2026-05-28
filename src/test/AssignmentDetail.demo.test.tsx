import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Workflow Focus")).toBeInTheDocument();
    expect(screen.getByText("Active review position")).toBeInTheDocument();
    expect(
      screen.getAllByText("Open moderation-linked submissions and clear blocked review cases").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Workflow Actions")).toBeInTheDocument();
    expect(screen.getByText("Rubric")).toBeInTheDocument();
    expect(screen.getByText("Integrity Check Results")).toBeInTheDocument();
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
    expect(screen.getAllByText("Current position").length).toBeGreaterThan(0);
    expect(screen.getByText("Released result position")).toBeInTheDocument();
    expect(screen.getByText("Open the released result and review the feedback summary")).toBeInTheDocument();
    expect(screen.getByText("Released result available")).toBeInTheDocument();
    expect(screen.getAllByText("Open Released Result").length).toBeGreaterThan(0);
    expect(screen.getByText("Open file")).toBeInTheDocument();
    expect(screen.getByText("An excellent critical analysis of AI in higher education. The essay is clear, balanced, and well-argued, and it makes a persuasive case that AI should be used to support academic judgement rather than replace it. To improve further, add one slightly more developed institutional governance example.")).toBeInTheDocument();
    expect(screen.queryByText("Daniel Okafor")).not.toBeInTheDocument();
    expect(screen.queryByText("Integrity Check Results")).not.toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("falls forward to released submissions when an older moderation handoff has already completed", async () => {
    render(
      <MemoryRouter
        initialEntries={[`/dashboard/assignments/${DEMO_ASSIGNMENTS[0].id}?source=moderation&focus=release-ready`]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/dashboard/assignments/:id" element={<AssignmentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("assignment-moderation-release-focus")).toBeInTheDocument();
    expect(screen.getByText("Opened from moderation handoff after release")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "The earlier moderation handoff has already completed, so the list is focused on submissions that were released to students.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("No submissions match this view")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Show all submissions"));
    expect(await screen.findByText("Daniel Okafor")).toBeInTheDocument();
  });

  it("shows a lecturer notification-focus banner when opened from a workflow notice", async () => {
    render(
      <MemoryRouter
        initialEntries={[`/dashboard/assignments/${DEMO_ASSIGNMENTS[0].id}?source=notification&focus=release-follow-up`]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/dashboard/assignments/:id" element={<AssignmentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("assignment-notification-focus")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all submissions" })).toBeInTheDocument();
    expect(screen.getByText("Opened from an earlier notice after moderation started")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The earlier workflow notice has been overtaken by moderation activity, so the list is focused on submissions currently blocked in moderation or escalation.",
      ),
    ).toBeInTheDocument();
  });

  it("falls forward from an older lecturer notice into the latest released workflow stage", async () => {
    render(
      <MemoryRouter
        initialEntries={[`/dashboard/assignments/${DEMO_ASSIGNMENTS[0].id}?source=notification&focus=submission-review`]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/dashboard/assignments/:id" element={<AssignmentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("assignment-notification-focus")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all submissions" })).toBeInTheDocument();
    expect(screen.getByText("Opened from an earlier notice after moderation started")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The earlier workflow notice has been overtaken by moderation activity, so the list is focused on submissions currently blocked in moderation or escalation.",
      ),
    ).toBeInTheDocument();
  });

  it("does not offer stale approval actions on AI-graded submissions before first review", async () => {
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

    expect(await screen.findByTestId("submission-card-demo-submission-1")).toBeInTheDocument();
    expect(screen.getByTestId("submission-review-demo-submission-1")).toBeInTheDocument();
    expect(screen.queryByTestId("submission-approve-demo-submission-1")).not.toBeInTheDocument();
  });

  it("returns to the dashboard overview when opened from lecturer overview", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          `/dashboard/assignments/${DEMO_ASSIGNMENTS[0].id}?source=notification&focus=submission-review&from=overview`,
        ]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard overview</div>} />
          <Route path="/dashboard/assignments/:id" element={<AssignmentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(DEMO_ASSIGNMENTS[0].title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText("Dashboard overview")).toBeInTheDocument();
  });
});
