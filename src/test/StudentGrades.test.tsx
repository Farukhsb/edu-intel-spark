import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StudentGrades from "@/pages/dashboard/StudentGrades";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: false,
    user: { id: "student-1" },
  },
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(),
      })),
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ "data-testid": testId }: { "data-testid"?: string }) => (
    <svg data-testid={testId ?? "icon"} />
  );

  return {
    Download: Icon,
    Loader2: () => <svg data-testid="loading-spinner" />,
  };
});

type SubmissionRow = {
  id: string;
  assignment_id: string;
  student_id: string;
  status: string;
  submitted_at: string;
  file_url: string | null;
};

type GradeRow = {
  submission_id: string;
  final_score: number | null;
  ai_score: number | null;
  final_feedback: string | null;
  ai_feedback: string | null;
  ai_breakdown: null;
};

type AssignmentMetadataRow = {
  submission_id: string;
  assignment_id: string;
  title: string | null;
  module_code: string | null;
  max_score: number | null;
};

const defaultSubmissions: SubmissionRow[] = [
  {
    id: "submission-1",
    assignment_id: "assignment-1",
    student_id: "student-1",
    status: "released",
    submitted_at: "2026-04-20T10:00:00.000Z",
    file_url: null,
  },
];

const defaultGrades: GradeRow[] = [
  {
    submission_id: "submission-1",
    final_score: 76,
    ai_score: null,
    final_feedback: "Released feedback",
    ai_feedback: null,
    ai_breakdown: null,
  },
];

const defaultAssignmentMetadata: AssignmentMetadataRow[] = [
  {
    submission_id: "submission-1",
    assignment_id: "assignment-1",
    title: "Algorithms Essay",
    module_code: "CS301",
    max_score: 100,
  },
];

const setupSupabase = ({
  submissions = defaultSubmissions,
  grades = defaultGrades,
  assignmentMetadata = defaultAssignmentMetadata,
  assignmentMetadataError = null,
}: {
  submissions?: SubmissionRow[];
  grades?: GradeRow[];
  assignmentMetadata?: AssignmentMetadataRow[];
  assignmentMetadataError?: { message: string } | null;
} = {}) => {
  mocks.supabase.from.mockImplementation((table: string) => {
    if (table === "submissions") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: submissions, error: null }),
        })),
      };
    }

    if (table === "grades") {
      return {
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: grades, error: null }),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  mocks.supabase.rpc.mockResolvedValue({
    data: assignmentMetadata,
    error: assignmentMetadataError,
  });
};

describe("StudentGrades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows assignment title when student metadata is available", async () => {
    setupSupabase();

    render(<StudentGrades />);

    await waitFor(() => {
      expect(screen.getByText("Algorithms Essay")).toBeInTheDocument();
    });

    expect(screen.getByText("76/100")).toBeInTheDocument();
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("get_student_grade_assignment_metadata");
  });

  it("falls back safely when assignment metadata is unavailable", async () => {
    setupSupabase({
      assignmentMetadata: [],
      assignmentMetadataError: { message: "RLS blocked assignment row" },
    });

    render(<StudentGrades />);

    await waitFor(() => {
      expect(screen.getByText("Assignment title unavailable")).toBeInTheDocument();
    });

    expect(screen.getByText("76/100")).toBeInTheDocument();
  });
});
