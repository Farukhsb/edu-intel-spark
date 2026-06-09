import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import CohortSignal from "@/pages/dashboard/CohortSignal";

const mocks = vi.hoisted(() => ({
  authState: {
    profile: {
      id: "admin-1",
      full_name: "Admin User",
      email: "admin@example.com",
      role: "admin",
    },
    user: {
      id: "admin-1",
      email: "admin@example.com",
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/pages/dashboard/cohortsignal/useCohortSignalController", () => ({
  useCohortSignalController: () => ({
    state: {
      loading: false,
      error: null,
      students: [
        {
          id: "student-1",
          name: "Ada Ibrahim",
          initials: "AI",
          module: "Mathematics",
          latestMark: 38,
          averageMark: 41,
          riskBand: "high",
          predictedToFail: true,
          failProbability: 88,
          trend: "declining",
          riskReasons: ["Average below 50%"],
          confidence: 91,
          suggestedAction: "Schedule a check-in to review study strategies and agree short-term goals.",
          interventionLoggedAt: null,
          missingSubmission: true,
        },
      ],
      bandReport: {
        holdoutAccuracy: 0.82,
        crossValidation: { folds: 5, accuracy: 0.76, foldAccuracies: [0.75, 0.77, 0.76, 0.78, 0.74] },
      },
      failureReport: {
        holdoutAccuracy: 0.86,
        crossValidation: { folds: 5, accuracy: 0.85, foldAccuracies: [0.84, 0.83, 0.86, 0.87, 0.85] },
        precision: 0.63,
        recall: 0.91,
        confusionMatrix: {
          truePositives: 42,
          falsePositives: 25,
          trueNegatives: 138,
          falseNegatives: 4,
        },
      },
    },
    actions: {
      logIntervention: vi.fn(),
      reload: vi.fn(),
    },
  }),
}));

describe("CohortSignal admin oversight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a read-only admin view without intervention logging", async () => {
    render(<CohortSignal />);

    expect(await screen.findByText("CohortSignal cohort heatmap")).toBeInTheDocument();
    expect(screen.getByText("Live admin oversight")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Log Intervention/i })).not.toBeInTheDocument();

    const tile = await screen.findByRole("button", { name: /Ada Ibrahim/i });
    fireEvent.click(tile);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Admin oversight is read-only/i)).toBeInTheDocument();
  });
});
