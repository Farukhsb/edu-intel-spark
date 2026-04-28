import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/helpers/mockSupabaseClient";

const renderAccreditationDashboard = async ({
  supabaseMock,
  derived,
  programmes = [],
}: {
  supabaseMock: ReturnType<typeof createSupabaseMock>;
  derived: {
    qaaMetrics: Array<Record<string, unknown>>;
    nssMetrics: Array<Record<string, unknown>>;
    tefIndicators: Array<Record<string, unknown>>;
    feedbackTurnaround: { avg: number; target: number; compliant: number; total: number };
  };
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

  vi.doMock("@/lib/accreditationMetrics", () => ({
    deriveAccreditationMetrics: () => derived,
    deriveProgrammeReports: () => programmes,
  }));

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
    vi.unmock("@/contexts/AuthContext");
    vi.unmock("@/integrations/supabase/client");
    vi.unmock("@/lib/accreditationMetrics");
  });

  it("shows the empty state when no accreditation data exists", async () => {
    const supabaseMock = createSupabaseMock({
      grades: { selectResult: { data: [], error: null } },
      submissions: { selectResult: { data: [], error: null } },
      assignments: { selectResult: { data: [], error: null } },
      profiles: { selectResult: { data: [], error: null } },
    });

    await renderAccreditationDashboard({
      supabaseMock,
      derived: {
        qaaMetrics: [],
        nssMetrics: [],
        tefIndicators: [],
        feedbackTurnaround: { avg: 0, target: 15, compliant: 0, total: 0 },
      },
    });

    expect(
      await screen.findByText(
        "Accreditation metrics will auto-populate once you create assignments, upload submissions, and complete grading.",
        {},
        { timeout: 10000 },
      )
    ).toBeInTheDocument();
  });

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
      derived: {
        qaaMetrics: [],
        nssMetrics: [],
        tefIndicators: [],
        feedbackTurnaround: { avg: 0, target: 15, compliant: 0, total: 0 },
      },
    });

    await screen.findByText("Accreditation metrics could not be loaded right now. Try again later.");
    expect(errorSpy).toHaveBeenCalled();
  });

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
      derived: {
        qaaMetrics: [
          {
            id: "feedback-turnaround",
            metric: "Feedback Turnaround",
            value: 50,
            target: 90,
            status: "below",
            detail: "1 of 2 graded submissions met the 15-day target.",
            category: "assessment",
          },
        ],
        nssMetrics: [
          {
            question: "Assessment and feedback",
            score: 71,
            benchmark: 78,
            trend: "-3",
          },
        ],
        tefIndicators: [
          {
            name: "Student experience",
            score: 68,
            rating: "bronze",
            detail: "Feedback timeliness is lagging behind benchmark.",
          },
        ],
        feedbackTurnaround: { avg: 14, target: 15, compliant: 1, total: 2 },
      },
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

    expect(screen.getByText("Top Findings")).toBeInTheDocument();
    expect(screen.getByText("QAA Quality Standards")).toBeInTheDocument();
    expect(screen.getAllByText("Feedback Turnaround").length).toBeGreaterThan(0);
    expect(screen.getByText("Recommended Actions")).toBeInTheDocument();
  });
});
