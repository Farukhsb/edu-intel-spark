import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StudentProfile from "@/pages/dashboard/StudentProfile";
import StudentGrades from "@/pages/dashboard/StudentGrades";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: false,
    user: { id: "lecturer-1" },
  },
  params: {
    studentId: "sam-student",
  },
  navigate: vi.fn(),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  },
  computeRisk: vi.fn(),
  fetchStudentInterventions: vi.fn(),
  getInterventionErrorText: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: () => mocks.params,
  };
});

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("@/lib/studentRisk", () => ({
  computeRisk: mocks.computeRisk,
}));

vi.mock("@/lib/interventions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/interventions")>("@/lib/interventions");
  return {
    ...actual,
    fetchStudentInterventions: mocks.fetchStudentInterventions,
    getInterventionErrorText: mocks.getInterventionErrorText,
  };
});

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  const Icon = ({ "data-testid": testId }: { "data-testid"?: string }) => (
    <svg data-testid={testId ?? "icon"} />
  );

  return {
    ...actual,
    AlertTriangle: Icon,
    ArrowLeft: Icon,
    BookOpen: Icon,
    Brain: Icon,
    Check: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Clock: () => <svg data-testid="loading-spinner" />,
    Clock3: Icon,
    Lightbulb: Icon,
    Loader2: () => <svg data-testid="loading-spinner" />,
    Mail: Icon,
    Send: Icon,
    Sparkles: Icon,
    Target: Icon,
    TrendingDown: Icon,
    TrendingUp: Icon,
    User: Icon,
  };
});

vi.mock("recharts", () => ({
  CartesianGrid: () => <div />,
  Line: () => <div />,
  LineChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

const studentRecordId = "11111111-1111-4111-8111-111111111111";

const risk = {
  name: "Sam Student",
  email: "sam@example.edu",
  studentId: studentRecordId,
  riskScore: 76,
  riskLevel: "critical" as const,
  avgGrade: 42,
  lastGrade: 42,
  trend: "declining" as const,
  flags: ["Average below 50%"],
  sparkline: [58, 42],
  recommendation: "Schedule a support meeting and agree a short-term intervention plan.",
  predictedNext: 38,
};

const setupStudentProfileSupabase = () => {
  mocks.supabase.from.mockImplementation((table: string) => ({
    select: vi.fn(() => {
      if (table === "assignments") {
        return {
          eq: vi.fn(() =>
            Promise.resolve({
              data: [
                {
                  id: "assignment-1",
                  title: "Essay 1",
                  module_code: "CS301",
                  due_date: "2026-04-15T00:00:00.000Z",
                  max_score: 100,
                },
              ],
              error: null,
            })
          ),
        };
      }

      if (table === "submissions") {
        return {
          in: vi.fn(() =>
            Promise.resolve({
              data: [
                {
                  id: "submission-1",
                  assignment_id: "assignment-1",
                  student_id: studentRecordId,
                  student_name: "Sam Student",
                  student_email: "sam@example.edu",
                  status: "released",
                  submitted_at: "2026-04-10T10:00:00.000Z",
                },
              ],
              error: null,
            })
          ),
        };
      }

      if (table === "grades") {
        return {
          in: vi.fn(() =>
            Promise.resolve({
              data: [
                {
                  submission_id: "submission-1",
                  ai_score: 48,
                  final_score: 42,
                },
              ],
              error: null,
            })
          ),
        };
      }

      if (table === "profiles") {
        return {
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: { id: studentRecordId }, error: null })),
          })),
        };
      }

      return Promise.resolve({ data: [], error: null });
    }),
  }));
};

const setupExplainGradeSupabase = () => {
  mocks.supabase.auth.getSession.mockResolvedValue({
    data: { session: { access_token: "test-token" } },
  });
  mocks.supabase.rpc.mockResolvedValue({
    data: [
      {
        submission_id: "submission-1",
        assignment_id: "assignment-1",
        assignment_title: "Critical Essay",
        module_code: "ENG101",
        max_score: 100,
        file_name: "essay.pdf",
        file_url: "",
        submission_status: "released",
        submitted_at: "2026-04-20T10:00:00.000Z",
        final_score: 74,
        ai_score: null,
        final_feedback: null,
        ai_feedback: null,
        ai_breakdown: [
          { criterion: "Argument", score: 18, max_score: 25 },
          { criterion: "Evidence", score: 19, max_score: 25 },
        ],
      },
    ],
    error: null,
  });

  mocks.supabase.from.mockReset();
};

describe("Network/API failure handling", () => {
  beforeEach(() => {
    mocks.authState.isDemo = false;
    mocks.authState.user = { id: "lecturer-1" };
    mocks.params.studentId = "sam-student";
    mocks.computeRisk.mockReturnValue(risk);
    mocks.fetchStudentInterventions.mockResolvedValue({ data: [], error: null });
    mocks.getInterventionErrorText.mockReturnValue("Intervention API unavailable");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps StudentProfile visible but shows a safe toast when interventions return { data: null, error }", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setupStudentProfileSupabase();
    mocks.fetchStudentInterventions.mockResolvedValue({
      data: null,
      error: { message: "Intervention API unavailable" },
    });

    render(<StudentProfile />);

    expect(await screen.findByText("Sam Student")).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.toast.error).toHaveBeenCalledWith("Intervention API unavailable");
    });
    expect(screen.getByText("No interventions logged yet.")).toBeInTheDocument();
    expect(screen.queryByText("Resolved after support session.")).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("shows a safe toast and no partial assistant reply when the StudentGrades AI request fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setupExplainGradeSupabase();
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudentGrades />
      </MemoryRouter>
    );

    expect(await screen.findByText("Grade Breakdown")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Ask about your grade..."), {
      target: { value: "How can I improve?" },
    });
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mocks.toast.error).toHaveBeenCalledWith("Failed to get AI response");
    });
    expect(screen.queryByText("network down")).not.toBeInTheDocument();
    expect(screen.queryByText("How can I improve?")).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
