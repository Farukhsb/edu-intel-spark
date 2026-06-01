import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DemoStudentProfile from "@/pages/dashboard/DemoStudentProfile";
import StudentProfile from "@/pages/dashboard/StudentProfile";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: false,
    user: { id: "lecturer-1" },
  },
  navigate: vi.fn(),
  params: {
    studentId: "sam-student",
  },
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  supabase: {
    from: vi.fn(),
  },
  computeRisk: vi.fn(),
  fetchStudentInterventions: vi.fn(),
  getInterventionErrorText: vi.fn(),
  dispatchCommunicationMessage: vi.fn(),
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

vi.mock("@/lib/communications", () => ({
  dispatchCommunicationMessage: mocks.dispatchCommunicationMessage,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ "data-testid": testId }: { "data-testid"?: string }) => (
    <svg data-testid={testId ?? "icon"} />
  );

  return {
    AlertTriangle: Icon,
    ArrowLeft: Icon,
    BookOpen: Icon,
    Check: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Clock: () => <svg data-testid="loading-spinner" />,
    Loader2: () => <svg data-testid="loading-spinner" />,
    Lightbulb: Icon,
    Mail: Icon,
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

type AssignmentRow = {
  id: string;
  title: string;
  module_code: string | null;
  due_date: string | null;
  max_score: number;
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  status: string;
  submitted_at: string;
};

type GradeRow = {
  submission_id: string;
  ai_score: number | null;
  final_score: number | null;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error?: unknown) => void;
};

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject } satisfies Deferred<T>;
};

const studentRecordId = "11111111-1111-4111-8111-111111111111";

const defaultAssignments: AssignmentRow[] = [
  {
    id: "assignment-1",
    title: "Essay 1",
    module_code: "CS301",
    due_date: "2026-04-15T00:00:00.000Z",
    max_score: 100,
  },
  {
    id: "assignment-2",
    title: "Lab Reflection",
    module_code: "CS205",
    due_date: "2026-04-22T00:00:00.000Z",
    max_score: 100,
  },
];

const defaultSubmissions: SubmissionRow[] = [
  {
    id: "submission-1",
    assignment_id: "assignment-1",
    student_id: studentRecordId,
    student_name: "Sam Student",
    student_email: "sam@example.edu",
    status: "released",
    submitted_at: "2026-04-10T10:00:00.000Z",
  },
];

const defaultGrades: GradeRow[] = [
  {
    submission_id: "submission-1",
    ai_score: 48,
    final_score: 42,
  },
];

const defaultRisk = {
  name: "Sam Student",
  email: "sam@example.edu",
  studentId: studentRecordId,
  riskScore: 76,
  riskLevel: "critical" as const,
  avgGrade: 42,
  lastGrade: 42,
  trend: "declining" as const,
  flags: ["Average below 50%", "Expected next outcome: 38%"],
  sparkline: [58, 42],
  recommendation: "Schedule a support meeting and agree a short-term intervention plan.",
  predictedNext: 38,
};

const defaultInterventions = [
  {
    id: "intervention-1",
    createdAt: "2026-04-20T09:00:00.000Z",
    type: "email",
    note: "Sent a check-in email with revision priorities.",
    followUpDate: "2026-04-27T00:00:00.000Z",
    status: "in_progress",
  },
  {
    id: "intervention-2",
    createdAt: "2026-04-12T09:00:00.000Z",
    type: "meeting",
    note: "Reviewed missed coursework and agreed next steps.",
    followUpDate: null,
    status: "resolved",
  },
];

const setupSupabase = ({
  assignments = defaultAssignments,
  submissions = defaultSubmissions,
  grades = defaultGrades,
  assignmentsPromise,
  assignmentsError,
}: {
  assignments?: AssignmentRow[];
  submissions?: SubmissionRow[];
  grades?: GradeRow[];
  assignmentsPromise?: Promise<{ data: AssignmentRow[]; error?: null }>;
  assignmentsError?: Error;
} = {}) => {
  mocks.supabase.from.mockImplementation((table: string) => ({
    select: vi.fn(() => {
      if (table === "assignments") {
        return {
          eq: vi.fn(() => {
            if (assignmentsError) {
              return Promise.reject(assignmentsError);
            }

            if (assignmentsPromise) {
              return assignmentsPromise;
            }

            return Promise.resolve({ data: assignments, error: null });
          }),
        };
      }

      if (table === "submissions") {
        return {
          in: vi.fn((column: string, values: string[]) =>
            Promise.resolve({
              data: submissions.filter((submission) =>
                column === "assignment_id" ? values.includes(submission.assignment_id) : true
              ),
              error: null,
            })
          ),
        };
      }

      if (table === "grades") {
        return {
          in: vi.fn((column: string, values: string[]) =>
            Promise.resolve({
              data: grades.filter((grade) =>
                column === "submission_id" ? values.includes(grade.submission_id) : true
              ),
              error: null,
            })
          ),
        };
      }

      if (table === "profiles") {
        return {
          eq: vi.fn((column: string, value: string) => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({
                data:
                  column === "id"
                    ? value === studentRecordId
                      ? { id: studentRecordId, email: "sam@example.edu" }
                      : null
                    : value === "sam@example.edu"
                      ? { id: studentRecordId }
                      : null,
                error: null,
              }),
            ),
          })),
        };
      }

      return Promise.resolve({ data: [], error: null });
    }),
  }));
};

const renderStudentProfile = () => render(<StudentProfile />);

describe("StudentProfile", () => {
  beforeEach(() => {
    mocks.authState.isDemo = false;
    mocks.authState.user = { id: "lecturer-1" };
    mocks.params.studentId = "sam-student";
    mocks.computeRisk.mockReturnValue(defaultRisk);
    mocks.fetchStudentInterventions.mockResolvedValue({ data: [], error: null });
    mocks.getInterventionErrorText.mockReturnValue("Could not load intervention history");
    mocks.dispatchCommunicationMessage.mockResolvedValue({
      ok: true,
      status: "created",
      message: { id: "message-1" },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders without crashing", async () => {
    setupSupabase();

    renderStudentProfile();

    expect(await screen.findByText("Sam Student")).toBeInTheDocument();
    expect(screen.getByText("Intervention History")).toBeInTheDocument();
  });

  it("uses synthetic demo data and does not queue live notifications in demo mode", async () => {
    mocks.params.studentId = "demo-student";

    render(
      <DemoStudentProfile />
    );

    expect(await screen.findByText("David Lee")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Send at-risk alert/i }));
    fireEvent.click(screen.getByRole("button", { name: /Send follow-up reminder/i }));

    expect(mocks.dispatchCommunicationMessage).not.toHaveBeenCalled();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("warns instead of duplicating an at-risk support notice", async () => {
    setupSupabase();
    mocks.dispatchCommunicationMessage.mockResolvedValueOnce({
      ok: true,
      status: "duplicate",
      message: { id: "message-existing" },
    });

    renderStudentProfile();

    fireEvent.click(await screen.findByRole("button", { name: /Send at-risk alert/i }));

    await waitFor(() => {
      expect(mocks.toast.warning).toHaveBeenCalledWith(
        "At-risk alert was already queued for this student. No duplicate notice was created.",
      );
    });
  });

  it("shows a partial-failure warning when intervention save succeeds but notification dispatch fails", async () => {
    setupSupabase();
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "assignments") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: defaultAssignments, error: null })),
          })),
        };
      }

      if (table === "submissions") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: defaultSubmissions, error: null })),
          })),
        };
      }

      if (table === "grades") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: defaultGrades, error: null })),
          })),
        };
      }

      if (table === "student_interventions") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: "intervention-new",
                    created_at: "2026-05-03T10:00:00.000Z",
                    intervention_type: "email",
                    note: "Immediate outreach required.",
                    follow_up_date: null,
                    status: "in_progress",
                  },
                  error: null,
                }),
              ),
            })),
          })),
        };
      }

      if (table === "profiles") {
        return {
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: { id: studentRecordId }, error: null })),
          })),
        };
      }

      return {
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      };
    });
    mocks.dispatchCommunicationMessage.mockResolvedValueOnce({
      ok: false,
      status: "failed",
      message: null,
    });

    renderStudentProfile();

    fireEvent.change(
      await screen.findByPlaceholderText(
        /Record what happened, what support was offered, and what to review next\./i,
      ),
      {
      target: { value: "Immediate outreach required." },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /Log intervention/i }));

    await waitFor(() => {
      expect(mocks.toast.success).toHaveBeenCalledWith("Intervention logged");
      expect(mocks.toast.warning).toHaveBeenCalledWith(
        "Intervention saved, but the student notification could not be created",
      );
    });
  });

  it("shows a loading state while student data is pending", () => {
    const deferred = createDeferred<{ data: AssignmentRow[]; error?: null }>();
    setupSupabase({ assignmentsPromise: deferred.promise });

    renderStudentProfile();

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("shows a safe not-found state when the profile cannot be found", async () => {
    setupSupabase({ submissions: [] });

    renderStudentProfile();

    expect(await screen.findByText("Student not found for this lecturer view.")).toBeInTheDocument();
    expect(screen.queryByText("Sam Student")).not.toBeInTheDocument();
  });

  it("resolves a student profile route by profile id when submissions are linked by email", async () => {
    mocks.params.studentId = studentRecordId;
    setupSupabase({
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          student_id: null,
          student_name: "Sam Student",
          student_email: "sam@example.edu",
          status: "released",
          submitted_at: "2026-04-10T10:00:00.000Z",
        },
      ],
    });

    renderStudentProfile();

    expect(await screen.findByText("Sam Student")).toBeInTheDocument();
    expect(screen.getByText("Support Priorities")).toBeInTheDocument();
  });

  it("renders main student details when mocked profile data is available", async () => {
    setupSupabase();

    renderStudentProfile();

    expect(await screen.findByText("Sam Student")).toBeInTheDocument();
    expect(screen.getByText("Support Priorities")).toBeInTheDocument();
    expect(screen.getByText("Immediate intervention position")).toBeInTheDocument();
    expect(screen.getByText("1 missed assignment still unresolved")).toBeInTheDocument();
    expect(screen.getByText("Log the first intervention and send a student support alert")).toBeInTheDocument();
    expect(screen.getByText("critical risk")).toBeInTheDocument();
    expect(screen.getByText("CS301")).toBeInTheDocument();
    expect(screen.getByText("Lab Reflection")).toBeInTheDocument();
    expect(screen.getByText("Risk score")).toBeInTheDocument();
    expect(screen.getByText("Average")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("renders the risk and support summary from mocked support signals", async () => {
    setupSupabase();
    mocks.fetchStudentInterventions.mockResolvedValue({ data: defaultInterventions, error: null });

    renderStudentProfile();

    expect(await screen.findByText("Why This Student Is At Risk")).toBeInTheDocument();
    expect(screen.getByText("Average below 50%")).toBeInTheDocument();
    expect(screen.getByText("Expected next outcome: 38%")).toBeInTheDocument();
    expect(screen.getByText("Intervention suggestion")).toBeInTheDocument();
    expect(screen.getAllByText("Schedule a support meeting and agree a short-term intervention plan.")).toHaveLength(2);
    expect(screen.getAllByText("Open interventions").length).toBeGreaterThan(0);
  });

  it("renders intervention history when mocked records are available", async () => {
    setupSupabase();
    mocks.fetchStudentInterventions.mockResolvedValue({ data: defaultInterventions, error: null });

    renderStudentProfile();

    expect(await screen.findByText("Sent a check-in email with revision priorities.")).toBeInTheDocument();
    expect(screen.getByText("Reviewed missed coursework and agreed next steps.")).toBeInTheDocument();
    expect(screen.getAllByText("Ongoing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Resolved").length).toBeGreaterThan(0);
    expect(screen.getByText("Follow-up overdue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark resolved/i })).toBeInTheDocument();
  });

  it("lets the lecturer resolve an open intervention from history", async () => {
    setupSupabase();
    mocks.fetchStudentInterventions.mockResolvedValue({ data: defaultInterventions, error: null });
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "assignments") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: defaultAssignments, error: null })),
          })),
        };
      }

      if (table === "submissions") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: defaultSubmissions, error: null })),
          })),
        };
      }

      if (table === "grades") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: defaultGrades, error: null })),
          })),
        };
      }

      if (table === "profiles") {
        return {
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: { id: studentRecordId }, error: null })),
          })),
        };
      }

      if (table === "student_interventions") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: {
                      id: "intervention-1",
                      lecturer_id: "lecturer-1",
                      student_id: studentRecordId,
                      student_name: "Sam Student",
                      student_email: "sam@example.edu",
                      intervention_type: "email",
                      status: "resolved",
                      priority: "high",
                      title: "Email intervention",
                      notes: "Sent a check-in email with revision priorities.",
                      follow_up_date: "2026-04-27T00:00:00.000Z",
                      assignment_id: null,
                      created_at: "2026-04-20T09:00:00.000Z",
                      updated_at: "2026-05-10T10:00:00.000Z",
                    },
                    error: null,
                  }),
                ),
              })),
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      };
    });

    renderStudentProfile();

    fireEvent.click(await screen.findByRole("button", { name: /Mark resolved/i }));

    await waitFor(() => {
      expect(mocks.toast.success).toHaveBeenCalledWith("Intervention resolved");
    });

    expect(screen.getAllByText("Resolved").length).toBeGreaterThan(0);
  });

  it("renders a safe empty intervention state when no records exist", async () => {
    setupSupabase();
    mocks.fetchStudentInterventions.mockResolvedValue({ data: [], error: null });

    renderStudentProfile();

    expect(await screen.findByText("No interventions logged yet.")).toBeInTheDocument();
  });

  it("renders a safe fallback state if the student profile request fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setupSupabase({ assignmentsError: new Error("supabase unavailable") });

    renderStudentProfile();

    await waitFor(() => {
      expect(screen.getByText("Student support profile unavailable")).toBeInTheDocument();
    });
    expect(screen.getByText("Student support profile could not be loaded right now.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Intervention History")).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("does not expose another student's data when the route does not match the mocked profile", async () => {
    mocks.params.studentId = "alex-other";
    setupSupabase({
      submissions: [
        {
          id: "submission-2",
          assignment_id: "assignment-1",
          student_id: "22222222-2222-4222-8222-222222222222",
          student_name: "Jamie Different",
          student_email: "jamie@example.edu",
          status: "released",
          submitted_at: "2026-04-10T10:00:00.000Z",
        },
      ],
      grades: [
        {
          submission_id: "submission-2",
          ai_score: 88,
          final_score: 91,
        },
      ],
    });

    renderStudentProfile();

    expect(await screen.findByText("Student not found for this lecturer view.")).toBeInTheDocument();
    expect(screen.queryByText("Jamie Different")).not.toBeInTheDocument();
    expect(screen.queryByText("91%")).not.toBeInTheDocument();
  });
});
