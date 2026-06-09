import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DemoImprovementPlan from "@/pages/dashboard/DemoImprovementPlan";

const renderWithRouter = (
  ui: React.ReactNode,
  initialEntries:
    | string[]
    | Array<
        | string
        | {
            pathname: string;
            search?: string;
            hash?: string;
            state?: unknown;
          }
      > = ["/demo/dashboard/improvements"],
) =>
  render(
    <MemoryRouter initialEntries={initialEntries} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {ui}
    </MemoryRouter>,
  );

describe("ImprovementPlan demo validation", () => {
  beforeEach(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("renders the demo focus cards without a refresh action", () => {
    renderWithRouter(<DemoImprovementPlan />);

    expect(screen.getByText("Current focus")).toBeInTheDocument();
    expect(screen.getByText("You have active improvement work")).toBeInTheDocument();
    expect(
      screen.getByText("CS205: Dynamic Programming Structure is still the highest-priority improvement area"),
    ).toBeInTheDocument();
    expect(screen.getByText("Progress you have already made")).toBeInTheDocument();
    expect(screen.getAllByText("2 of 5 steps complete").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Support plan" })).toBeInTheDocument();
    expect(
      screen.getByText(/Focused on the weakest repeated criteria so you know which skills to strengthen for future assignments/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /refresh/i })).not.toBeInTheDocument();
  });

  it("keeps the demo focus section visible", () => {
    renderWithRouter(<DemoImprovementPlan />);

    expect(screen.getByText("Priority 1 - CS205: Dynamic Programming Structure")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-progress-indicator")).toBeInTheDocument();
    expect(screen.getAllByText("Needs attention").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/(Good|Strong|High) recovery opportunity \| (short|12 min|15 min|20 min) review/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "Support plan" }).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /Based on (direct criterion feedback from graded work|repeated low criterion scores with some supporting feedback|limited evidence from current graded work, so this guidance is intentionally broad)\./,
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/For future assignments, the solution structure is not visible enough/i)).toBeInTheDocument();
    expect(screen.getAllByText(/For future assignments, state the recurrence relation for dynamic programming structure before coding/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Marker can follow the recurrence/i)).toBeInTheDocument();
    expect(screen.getAllByText("CS301 - Data Structures").length).toBeGreaterThan(0);
    expect(screen.queryByText("Review lecturer feedback before next lab")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /show completed steps \(1\)/i }).length).toBeGreaterThan(0);
  });

  it("reveals completed steps only when the completed section is expanded", () => {
    renderWithRouter(<DemoImprovementPlan />);

    expect(screen.queryByText("Review lecturer feedback before next lab")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /show completed steps \(1\)/i })[0]);

    expect(screen.getByText("Review lecturer feedback before next lab")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hide completed steps/i })).toBeInTheDocument();
  });

  it("uses the hero action buttons to jump to module sections and reveal completed steps", () => {
    renderWithRouter(<DemoImprovementPlan />);

    fireEvent.click(screen.getByRole("button", { name: /view completed steps/i }));

    expect(screen.getByText("Review lecturer feedback before next lab")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /hide completed steps/i }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /view modules/i }));
    expect(screen.getByText("Complete Big-O analysis worksheet")).toBeInTheDocument();
  });

  it("shows a focused support handoff when opened from an intervention notification", () => {
    renderWithRouter(
      <DemoImprovementPlan />,
      [
        {
          pathname: "/demo/dashboard/improvements",
          state: {
            notification: {
              id: "notice-1",
              createdAt: "2026-05-03T09:00:00.000Z",
              cleared: false,
              read: false,
              category: "intervention-follow-up",
              recipientName: "Student",
              recipientEmail: "student@example.com",
              recipientId: "student-1",
              subject: "Study plan reminder",
              body: "Review the complexity-analysis steps in your support plan before the next submission window.",
            },
          },
        },
      ],
    );

    expect(screen.getByTestId("improvement-plan-notice-focus")).toBeInTheDocument();
    expect(screen.getByText("Opened from support notice")).toBeInTheDocument();
    expect(screen.getByText("Start Here")).toBeInTheDocument();
    expect(screen.getByText("First Open Step")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review support plan" })).toBeInTheDocument();
  });
});
