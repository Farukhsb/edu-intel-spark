import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  fetchProgrammeReportDataset: vi.fn(),
}));

const renderInstitutionalInsights = async () => {
  vi.resetModules();

  vi.doMock("@/contexts/AuthContext", () => ({
    useAuth: () => ({
      isDemo: false,
      user: {
        id: "admin-1",
        email: "admin@example.com",
      },
      profile: {
        id: "admin-1",
        role: "admin",
      },
    }),
  }));

  vi.doMock("@/lib/data/academic", () => ({
    fetchProgrammeReportDataset: mocks.fetchProgrammeReportDataset,
  }));

  vi.doMock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return {
      ...actual,
      useNavigate: () => mocks.navigate,
    };
  });

  const { default: InstitutionalInsights } = await import("@/pages/dashboard/InstitutionalInsights");

  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <InstitutionalInsights />
    </MemoryRouter>,
  );
};

describe("InstitutionalInsights integration", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.clearAllMocks();
    vi.unmock("@/contexts/AuthContext");
    vi.unmock("@/lib/data/academic");
    vi.unmock("react-router-dom");
  });

  it("renders live institutional reporting data when records exist", async () => {
    mocks.fetchProgrammeReportDataset.mockResolvedValue({
      assignments: [
        { id: "a1", title: "Algorithms Coursework", module_code: "CS401" },
        { id: "a2", title: "Databases Project", module_code: "CS402" },
      ],
      submissions: [
        { id: "s1", assignment_id: "a1" },
        { id: "s2", assignment_id: "a2" },
        { id: "s3", assignment_id: "a2" },
      ],
      grades: [
        { submission_id: "s1", ai_score: 70, final_score: 72 },
        { submission_id: "s2", ai_score: 38, final_score: 42 },
        { submission_id: "s3", ai_score: 35, final_score: 36 },
      ],
    });

    await renderInstitutionalInsights();

    expect(await screen.findByText("Reporting Readiness")).toBeInTheDocument();
    expect(screen.queryByText("No institutional data yet")).not.toBeInTheDocument();
    expect(screen.getByText("Department Performance")).toBeInTheDocument();
    expect(screen.getByText("Low-Performing Assessments")).toBeInTheDocument();
    expect(screen.getByText("Accreditation Readiness")).toBeInTheDocument();
    expect(screen.getAllByText("CS402").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Databases Project").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Module Pass Rate (Avg)").length).toBeGreaterThan(0);
  });

  it("does not show the top-level empty state when assignments exist but grading data is still sparse", async () => {
    mocks.fetchProgrammeReportDataset.mockResolvedValue({
      assignments: [
        { id: "a1", title: "Research Methods", module_code: "SOC301" },
      ],
      submissions: [],
      grades: [],
    });

    await renderInstitutionalInsights();

    expect(await screen.findByText("Reporting Readiness")).toBeInTheDocument();
    expect(screen.queryByText("No institutional data yet")).not.toBeInTheDocument();
    expect(screen.getByText("No department performance data yet")).toBeInTheDocument();
    expect(screen.getByText("No low-performing assessments yet")).toBeInTheDocument();
    expect(screen.getAllByText("Module Pass Rate (Avg)").length).toBeGreaterThan(0);
  });

  it("shows the top-level empty state only when there is no relevant institutional data", async () => {
    mocks.fetchProgrammeReportDataset.mockResolvedValue({
      assignments: [],
      submissions: [],
      grades: [],
    });

    await renderInstitutionalInsights();

    expect(await screen.findByText("No institutional data yet")).toBeInTheDocument();
    expect(screen.queryByText("Reporting Readiness")).not.toBeInTheDocument();
  });
});
