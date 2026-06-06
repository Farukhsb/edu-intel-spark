import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PerformanceTrends from "@/pages/dashboard/PerformanceTrends";

const dataset = {
  assignments: [{ id: "a1", title: "Algorithms Coursework", module_code: "CS101" }],
  submissions: [
    {
      id: "s1",
      assignment_id: "a1",
      student_id: "student-1",
      student_name: "Critical Student",
      student_email: "critical@example.edu",
      submitted_at: "2026-04-10T10:00:00.000Z",
    },
    {
      id: "s2",
      assignment_id: "a1",
      student_id: "student-1",
      student_name: "Critical Student",
      student_email: "critical@example.edu",
      submitted_at: "2026-04-20T10:00:00.000Z",
    },
    {
      id: "s3",
      assignment_id: "a1",
      student_id: "student-2",
      student_name: "High Student",
      student_email: "high@example.edu",
      submitted_at: "2026-04-10T10:00:00.000Z",
    },
    {
      id: "s4",
      assignment_id: "a1",
      student_id: "student-2",
      student_name: "High Student",
      student_email: "high@example.edu",
      submitted_at: "2026-04-20T10:00:00.000Z",
    },
  ],
  grades: [
    { submission_id: "s1", ai_score: null, final_score: 35 },
    { submission_id: "s2", ai_score: null, final_score: 20 },
    { submission_id: "s3", ai_score: null, final_score: 49 },
    { submission_id: "s4", ai_score: null, final_score: 35 },
  ],
};

const mocks = vi.hoisted(() => ({
  authState: {
    isDemo: false,
    user: { id: "lecturer-1" },
  },
  toast: vi.fn(),
  fetchLecturerPerformanceDataset: vi.fn(async () => dataset),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/lib/data/student", () => ({
  fetchLecturerPerformanceDataset: mocks.fetchLecturerPerformanceDataset,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  Line: () => <div />,
  Bar: () => <div />,
  Cell: () => <div />,
}));

describe("PerformanceTrends", () => {
  beforeEach(() => {
    mocks.authState.isDemo = false;
    mocks.authState.user = { id: "lecturer-1" };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("batches at-risk student alerts into a single toast", async () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard/performance"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <PerformanceTrends />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Average Grades Over Time")).toBeInTheDocument();
    expect(screen.getByText("Teaching Focus")).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledTimes(1);
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "At-risk students detected",
          description: expect.stringContaining("Critical: Critical Student"),
        }),
      );
    });
  });
});
