import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StudentGrades from "@/pages/dashboard/StudentGrades";

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: false,
    user: { id: "student-1" },
  },
  logger: {
    warn: vi.fn(),
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

vi.mock("@/lib/logger", () => ({
  log: mocks.logger,
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

type ProjectionRow = {
  submission_id: string;
  assignment_id: string;
  assignment_title: string | null;
  module_code: string | null;
  max_score: number | null;
  file_name: string;
  file_url: string | null;
  submission_status: string;
  submitted_at: string;
  final_score: number | null;
  ai_score: number | null;
  final_feedback: string | null;
  ai_feedback: string | null;
  ai_breakdown: null;
};

const defaultProjection: ProjectionRow[] = [
  {
    submission_id: "submission-1",
    assignment_id: "assignment-1",
    assignment_title: "Algorithms Essay",
    module_code: "CS301",
    max_score: 100,
    file_name: "essay.pdf",
    file_url: null,
    submission_status: "released",
    submitted_at: "2026-04-20T10:00:00.000Z",
    final_score: 76,
    ai_score: null,
    final_feedback: "Released feedback",
    ai_feedback: null,
    ai_breakdown: null,
  },
];

const setupSupabase = ({
  projection = defaultProjection,
  projectionError = null,
  submissions = [],
  grades = [],
  assignments = [],
}: {
  projection?: ProjectionRow[];
  projectionError?: { message: string } | null;
  submissions?: Array<Record<string, unknown>>;
  grades?: Array<Record<string, unknown>>;
  assignments?: Array<Record<string, unknown>>;
} = {}) => {
  mocks.supabase.rpc.mockResolvedValue({
    data: projection,
    error: projectionError,
  });
  mocks.supabase.from.mockReset();
  mocks.supabase.from.mockImplementation((table: string) => {
    if (table === "submissions") {
      return {
        select: () => ({
          eq: vi.fn().mockResolvedValue({
            data: submissions,
            error: null,
          }),
        }),
      };
    }

    if (table === "grades") {
      return {
        select: () => ({
          in: vi.fn().mockResolvedValue({
            data: grades,
            error: null,
          }),
        }),
      };
    }

    if (table === "assignments") {
      return {
        select: () => ({
          in: vi.fn().mockResolvedValue({
            data: assignments,
            error: null,
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
};

describe("StudentGrades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState.isDemo = false;
    mocks.authState.user = { id: "student-1" };
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
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("get_student_submission_grade_projection");
  });

  it("falls back safely when assignment metadata is unavailable", async () => {
    setupSupabase({
      projection: [
        {
          ...defaultProjection[0],
          assignment_title: null,
        },
      ],
    });

    render(<StudentGrades />);

    await waitFor(() => {
      expect(screen.getByText("Assignment title unavailable")).toBeInTheDocument();
    });

    expect(screen.getByText("76/100")).toBeInTheDocument();
    expect(mocks.logger.warn).not.toHaveBeenCalled();
  });

  it("falls back to direct student queries when the projection RPC is unavailable", async () => {
    setupSupabase({
      projection: [],
      projectionError: { message: "function does not exist" },
      submissions: [
        {
          id: "submission-1",
          assignment_id: "assignment-1",
          file_name: "essay.pdf",
          file_url: "",
          status: "released",
          submitted_at: "2026-04-20T10:00:00.000Z",
          student_id: "student-1",
        },
      ],
      grades: [
        {
          submission_id: "submission-1",
          final_score: 76,
          ai_score: null,
          final_feedback: "Released feedback",
          ai_feedback: null,
          ai_breakdown: null,
        },
      ],
      assignments: [
        {
          id: "assignment-1",
          title: "Algorithms Essay",
          module_code: "CS301",
          max_score: 100,
        },
      ],
    });

    render(<StudentGrades />);

    await waitFor(() => {
      expect(screen.getByText("Algorithms Essay")).toBeInTheDocument();
    });

    expect(screen.getByText("76/100")).toBeInTheDocument();
    expect(mocks.supabase.from).toHaveBeenCalledWith("submissions");
    expect(mocks.supabase.from).toHaveBeenCalledWith("grades");
    expect(mocks.supabase.from).toHaveBeenCalledWith("assignments");
  });

  it("uses shared synthetic assignment-set data in demo mode", async () => {
    mocks.authState.isDemo = true;
    mocks.authState.user = null;

    render(<StudentGrades />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Evaluating the Role of Artificial Intelligence in University Assessment and Student Support",
        ),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("84/100")).toBeInTheDocument();
    expect(screen.getByText("Network Security Incident Reflection")).toBeInTheDocument();
    expect(screen.getByText("submitted")).toBeInTheDocument();
    expect(mocks.supabase.rpc).not.toHaveBeenCalled();
  });
});
