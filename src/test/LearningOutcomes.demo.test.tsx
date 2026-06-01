import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import DemoLearningOutcomes from "@/pages/dashboard/DemoLearningOutcomes";

describe("LearningOutcomes demo mode", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders demo learning outcomes content without live data dependencies", async () => {
    render(
      <MemoryRouter
        initialEntries={["/demo/dashboard/learning-outcomes"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <DemoLearningOutcomes />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Teaching Focus")).toBeInTheDocument();
    expect(screen.getByText("Top Findings")).toBeInTheDocument();
    expect(screen.getByText("Recommended Actions")).toBeInTheDocument();
    expect(screen.getByText("Rubric Criterion Achievement")).toBeInTheDocument();
    expect(screen.getByText("Student Achievement Trajectories")).toBeInTheDocument();
    expect(screen.getByText("Export snapshot")).toBeInTheDocument();
    expect(screen.getByText("Viewing demo learning outcomes")).toBeInTheDocument();
    expect(screen.getByText("Argument Structure")).toBeInTheDocument();
  });
});
