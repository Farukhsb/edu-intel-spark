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
}));

import RiskIntelligence from "@/pages/dashboard/RiskIntelligence";

describe("RiskIntelligence", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the dedicated empty-state workspace when no predictions exist", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RiskIntelligence />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Student risk predictions")).toBeInTheDocument();
    expect(screen.getByText("No risk predictions yet")).toBeInTheDocument();
  });
});
