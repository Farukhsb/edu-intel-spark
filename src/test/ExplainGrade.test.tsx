import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ExplainGrade, { getBreakdownMaxScore } from "@/pages/dashboard/ExplainGrade";

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

const setupSupabase = ({
  submissions = defaultSubmissions,
  grades = defaultGrades,
  assignments = defaultAssignments,
  submissionsPromise,
  submissionsError,
}: {
  submissions?: SubmissionRow[];
  grades?: GradeRow[];
  assignments?: AssignmentRow[];
  submissionsPromise?: Promise<{ data: SubmissionRow[] }>;
  submissionsError?: Error;
} = {}) => {
  mocks.supabase.auth.getSession.mockResolvedValue({
    data: { session: { access_token: "test-token" } },
  });

  mocks.supabase.from.mockImplementation((table: string) => ({
    select: vi.fn(() => {
      if (table === "submissions") {
        if (submissionsError) {
          return Promise.reject(submissionsError);
        }

        if (submissionsPromise) {
          return submissionsPromise;
        }

        return Promise.resolve({ data: submissions });
      }

      if (table === "grades") {
        return {
          in: vi.fn((column: string, values: string[]) =>
            Promise.resolve({
              data: grades.filter((grade) =>
                column === "submission_id" ? values.includes(grade.submission_id) : true
              ),
            })
          ),
        };
      }

      if (table === "assignments") {
        return {
          in: vi.fn((column: string, values: string[]) =>
            Promise.resolve({
              data: assignments.filter((assignment) =>
                column === "id" ? values.includes(assignment.id) : true
              ),
            })
          ),
        };
      }

      return Promise.resolve({ data: [] });
    }),
  }));
};

const renderExplainGrade = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
    expect(screen.getByText("ENG101 Critical Essay")).toBeInTheDocument();
    expect(screen.getByText("74%")).toBeInTheDocument();
  });

  it("uses synthetic demo data and answers without Supabase session access in demo mode", async () => {
    mocks.authState.isDemo = true;

    renderExplainGrade();

    expect(await screen.findByText("Grade Breakdown")).toBeInTheDocument();
    expect(
      screen.getByText(
        "EDU401 Evaluating the Role of Artificial Intelligence in University Assessment and Student Support",
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
    const deferred = createDeferred<{ data: SubmissionRow[] }>();
    setupSupabase({ submissionsPromise: deferred.promise });

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

    expect(await screen.findByText("ENG101 Critical Essay")).toBeInTheDocument();
    expect(screen.getByText("How to Improve")).toBeInTheDocument();
    expect(screen.getByText("Specific guidance to raise your grade band")).toBeInTheDocument();
    expect(screen.queryByText("Draft Essay")).not.toBeInTheDocument();
  });

  it("shows safe student guidance without exposing provisional or unreleased grading data", async () => {
    setupSupabase();

    renderExplainGrade();

    expect(await screen.findByText("How to Improve")).toBeInTheDocument();
    expect(screen.getByText("Specific guidance to raise your grade band")).toBeInTheDocument();
    expect(screen.getByText(/Seek specific feedback on this area from your lecturer/i)).toBeInTheDocument();
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
