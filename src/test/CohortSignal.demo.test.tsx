import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CohortSignalDemo from "@/pages/CohortSignalDemo";

const mocks = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

const renderDemo = () =>
  render(
    <MemoryRouter initialEntries={["/cohortsignal-demo"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/cohortsignal-demo" element={<CohortSignalDemo />} />
      </Routes>
    </MemoryRouter>,
  );

describe("CohortSignalDemo", () => {
  beforeEach(() => {
    mocks.supabase.from.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders summary cards", async () => {
    renderDemo();

    expect(await screen.findByText("CohortSignal cohort heatmap")).toBeInTheDocument();
    expect(screen.getByTestId("summary-total-students")).toHaveTextContent("13");
    expect(screen.getByTestId("summary-high-risk")).toHaveTextContent("4");
    expect(screen.getAllByText("High risk").length).toBeGreaterThan(0);
    expect(screen.getByTestId("summary-medium-risk")).toHaveTextContent("4");
    expect(screen.getByTestId("summary-low-risk")).toHaveTextContent("4");
    expect(screen.getByTestId("summary-interventions")).toHaveTextContent("0");
    expect(screen.getByText("Model quality")).toBeInTheDocument();
    expect(screen.getByText("Fail precision")).toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("renders the correct number of risk tiles", async () => {
    renderDemo();

    await screen.findByText("CohortSignal cohort heatmap");
    expect(screen.getAllByTestId("student-tile")).toHaveLength(13);
  });

  it("filters high-risk students", async () => {
    renderDemo();

    await screen.findByText("CohortSignal cohort heatmap");
    fireEvent.click(screen.getByRole("combobox", { name: /risk band/i }));
    fireEvent.click(screen.getByRole("option", { name: "High risk" }));

    await waitFor(() => {
      expect(screen.getAllByTestId("student-tile")).toHaveLength(4);
    });
    expect(screen.getByText("Ada Ibrahim")).toBeInTheDocument();
    expect(screen.getByText("Hugo Martin")).toBeInTheDocument();
  });

  it("opens the student detail panel", async () => {
    renderDemo();

    await screen.findByText("CohortSignal cohort heatmap");
    fireEvent.click(screen.getByRole("button", { name: /Ada Ibrahim/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Ada Ibrahim")).toBeInTheDocument();
    expect(within(dialog).getByText(/Mathematics/)).toBeInTheDocument();
    expect(within(dialog).getByText("Latest mark")).toBeInTheDocument();
    expect(within(dialog).getByText("Failure prediction")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", {
        name: /(?:Log Intervention|Intervention already logged)/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows the intervention marker", async () => {
    renderDemo();

    await screen.findByText("CohortSignal cohort heatmap");
    const tile = screen.getByRole("button", { name: /Ben Carter/i });
    expect(within(tile).getByText("Intervention logged")).toBeInTheDocument();
  });

  it("confirms no Supabase calls are used", async () => {
    renderDemo();

    await screen.findByText("CohortSignal cohort heatmap");
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });
});
