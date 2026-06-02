import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ExternalExaminerExport from "@/pages/dashboard/ExternalExaminerExport";
import { buildExternalExaminerCsv } from "@/lib/externalExaminerExport";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: false,
    user: { id: "lecturer-1" },
  },
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  supabase: {
    from: vi.fn(),
  },
}));

let capturedBlob: Blob | null = null;

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
    Check: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Download: Icon,
    FileText: Icon,
    Loader2: () => <svg data-testid="loading-spinner" />,
    Shield: Icon,
    Users: Icon,
  };
});

type AssignmentRow = {
  id: string;
  title: string;
  module_code: string | null;
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  status: string | null;
  submitted_at: string | null;
};

type GradeRow = {
  submission_id: string;
  ai_score: number | null;
  lecturer_score: number | null;
  final_score: number | null;
  ai_feedback: string | null;
  lecturer_feedback: string | null;
  final_feedback: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
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

const defaultAssignments: AssignmentRow[] = [
  { id: "assignment-1", title: "Policy Case Study", module_code: "POL301" },
];

const defaultSubmissions: SubmissionRow[] = [
  {
    id: "submission-1",
    assignment_id: "assignment-1",
    student_id: "student-1",
    student_name: "Sam Student",
    student_email: "sam@example.edu",
    status: "released",
    submitted_at: "2026-04-20T10:00:00.000Z",
  },
];

const defaultGrades: GradeRow[] = [
  {
    submission_id: "submission-1",
    ai_score: 68,
    lecturer_score: 70,
    final_score: 72,
    ai_feedback: "AI feedback",
    lecturer_feedback: "Lecturer feedback",
    final_feedback: "Final agreed feedback",
    reviewed_at: "2026-04-22T10:00:00.000Z",
    reviewed_by: "moderator-1",
  },
];

const defaultProfiles: ProfileRow[] = [
  { id: "moderator-1", full_name: "Dr Ada Lecturer", email: "ada@example.edu" },
  { id: "student-1", full_name: "Sam Student", email: "sam@example.edu" },
];

const setupSupabase = ({
  assignments = defaultAssignments,
  submissions = defaultSubmissions,
  grades = defaultGrades,
  profiles = defaultProfiles,
  assignmentsPromise,
  assignmentsError,
  submissionsError,
  gradesError,
  profilesError,
  gradesFallback,
}: {
  assignments?: AssignmentRow[];
  submissions?: SubmissionRow[];
  grades?: GradeRow[];
  profiles?: ProfileRow[];
  assignmentsPromise?: Promise<{ data: AssignmentRow[] }>;
  assignmentsError?: Error;
  submissionsError?: Error;
  gradesError?: Error;
  profilesError?: Error;
  gradesFallback?: GradeRow[];
} = {}) => {
  mocks.supabase.from.mockImplementation((table: string) => ({
    select: vi.fn((fields: string) => {
      if (table === "assignments") {
        if (assignmentsError) {
          return Promise.resolve({ data: null, error: assignmentsError });
        }
        if (assignmentsPromise) {
          return assignmentsPromise;
        }
        return Promise.resolve({ data: assignments, error: null });
      }
      if (table === "submissions") {
        if (submissionsError) {
          return Promise.resolve({ data: null, error: submissionsError });
        }
        return Promise.resolve({ data: submissions, error: null });
      }
      if (table === "grades") {
        if (gradesError) {
          if (!fields.includes("grade_source") && gradesFallback) {
            return Promise.resolve({ data: gradesFallback, error: null });
          }
          return Promise.resolve({ data: null, error: gradesError });
        }
        return Promise.resolve({ data: grades, error: null });
      }
      if (table === "profiles") {
        if (profilesError) {
          return Promise.resolve({ data: null, error: profilesError });
        }
        return Promise.resolve({ data: profiles, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    }),
  }));
};

describe("ExternalExaminerExport", () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let anchorClick: ReturnType<typeof vi.fn>;
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    mocks.authState.isDemo = false;
    mocks.authState.user = { id: "lecturer-1" };
    anchorClick = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: URL.createObjectURL ?? vi.fn(),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: URL.revokeObjectURL ?? vi.fn(),
    });
    createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
      capturedBlob = blob instanceof Blob ? blob : null;
      return "blob:export-url";
    });
    revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
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
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    createElementSpy.mockRestore();
  });

  it("renders without crashing", async () => {
    setupSupabase();

    render(<ExternalExaminerExport />);

    expect(await screen.findByText("Export Preview")).toBeInTheDocument();
    expect(screen.getByText("Sam Student")).toBeInTheDocument();
  });

  it("shows a loading state", () => {
    const deferred = createDeferred<{ data: AssignmentRow[] }>();
    setupSupabase({ assignmentsPromise: deferred.promise });

    render(<ExternalExaminerExport />);

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("shows an empty state when no exportable data exists", async () => {
    setupSupabase({
      assignments: [],
      submissions: [],
      grades: [],
      profiles: [],
    });

    render(<ExternalExaminerExport />);

    expect(await screen.findByText("No external examiner data yet")).toBeInTheDocument();
    expect(screen.queryByText("Export Preview")).not.toBeInTheDocument();
  });

  it("renders the export table and summary with mocked data", async () => {
    setupSupabase();

    render(<ExternalExaminerExport />);

    expect(await screen.findByText("1 records ready for export")).toBeInTheDocument();
    expect(screen.getByText("Average final score")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.getByText("Governed export scope")).toBeInTheDocument();
    expect(
      screen.getByText(/Only moderated, approved, and released submissions are included in the examiner export\./i),
    ).toBeInTheDocument();
    expect(screen.getByText("Policy Case Study")).toBeInTheDocument();
    expect(screen.getByText("POL301")).toBeInTheDocument();
    expect(screen.getByText("1st")).toBeInTheDocument();
    expect(screen.getByText("released")).toBeInTheDocument();
  });

  it("only enables export actions when valid data exists", async () => {
    setupSupabase({
      assignments: [],
      submissions: [],
      grades: [],
      profiles: [],
    });

    render(<ExternalExaminerExport />);

    expect(await screen.findByText("No external examiner data yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Export CSV/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Detailed Report/i })).not.toBeInTheDocument();
  });

  it("calls the download helper path with safe mocked data", async () => {
    setupSupabase();

    render(<ExternalExaminerExport />);

    const exportButton = await screen.findByRole("button", { name: /Export CSV/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("includes grade source in the exported CSV headers and rows", () => {
    const csv = buildExternalExaminerCsv(
      [
        {
          studentName: "Sam Student",
          studentEmail: "sam@example.edu",
          assignmentTitle: "Policy Case Study",
          moduleCode: "POL301",
          aiScore: 68,
          lecturerScore: 70,
          finalScore: 72,
          gradeSource: "lecturer_reviewed",
          aiFeedback: "AI feedback",
          lecturerFeedback: "Lecturer feedback",
          finalFeedback: "Final agreed feedback",
          status: "released",
          submittedAt: "2026-04-20",
          reviewedAt: "2026-04-22",
          reviewedBy: "Dr Ada Lecturer",
          classification: "1st",
        },
      ],
      {
        scores: true,
        feedback: true,
        moderation: true,
        aiBreakdown: false,
        studentIdentity: true,
      },
    );

    expect(csv).toContain("AI Score,Lecturer Score,Final Score,Classification,Source");
    expect(csv).toContain("lecturer_reviewed");
  });

  it("renders a safe fallback state if the request fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setupSupabase({
      assignmentsError: new Error("supabase unavailable"),
    });

    render(<ExternalExaminerExport />);

    expect(await screen.findByText("External examiner export unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Sam Student")).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("reports which external examiner query failed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setupSupabase({
      gradesError: new Error("grades unavailable"),
    });

    render(<ExternalExaminerExport />);

    expect(await screen.findByText("External examiner export unavailable")).toBeInTheDocument();
    expect(screen.getByText("External examiner data could not be loaded right now. Failed to load grades. Try again later.")).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("falls back when the grades query cannot read grade_source", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setupSupabase({
      gradesError: new Error("column grade_source does not exist"),
      gradesFallback: defaultGrades,
    });

    render(<ExternalExaminerExport />);

    expect(await screen.findByText("Export Preview")).toBeInTheDocument();
    expect(screen.getByText("Sam Student")).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
    expect(screen.queryByText("External examiner export unavailable")).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("does not export draft or unreleased records when only governed records should be exported", async () => {
    setupSupabase({
      submissions: [
        ...defaultSubmissions,
        {
          id: "submission-2",
          assignment_id: "assignment-1",
          student_id: "student-2",
          student_name: "Draft Student",
          student_email: "draft@example.edu",
          status: "submitted",
          submitted_at: "2026-04-21T10:00:00.000Z",
        },
        {
          id: "submission-3",
          assignment_id: "assignment-1",
          student_id: "student-3",
          student_name: "Approved Student",
          student_email: "approved@example.edu",
          status: "approved",
          submitted_at: "2026-04-21T10:00:00.000Z",
        },
      ],
      grades: [
        ...defaultGrades,
        {
          submission_id: "submission-2",
          ai_score: 55,
          lecturer_score: null,
          final_score: null,
          ai_feedback: "Draft feedback",
          lecturer_feedback: null,
          final_feedback: null,
          reviewed_at: null,
          reviewed_by: null,
        },
        {
          submission_id: "submission-3",
          ai_score: 61,
          lecturer_score: 63,
          final_score: 64,
          ai_feedback: "Approved feedback",
          lecturer_feedback: "Lecturer approved feedback",
          final_feedback: "Final approved feedback",
          reviewed_at: "2026-04-23T10:00:00.000Z",
          reviewed_by: "moderator-1",
        },
      ],
      profiles: [
        ...defaultProfiles,
        { id: "student-2", full_name: "Draft Student", email: "draft@example.edu" },
        { id: "student-3", full_name: "Approved Student", email: "approved@example.edu" },
      ],
    });

    render(<ExternalExaminerExport />);

    expect(await screen.findByText("Approved Student")).toBeInTheDocument();
    expect(screen.queryByText("Draft Student")).not.toBeInTheDocument();
    expect(screen.queryByText("submitted")).not.toBeInTheDocument();
  });
});
