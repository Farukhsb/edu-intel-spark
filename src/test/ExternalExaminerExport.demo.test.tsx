import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import DemoExternalExaminerExport from "@/pages/dashboard/DemoExternalExaminerExport";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("ExternalExaminerExport demo mode", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders demo export data without live data dependencies", async () => {
    render(
      <MemoryRouter
        initialEntries={["/demo/dashboard/external-examiner"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <DemoExternalExaminerExport />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Viewing demo export data")).toBeInTheDocument();
    expect(screen.getByText("Export Preview")).toBeInTheDocument();
    expect(screen.getByText("Amina Hassan")).toBeInTheDocument();
    expect(screen.getByText("Daniel Reed")).toBeInTheDocument();
    expect(screen.getByText("PPL502")).toBeInTheDocument();
    expect(screen.getByText("SOC411")).toBeInTheDocument();
  });
});
