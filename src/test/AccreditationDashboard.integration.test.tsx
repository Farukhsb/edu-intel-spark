import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/helpers/mockSupabaseClient";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

const renderAccreditationDashboard = async ({
  supabaseMock,
  programmes = [],
}: {
  supabaseMock: ReturnType<typeof createSupabaseMock>;
  programmes?: Array<Record<string, unknown>>;
}) => {
  vi.resetModules();

  vi.doMock("@/contexts/AuthContext", () => ({
    useAuth: () => ({
      isDemo: false,
    }),
  }));

  vi.doMock("@/integrations/supabase/client", () => ({
    supabase: supabaseMock,
  }));

  vi.doMock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return {
      ...actual,
      useNavigate: () => mocks.navigate,
    };
  });

  const { default: AccreditationDashboard } = await import("@/pages/dashboard/AccreditationDashboard");

  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AccreditationDashboard />
    </MemoryRouter>
  );
};

describe("AccreditationDashboard integration", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.clearAllMocks();
    vi.unmock("@/contexts/AuthContext");
    vi.unmock("@/integrations/supabase/client");
    vi.unmock("react-router-dom");
  });

  it("renders a zeroed accreditation view when no live data exists", async () => {
    const supabaseMock = createSupabaseMock({
      grades: { selectResult: { data: [], error: null } },
      submissions: { selectResult: { data: [], error: null } },
      assignments: { selectResult: { data: [], error: null } },
      profiles: { selectResult: { data: [], error: null } },
    });

    await renderAccreditationDashboard({
      supabaseMock,
    });

    expect(await screen.findByText("Overall Compliance", {}, { timeout: 15000 })).toBeInTheDocument();
    expect(screen.getByText("Recommended Actions")).toBeInTheDocument();
    expect(screen.getByText("Open pending submissions")).toBeInTheDocument();
  }, 20000);

  it("shows an explicit load error state when accreditation queries fail", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabaseMock = createSupabaseMock({
      grades: { selectResult: { data: null, error: { message: "boom" } } },
      submissions: { selectResult: { data: [], error: null } },
      assignments: { selectResult: { data: [], error: null } },
      profiles: { selectResult: { data: [], error: null } },
    });

    await renderAccreditationDashboard({
      supabaseMock,
    });

    await screen.findByText(
      "Accreditation metrics could not be loaded right now. Try again later.",
      {},
      { timeout: 20000 },
    );
    expect(errorSpy).toHaveBeenCalled();
  }, 25000);

  it("renders live derived metrics when accreditation data exists", async () => {
    const supabaseMock = createSupabaseMock({
      grades: {
        selectResult: {
          data: [
            {
              submission_id: "s1",
              ai_score: 65,
              final_score: 68,
              ai_feedback:
                "Detailed and actionable feedback that is definitely longer than one hundred characters so the helpfulness signal is triggered in the derived metric set.",
              lecturer_score: 68,
              reviewed_by: "lecturer-1",
              created_at: "2026-04-10T00:00:00.000Z",
            },
            {
              submission_id: "s2",
              ai_score: 38,
              final_score: 42,
              ai_feedback: "Short feedback",
              lecturer_score: null,
              reviewed_by: null,
              created_at: "2026-04-20T00:00:00.000Z",
            },
          ],
          error: null,
        },
      },
      submissions: {
        selectResult: {
          data: [
            { id: "s1", assignment_id: "a1", submitted_at: "2026-04-01T00:00:00.000Z", status: "released" },
            { id: "s2", assignment_id: "a2", submitted_at: "2026-04-02T00:00:00.000Z", status: "approved" },
          ],
          error: null,
        },
      },
      assignments: {
        selectResult: {
          data: [
            {
              id: "a1",
              title: "Algorithms",
              module_code: "CS401",
              due_date: "2026-04-01",
              description: "Essay",
              rubric: [{ criterion: "Analysis", weight: 100 }],
            },
            {
              id: "a2",
              title: "Databases",
              module_code: "CS402",
              due_date: null,
              description: null,
              rubric: [],
            },
          ],
          error: null,
        },
      },
      profiles: {
        selectResult: {
          data: [
            { id: "lecturer-1", role: "lecturer" },
            { id: "student-1", role: "student" },
            { id: "student-2", role: "student" },
          ],
          error: null,
        },
      },
    });

    await renderAccreditationDashboard({
      supabaseMock,
      programmes: [
        {
          code: "CS401",
          submissions: 1,
          graded: 1,
          avg: 68,
          passRate: 100,
          firstClass: 0,
          twoOne: 100,
          twoTwo: 0,
          third: 0,
          fail: 0,
        },
      ],
    });

    expect(await screen.findByText("Overall Compliance", {}, { timeout: 10000 })).toBeInTheDocument();

    expect(screen.getAllByText("Top Findings").length).toBeGreaterThan(0);
    expect(screen.getByText("Reporting Readiness")).toBeInTheDocument();
    expect(screen.getByText("First challenge likely")).toBeInTheDocument();
    expect(screen.getByText("QAA Quality Standards")).toBeInTheDocument();
    expect(screen.getByText("Feedback Turnaround Analysis")).toBeInTheDocument();
    expect(screen.getByText("Recommended Actions")).toBeInTheDocument();
    expect(screen.getByText("Open release queue")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reduce feedback backlog/i }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/dashboard/assignments/a2?source=queue&focus=release-ready",
    );
  });
});
