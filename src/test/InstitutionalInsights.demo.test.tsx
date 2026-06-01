import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import DemoInstitutionalInsights from "@/pages/dashboard/DemoInstitutionalInsights";

describe("InstitutionalInsights demo mode", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders demo institutional insights content without live data dependencies", async () => {
    render(
      <MemoryRouter
        initialEntries={["/demo/dashboard/institutional"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <DemoInstitutionalInsights />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Viewing demo institutional data")).toBeInTheDocument();
    expect(screen.getByText("Reporting Readiness")).toBeInTheDocument();
    expect(screen.getByText("Top Findings")).toBeInTheDocument();
    expect(screen.getByText("Recommended Actions")).toBeInTheDocument();
    expect(screen.getByText("Evidence risk position")).toBeInTheDocument();
    expect(screen.getAllByText("Evidence completeness").length).toBeGreaterThan(0);
    expect(screen.getByText("Accreditation compliance review")).toBeInTheDocument();
  });
});
