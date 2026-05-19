import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StudentGrades, { calculateGradeStats } from "@/pages/dashboard/StudentGrades";

const mocks = vi.hoisted(() => {
  const createSignedUrl = vi.fn();

  return {
    authState: {
      isDemo: false,
      user: { id: "student-1" },
      profile: { full_name: "Ada Student" },
    },
    logger: {
      warn: vi.fn(),
      error: vi.fn(),
    },
    toast: {
      error: vi.fn(),
    },
    createSignedUrl,
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl,
        })),
      },
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.supabase,
}));

vi.mock("@/lib/logger", () => ({
  log: mocks.logger,
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ "data-testid": testId }: { "data-testid"?: string }) => (
    <svg data-testid={testId ?? "icon"} />
  );

  return {
    AlertTriangle: Icon,
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
  ai_breakdown: Array<{
    criterion: string;
    score: number;
    max_score: number;
    feedback?: string;
    comment?: string;
  }> | null;
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
    ai_breakdown: [
      {
        criterion: "Argument",
        score: 24,
        max_score: 30,
        feedback: "Clear argument with a mostly convincing line of reasoning.",
      },
      {
        criterion: "Evidence",
        score: 28,
        max_score: 35,
        comment: "Evidence is relevant, though some examples need tighter analysis.",
      },
      {
        criterion: "Structure",
        score: 24,
        max_score: 35,
        feedback: "The structure is understandable, but transitions could be stronger.",
      },
    ],
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
    mocks.authState.profile = { full_name: "Ada Student" };
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/submission.pdf" },
      error: null,
    });
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

    expect(screen.getByText("Your results, Ada")).toBeInTheDocument();
    expect(screen.getByText("Current position")).toBeInTheDocument();
    expect(screen.getByText("You have a released result ready")).toBeInTheDocument();
    expect(screen.getByText("Algorithms Essay has feedback ready to review")).toBeInTheDocument();
    expect(screen.getByText("Open the released result and review the criterion feedback")).toBeInTheDocument();
    expect(screen.getByText("76/100")).toBeInTheDocument();
    expect(screen.getByText("Released")).toBeInTheDocument();
    expect(screen.getByText("You scored 76 out of 100.")).toBeInTheDocument();
    expect(screen.getByText("That is 36 marks above the pass mark of 40.")).toBeInTheDocument();
    expect(screen.getByText("Good work on this one.")).toBeInTheDocument();
    expect(screen.getByText("Rubric Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Clear argument with a mostly convincing line of reasoning.")).toBeInTheDocument();
    expect(screen.getByText("Evidence is relevant, though some examples need tighter analysis.")).toBeInTheDocument();
    expect(screen.getByText("Strongest Areas")).toBeInTheDocument();
    expect(screen.getByText("Areas To Work On")).toBeInTheDocument();
    expect(screen.getByText("Lecturer Feedback")).toBeInTheDocument();
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

  it("shows a forward-looking message when a released grade is below the pass mark", async () => {
    setupSupabase({
      projection: [
        {
          ...defaultProjection[0],
          assignment_title: "Statistics Report",
          final_score: 34,
          ai_breakdown: [
            { criterion: "Interpretation", score: 12, max_score: 40, feedback: "Interpretation needs to be clearer." },
          ],
        },
      ],
    });

    render(<StudentGrades />);

    await waitFor(() => {
      expect(screen.getByText("Statistics Report")).toBeInTheDocument();
    });

    expect(screen.getByText("You scored 34 out of 100.")).toBeInTheDocument();
    expect(screen.getByText("That is 6 marks below the pass mark of 40.")).toBeInTheDocument();
    expect(screen.getByText("Here is what to focus on next.")).toBeInTheDocument();
  });

  it("uses shared synthetic assignment-set data in demo mode", async () => {
    mocks.authState.isDemo = true;
    mocks.authState.user = null;
    mocks.authState.profile = { full_name: "Demo Student" };

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

  it("shows a page-level error state when grades cannot be loaded", async () => {
    setupSupabase();
    mocks.supabase.rpc.mockRejectedValueOnce(new Error("offline"));

    render(<StudentGrades />);

    await waitFor(() => {
      expect(screen.getByText("Results unavailable")).toBeInTheDocument();
    });

    expect(screen.getByText("Your results could not be loaded right now.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("renders a safe pending-state card when feedback is not yet released", async () => {
    setupSupabase({
      projection: [
        {
          ...defaultProjection[0],
          submission_id: "submission-pending",
          assignment_id: "assignment-2",
          assignment_title: "Pending Review Essay",
          submission_status: "moderation_in_progress",
          final_score: null,
          ai_score: null,
          final_feedback: null,
          ai_feedback: null,
          ai_breakdown: null,
        },
      ],
    });

    render(<StudentGrades />);

    await waitFor(() => {
      expect(screen.getByText("Pending Review Essay")).toBeInTheDocument();
    });

    expect(screen.getByText("Current position")).toBeInTheDocument();
    expect(screen.getByText("Your result is still being prepared")).toBeInTheDocument();
    expect(screen.getByText("moderation in progress is still blocking release")).toBeInTheDocument();
    expect(screen.getByText("Wait for marking and moderation to complete before checking again")).toBeInTheDocument();
    expect(screen.getByText("moderation in progress")).toBeInTheDocument();
    expect(screen.getByText("Your results are on the way")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your grades and feedback will appear here once your lecturer has finished reviewing and releasing them.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Lecturer Feedback")).not.toBeInTheDocument();
    expect(screen.queryByText("Strongest Areas")).not.toBeInTheDocument();
  });

  it("does not produce NaN percentages when maxScore is zero", async () => {
    setupSupabase({
      projection: [
        {
          ...defaultProjection[0],
          max_score: 0,
          final_score: 12,
          ai_breakdown: [
            {
              criterion: "Argument",
              score: 12,
              max_score: 0,
              feedback: "Still awaiting rubric normalization.",
            },
          ],
        },
      ],
    });

    const { container } = render(<StudentGrades />);

    await waitFor(() => {
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    expect(container.textContent).not.toContain("NaN");
    expect(container.textContent).not.toContain("Infinity");
  });

  it("clamps percentages at 100% when score is above maxScore", async () => {
    setupSupabase({
      projection: [
        {
          ...defaultProjection[0],
          final_score: 120,
          ai_breakdown: [
            {
              criterion: "Argument",
              score: 40,
              max_score: 30,
              feedback: "Exceeded the available points in the imported breakdown.",
            },
          ],
        },
      ],
    });

    render(<StudentGrades />);

    await waitFor(() => {
      expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
    });
  });

  it("clamps percentages at 0% when score is negative", async () => {
    setupSupabase({
      projection: [
        {
          ...defaultProjection[0],
          final_score: -5,
          ai_breakdown: [
            {
              criterion: "Argument",
              score: -2,
              max_score: 30,
              feedback: "Imported negative score should not produce a negative width.",
            },
          ],
        },
      ],
    });

    render(<StudentGrades />);

    await waitFor(() => {
      expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
    });
  });

  it("shows a user-facing error when submission download URL creation fails", async () => {
    setupSupabase({
      projection: [
        {
          ...defaultProjection[0],
          file_url: "student/submission-1.pdf",
        },
      ],
    });
    mocks.createSignedUrl.mockResolvedValueOnce({
      data: null,
      error: { message: "storage offline" },
    });

    render(<StudentGrades />);

    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /download submission/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /download submission/i }));

    await waitFor(() => {
      expect(mocks.toast.error).toHaveBeenCalledWith("Download unavailable", {
        description: "Your submission could not be opened right now. Please try again later.",
      });
    });

    expect(mocks.logger.error).toHaveBeenCalledWith(
      "Failed to create student submission download URL",
      { message: "storage offline" },
      { submissionId: "submission-1" },
    );
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });
});

describe("calculateGradeStats", () => {
  it("returns zeroed stats when there are no released scores", () => {
    expect(calculateGradeStats([])).toEqual({
      avg: 0,
      count: 0,
      highest: 0,
      lowest: 0,
    });
  });
});
