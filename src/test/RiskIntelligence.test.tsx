import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-user" },
  }),
}));

vi.mock("@/lib/data/admin/riskIntelligence", () => ({
  fetchRiskIntelligenceDataset: async () => ({
    snapshots: [],
    predictions: [],
    feedback: [],
    profiles: [],
  }),
  submitRiskFeedback: vi.fn(),
}));

import RiskIntelligence from "@/pages/dashboard/RiskIntelligence";

describe("RiskIntelligence", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the demo risk overview on localhost", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RiskIntelligence />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Risk overview")).toBeInTheDocument();
    expect(screen.getByText("Demo data is loaded for local testing.")).toBeInTheDocument();
    expect(screen.getAllByText("Musa Ali").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hauwa Bello").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Show live data").length).toBeGreaterThan(0);
    expect(screen.getByText("Risk summary")).toBeInTheDocument();
  });
});
