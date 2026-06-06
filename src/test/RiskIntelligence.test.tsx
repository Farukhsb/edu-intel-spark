import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auditMocks = vi.hoisted(() => ({
  logReportExportEvent: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-user" },
    profile: { id: "admin-user", role: "admin", institution_id: "institution-1" },
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

vi.mock("@/lib/audit/exportAuditEvents", () => ({
  logReportExportEvent: auditMocks.logReportExportEvent,
}));

import RiskIntelligence from "@/pages/dashboard/RiskIntelligence";

describe("RiskIntelligence", () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let anchorClick: ReturnType<typeof vi.fn>;
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: URL.createObjectURL ?? vi.fn(),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: URL.revokeObjectURL ?? vi.fn(),
    });
    createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:risk-export");
    revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    anchorClick = vi.fn();
    createElementSpy = vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "a") {
        return {
          click: anchorClick,
          href: "",
          download: "",
        } as unknown as HTMLAnchorElement;
      }

      return originalCreateElement(tagName);
    }) as typeof document.createElement);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    createObjectURLSpy?.mockRestore();
    revokeObjectURLSpy?.mockRestore();
    createElementSpy?.mockRestore();
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

  it("logs risk exports and keeps the export redacted by default", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RiskIntelligence />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Risk overview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/i }));

    expect(auditMocks.logReportExportEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-user",
        actorRole: "admin",
        institutionId: "institution-1",
        reportName: "risk_intelligence",
        format: "csv",
        redactedStudentIdentity: true,
      }),
    );
  });
});
