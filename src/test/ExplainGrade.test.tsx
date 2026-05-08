import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ExplainGrade, { buildGradeSelectorLabels, getBreakdownMaxScore } from "@/pages/dashboard/ExplainGrade";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: false,
    user: { id: "student-1" },
  },
  toast: {
    error: vi.fn(),
  },
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ "data-testid": testId }: { "data-testid"?: string }) => (
    <svg data-testid={testId ?? "icon"} />
  );

  return {
    Brain: Icon,
    Check: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Send: Icon,
    Sparkles: Icon,
    Loader2: () => <svg data-testid="loading-spinner" />,
  };
});

vi.mock("react-markdown", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

type SubmissionRow = {
  id: string;
  assignment_id: string | null;
  student_name?: string | null;
  file_name?: string | null;
  status?: string | null;
  released_at?: string | null;
  updated_at?: string | null;
};

type GradeRow = {
  id: string;
  submission_id: string;
  ai_score?: number | null;
  final_score?: number | null;
  ai_breakdown?: Array<{
    criterion?: string;
    name?: string;
    score?: number;
    max_score?: number;
    maxScore?: number;
  }> | null;
};

type AssignmentRow = {
  id: string;
  module_code?: string | null;
  title: string;
};

type AssignmentMetadataRow = {
  assignment_id: string;
  max_score: number | null;
  module_code: string | null;
  submission_id: string;
  title: string | null;
};

type ProjectionRow = {
  submission_id: string;
  assignment_id: string;
  assignment_title: string | null;
  module_code: string | null;
  max_score: number | null;
  file_name: string | null;
  file_url: string;
  submission_status: string;
  submitted_at: string;
  final_score: number | null;
  ai_score: number | null;
  final_feedback: string | null;
  ai_feedback: string | null;
  ai_breakdown: GradeRow["ai_breakdown"];
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

const defaultSubmissions: SubmissionRow[] = [
  {
    id: "submission-1",
    assignment_id: "assignment-1",
    student_name: "Sam Student",
    file_name: "essay.pdf",
    status: "released",
  },
];

const defaultGrades: GradeRow[] = [
  {
    id: "grade-1",
    submission_id: "submission-1",
    final_score: 74,
    ai_breakdown: [
      { criterion: "Argument", score: 18, max_score: 25 },
      { criterion: "Evidence", score: 19, max_score: 25 },
      { criterion: "Structure", score: 17, max_score: 25 },
      { criterion: "Referencing", score: 20, max_score: 25 },
    ],
  },
];

const defaultAssignments: AssignmentRow[] = [
  {
    id: "assignment-1",
    module_code: "ENG101",
    title: "Critical Essay",
  },
];

const defaultAssignmentMetadata: AssignmentMetadataRow[] = [
  {
    assignment_id: "assignment-1",
    max_score: 100,
    module_code: "ENG101",
    submission_id: "submission-1",
    title: "Critical Essay",
  },
];

const setupSupabase = ({
  submissions = defaultSubmissions,
  grades = defaultGrades,
  assignments = defaultAssignments,
  assignmentMetadata = defaultAssignmentMetadata,
  assignmentMetadataError = null,
  projectionPromise,
  submissionsError,
}: {
  submissions?: SubmissionRow[];
  grades?: GradeRow[];
  assignments?: AssignmentRow[];
  assignmentMetadata?: AssignmentMetadataRow[];
  assignmentMetadataError?: { message: string } | null;
  projectionPromise?: Promise<{ data: ProjectionRow[]; error?: null }>;
  submissionsError?: Error;
} = {}) => {
  mocks.supabase.auth.getSession.mockResolvedValue({
    data: { session: { access_token: "test-token" } },
  });

  const projection: ProjectionRow[] = submissions.map((submission) => {
    const grade = grades.find((entry) => entry.submission_id === submission.id);
    const metadata = assignmentMetadata.find((entry) => entry.submission_id === submission.id);
    const assignment = assignments.find((entry) => entry.id === submission.assignment_id);

    return {
      submission_id: submission.id,
      assignment_id: submission.assignment_id ?? "missing-assignment",
      assignment_title: metadata?.title ?? assignment?.title ?? null,
      module_code: metadata?.module_code ?? assignment?.module_code ?? null,
      max_score: metadata?.max_score ?? 100,
      file_name: submission.file_name ?? null,
      file_url: "",
      submission_status: submission.status ?? "submitted",
      submitted_at: "2026-04-20T10:00:00.000Z",
      final_score: grade?.final_score ?? null,
      ai_score: grade?.ai_score ?? null,
      final_feedback: null,
      ai_feedback: null,
      ai_breakdown: grade?.ai_breakdown ?? null,
    };
  });

  mocks.supabase.rpc.mockImplementation((fn: string) => {
    if (fn !== "get_student_submission_grade_projection") {
      throw new Error(`Unexpected rpc: ${fn}`);
    }
    if (submissionsError) {
      return Promise.reject(submissionsError);
    }
    if (projectionPromise) {
      return projectionPromise;
    }
    return Promise.resolve({
      data: projection,
      error: assignmentMetadataError,
    });
  });

  mocks.supabase.from.mockReset();
};

const renderExplainGrade = (initialEntry = "/dashboard/explain-grade") =>
  render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ExplainGrade />
    </MemoryRouter>
  );

describe("ExplainGrade", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.authState.isDemo = false;
    mocks.authState.user = { id: "student-1" };
  });

  it("handles empty breakdown safely", () => {
    const breakdown: Array<{ max_score?: number; maxScore?: number }> = [];

    const totalMaxRaw = breakdown.reduce((sum, item) => sum + getBreakdownMaxScore(item), 0);
    const totalMax = totalMaxRaw > 0 ? totalMaxRaw : 1;

    expect(totalMax).toBe(1);
  });

  it("renders without crashing when released grade data is available", async () => {
    setupSupabase();

    renderExplainGrade();

    expect(await screen.findByText("Grade Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Reporting Readiness")).toBeInTheDocument();
    expect(screen.getByText("Released explanation position")).toBeInTheDocument();
    expect(screen.getByText("Released Result Summary")).toBeInTheDocument();
    expect(screen.getByText("Critical Essay")).toBeInTheDocument();
    expect(screen.getByText("74%")).toBeInTheDocument();
    expect(screen.getByText("Strongest Areas")).toBeInTheDocument();
    expect(screen.getByText("Best Improvement Route")).toBeInTheDocument();
    expect(screen.getByText("Critical Essay \u2014 74% is closest to improving through Structure")).toBeInTheDocument();
    expect(screen.getByText("Use the Structure guidance to work toward 1st")).toBeInTheDocument();
    expect(screen.getByText("Next Submission Action Plan")).toBeInTheDocument();
    expect(screen.getByText("Keep This Strength")).toBeInTheDocument();
  });

  it("uses synthetic demo data and answers without Supabase session access in demo mode", async () => {
    mocks.authState.isDemo = true;

    renderExplainGrade();

    expect(await screen.findByText("Grade Breakdown")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Evaluating the Role of Artificial Intelligence in University Assessment and Student Support",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Ask about your grade..."), {
      target: { value: "Why did I get this grade?" },
    });
    fireEvent.click(screen.getAllByRole("button").at(-1)!);

    expect(await screen.findByText(/You received \*\*84% \(1st\)\*\*/i)).toBeInTheDocument();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
    expect(mocks.supabase.auth.getSession).not.toHaveBeenCalled();
  });

  it("shows a loading state while explanation data is pending", () => {
    const deferred = createDeferred<{ data: ProjectionRow[]; error?: null }>();
    setupSupabase({ projectionPromise: deferred.promise });

    renderExplainGrade();

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("shows an empty safe state when no released feedback is available", async () => {
    setupSupabase({
      submissions: [
        {
          id: "submission-2",
          assignment_id: "assignment-2",
          student_name: "Sam Student",
          file_name: "draft.pdf",
          status: "approved",
        },
      ],
      grades: [
        {
          id: "grade-2",
          submission_id: "submission-2",
          final_score: 68,
          ai_breakdown: [{ criterion: "Analysis", score: 17, max_score: 25 }],
        },
      ],
      assignments: [{ id: "assignment-2", module_code: "ENG102", title: "Draft Essay" }],
    });

    renderExplainGrade();

    expect(await screen.findByText(/No graded submissions found/i)).toBeInTheDocument();
    expect(screen.queryByText("Draft Essay")).not.toBeInTheDocument();
  });

  it("renders main explanation content from released feedback only", async () => {
    setupSupabase({
      submissions: [
        ...defaultSubmissions,
        {
          id: "submission-2",
          assignment_id: "assignment-2",
          student_name: "Sam Student",
          file_name: "draft.pdf",
          status: "approved",
        },
      ],
      grades: [
        ...defaultGrades,
        {
          id: "grade-2",
          submission_id: "submission-2",
          final_score: 88,
          ai_breakdown: [{ criterion: "Analysis", score: 22, max_score: 25 }],
        },
      ],
      assignments: [
        ...defaultAssignments,
        { id: "assignment-2", module_code: "ENG102", title: "Draft Essay" },
      ],
    });

    renderExplainGrade();

    expect(await screen.findByText("Critical Essay")).toBeInTheDocument();
    expect(screen.getByText("How to Improve")).toBeInTheDocument();
    expect(screen.getByText("Specific guidance to raise your grade band")).toBeInTheDocument();
    expect(screen.queryByText("Draft Essay")).not.toBeInTheDocument();
  });

  it("builds grade selector labels without using the student name", () => {
    expect(
      buildGradeSelectorLabels({
        assignmentTitle: "Data Structures Assignment",
        fileName: "Nkechi Onwumere CV.docx",
        releasedAt: "2026-04-29T10:00:00.000Z",
        score: 67,
      }),
    ).toEqual({
      label: "Data Structures Assignment \u2014 67%",
      assessment: "Data Structures Assignment",
      secondaryLabel: "Nkechi Onwumere CV.docx \u00b7 Released 29 Apr 2026",
    });

    expect(
      buildGradeSelectorLabels({
        assignmentTitle: null,
        fileName: "fallback-report.pdf",
        score: 58,
      }),
    ).toMatchObject({
      label: "fallback-report.pdf \u2014 58%",
      assessment: "fallback-report.pdf",
      secondaryLabel: null,
    });

    expect(
      buildGradeSelectorLabels({
        assignmentTitle: "",
        fileName: null,
        score: 41,
      }),
    ).toMatchObject({
      label: "Released grade \u2014 41%",
      assessment: "Released grade",
    });
  });

  it("uses assignment title and score as the rendered grade selector main label", async () => {
    setupSupabase({
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          student_name: "abdullahi faruk",
          file_name: "Nkechi Onwumere CV.docx",
          status: "released",
          updated_at: "2026-04-29T10:00:00.000Z",
        },
        {
          id: "submission-2",
          assignment_id: null,
          student_name: "Other Student",
          file_name: "fallback-report.pdf",
          status: "released",
          updated_at: "2026-04-28T10:00:00.000Z",
        },
        {
          id: "submission-3",
          assignment_id: null,
          student_name: "Hidden Student",
          file_name: null,
          status: "released",
        },
      ],
      grades: [
        {
          id: "grade-1",
          submission_id: "submission-1",
          final_score: 67,
          ai_breakdown: [{ criterion: "Correctness", score: 17, max_score: 25 }],
        },
        {
          id: "grade-2",
          submission_id: "submission-2",
          final_score: 58,
          ai_breakdown: [{ criterion: "Analysis", score: 15, max_score: 25 }],
        },
        {
          id: "grade-3",
          submission_id: "submission-3",
          final_score: 41,
          ai_breakdown: [{ criterion: "Evidence", score: 10, max_score: 25 }],
        },
      ],
      assignments: [],
      assignmentMetadata: [
        {
          assignment_id: "assignment-1",
          max_score: 100,
          module_code: "CS201",
          submission_id: "submission-1",
          title: "Data Structures Assignment",
        },
      ],
    });

    renderExplainGrade();

    expect(await screen.findByText("Data Structures Assignment")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("Data Structures Assignment \u2014 67%");
    expect(screen.getByRole("combobox")).toHaveTextContent("Nkechi Onwumere CV.docx");
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("get_student_submission_grade_projection");
    expect(screen.queryByText(/abdullahi faruk/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Other Student/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hidden Student/i)).not.toBeInTheDocument();
  });

  it("focuses the released result linked from a notification assignment query", async () => {
    setupSupabase({
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          student_name: "Sam Student",
          file_name: "essay.pdf",
          status: "released",
        },
        {
          id: "submission-2",
          assignment_id: "assignment-2",
          student_name: "Sam Student",
          file_name: "report.pdf",
          status: "released",
        },
      ],
      grades: [
        {
          id: "grade-1",
          submission_id: "submission-1",
          final_score: 74,
          ai_breakdown: [{ criterion: "Argument", score: 18, max_score: 25 }],
        },
        {
          id: "grade-2",
          submission_id: "submission-2",
          final_score: 81,
          ai_breakdown: [{ criterion: "Analysis", score: 21, max_score: 25 }],
        },
      ],
      assignments: [
        { id: "assignment-1", module_code: "ENG101", title: "Critical Essay" },
        { id: "assignment-2", module_code: "ENG102", title: "Research Report" },
      ],
      assignmentMetadata: [
        {
          assignment_id: "assignment-1",
          max_score: 100,
          module_code: "ENG101",
          submission_id: "submission-1",
          title: "Critical Essay",
        },
        {
          assignment_id: "assignment-2",
          max_score: 100,
          module_code: "ENG102",
          submission_id: "submission-2",
          title: "Research Report",
        },
      ],
    });

    renderExplainGrade("/dashboard/explain-grade?assignment=assignment-2&source=notification");

    expect(await screen.findByText("Opened from released-grade notification")).toBeInTheDocument();
    expect(screen.getAllByText(/Research Report/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("81%").length).toBeGreaterThan(0);
  });

  it("falls back to file name when assignment title metadata is unavailable", async () => {
    setupSupabase({
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          student_name: "Sam Student",
          file_name: "fallback-report.pdf",
          status: "released",
        },
      ],
      assignments: [],
      assignmentMetadata: [],
    });

    renderExplainGrade();

    expect(await screen.findByText("fallback-report.pdf")).toBeInTheDocument();
    expect(screen.queryByText(/Sam Student/i)).not.toBeInTheDocument();
  });

  it("falls back to Released grade when assignment title and file name are unavailable", async () => {
    setupSupabase({
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          student_name: "Sam Student",
          file_name: null,
          status: "released",
        },
      ],
      assignments: [],
      assignmentMetadata: [],
    });

    renderExplainGrade();

    expect(await screen.findByText("Released Result Summary")).toBeInTheDocument();
    expect(screen.getAllByText("Released grade").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Sam Student/i)).not.toBeInTheDocument();
  });

  it("shows safe student guidance without exposing provisional or unreleased grading data", async () => {
    setupSupabase();

    renderExplainGrade();

    expect(await screen.findByText("How to Improve")).toBeInTheDocument();
    expect(screen.getByText("Specific guidance to raise your grade band")).toBeInTheDocument();
    expect(screen.getByText(/Seek specific feedback on this area from your lecturer/i)).toBeInTheDocument();
    expect(screen.getByText("Turn this released result into a short, specific plan for the next piece of work.")).toBeInTheDocument();
    expect(screen.queryByText(/provisional/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approved/i)).not.toBeInTheDocument();
  });

  it("renders valid breakdown data that uses maxScore without crashing", async () => {
    setupSupabase({
      grades: [
        {
          id: "grade-1",
          submission_id: "submission-1",
          final_score: 74,
          ai_breakdown: [
            { name: "Argument", score: 18, maxScore: 25 },
            { name: "Evidence", score: 19, maxScore: 25 },
          ],
        },
      ],
    });

    renderExplainGrade();

    expect(await screen.findByText("Grade Breakdown")).toBeInTheDocument();
    expect(screen.getByText(/Argument \(50%\)/i)).toBeInTheDocument();
  });

  it("drops invalid breakdown data and shows a safe empty state", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setupSupabase({
      grades: [
        {
          id: "grade-1",
          submission_id: "submission-1",
          final_score: 74,
          ai_breakdown: [
            { criterion: "Argument", score: 18, max_score: 25 },
            { score: 19, max_score: 25 },
          ],
        },
      ],
    });

    renderExplainGrade();

    expect(await screen.findByText(/No graded submissions found/i)).toBeInTheDocument();
    expect(screen.queryByText("Grade Breakdown")).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("renders a safe fallback state if the request fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setupSupabase({
      submissionsError: new Error("supabase unavailable"),
    });

    renderExplainGrade();

    await waitFor(() => {
      expect(screen.getByText(/No graded submissions found/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("Grade Breakdown")).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("sends submissionId and messages without browser gradeContext", async () => {
    setupSupabase();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"Use the released feedback."}}]}\n\ndata: [DONE]\n\n',
              ),
            );
            controller.close();
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderExplainGrade();

    expect(await screen.findByText("Grade Breakdown")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Ask about your grade..."), {
      target: { value: "How can I improve?" },
    });
    fireEvent.click(screen.getAllByRole("button").at(-1)!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(requestBody.submissionId).toBe("submission-1");
    expect(requestBody.messages.at(-1)).toEqual({ role: "user", content: "How can I improve?" });
    expect(requestBody.gradeContext).toBeUndefined();
    expect(JSON.stringify(requestBody)).not.toContain("Argument");
  });
});
