import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CriterionBars } from "@/components/dashboard/CriterionBars";

describe("CriterionBars", () => {
  it("renders weighted criteria with score and achieved percentage", () => {
    render(
      <CriterionBars
        items={[
          {
            criterion: "Argument",
            score: 18,
            maxScore: 24,
            weightPercent: 40,
            detail: "Strong position, but the line of reasoning needs more depth.",
          },
        ]}
      />,
    );

    expect(screen.getByText("Argument")).toBeInTheDocument();
    expect(screen.getByText("40% of total mark")).toBeInTheDocument();
    expect(screen.getByText("18/24")).toBeInTheDocument();
    expect(screen.getByText("75% achieved")).toBeInTheDocument();
    expect(screen.getByText("Strong position, but the line of reasoning needs more depth.")).toBeInTheDocument();
  });
});
