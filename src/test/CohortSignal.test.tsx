import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import CohortSignal from "@/pages/dashboard/CohortSignal";

const createAuthState = (role: "lecturer" | "admin" | "student" = "lecturer") => ({
  profile: {
    id: `${role}-1`,
    full_name: `${role === "admin" ? "Admin" : role === "student" ? "Student" : "Lecturer"} User`,
    email: `${role}@example.com`,
    role,
  },
  user: {
    id: `${role}-1`,
    email: `${role}@example.com`,
  },
});

const createControllerState = () => ({
  loading: false,
  error: null as string | null,
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
      riskReasons: ["Average below 50%", "Steep grade decline"],
      confidence: 91,
      suggestedAction: "Schedule a check-in to review study strategies and agree short-term goals.",
      interventionLoggedAt: null,
      missingSubmission: true,
    },
    {
      id: "student-2",
      name: "Ben Carter",
      initials: "BC",
      module: "Mathematics",
      latestMark: 72,
      averageMark: 70,
      riskBand: "low",
      predictedToFail: false,
      failProbability: 11,
      trend: "steady",
      riskReasons: ["Baseline monitoring"],
      confidence: 84,
      suggestedAction: "Schedule a check-in to review study strategies and agree short-term goals.",
      interventionLoggedAt: "2026-06-03T10:00:00.000Z",
      missingSubmission: false,
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
});

const mocks = vi.hoisted(() => ({
  authState: {
    profile: {
      id: "lecturer-1",
      full_name: "Lecturer User",
      email: "lecturer@example.com",
      role: "lecturer",
    },
    user: {
      id: "lecturer-1",
      email: "lecturer@example.com",
    },
  },
  controllerState: {
    loading: false,
    error: null as string | null,
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
        riskReasons: ["Average below 50%", "Steep grade decline"],
        confidence: 91,
        suggestedAction: "Schedule a check-in to review study strategies and agree short-term goals.",
        interventionLoggedAt: null,
        missingSubmission: true,
      },
      {
        id: "student-2",
        name: "Ben Carter",
        initials: "BC",
        module: "Mathematics",
        latestMark: 72,
        averageMark: 70,
        riskBand: "low",
        predictedToFail: false,
        failProbability: 11,
        trend: "steady",
        riskReasons: ["Baseline monitoring"],
        confidence: 84,
        suggestedAction: "Schedule a check-in to review study strategies and agree short-term goals.",
        interventionLoggedAt: "2026-06-03T10:00:00.000Z",
        missingSubmission: false,
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
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

const logIntervention = vi.fn(async () => "2026-06-09T10:00:00.000Z");
const reload = vi.fn();

vi.mock("@/pages/dashboard/cohortsignal/useCohortSignalController", () => ({
  useCohortSignalController: () => ({
    state: mocks.controllerState,
    actions: {
      logIntervention,
      reload,
    },
  }),
}));

describe("CohortSignal", () => {
  beforeEach(() => {
    logIntervention.mockClear();
    reload.mockClear();
    mocks.authState = createAuthState("lecturer");
    mocks.controllerState = createControllerState();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the live summary cards", async () => {
    render(<CohortSignal />);

    expect(await screen.findByText("CohortSignal cohort heatmap")).toBeInTheDocument();
    expect(screen.getByTestId("summary-total-students")).toHaveTextContent("2");
    expect(screen.getByTestId("summary-high-risk")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-medium-risk")).toHaveTextContent("0");
    expect(screen.getByTestId("summary-low-risk")).toHaveTextContent("1");
    expect(screen.getByText("Live lecturer system")).toBeInTheDocument();
  });

  it("shows a loading state", () => {
    mocks.controllerState = {
      ...createControllerState(),
      loading: true,
      error: null,
    };

    render(<CohortSignal />);

    expect(screen.getByText("Loading CohortSignal")).toBeInTheDocument();
  });

  it("shows an error state", () => {
    mocks.controllerState = {
      ...createControllerState(),
      loading: false,
      error: "The CohortSignal live view could not be loaded right now.",
    };

    render(<CohortSignal />);

    expect(screen.getByText("CohortSignal unavailable")).toBeInTheDocument();
    expect(screen.getByText("The CohortSignal live view could not be loaded right now.")).toBeInTheDocument();
  });

  it("blocks unauthorized users", () => {
    mocks.authState = createAuthState("student");

    render(<CohortSignal />);

    expect(screen.getByText("CohortSignal access required")).toBeInTheDocument();
  });

  it("opens the student detail panel and logs an intervention", async () => {
    render(<CohortSignal />);

    const tile = await screen.findByRole("button", { name: /Ada Ibrahim/i });
    fireEvent.click(tile);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Ada Ibrahim")).toBeInTheDocument();
    expect(within(dialog).getByText("Failure prediction")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: /Log Intervention/i }));
    });

    expect(logIntervention).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "student-1",
        name: "Ada Ibrahim",
      }),
    );
  });

  it("shows the intervention marker for live students", async () => {
    render(<CohortSignal />);

    const tile = await screen.findByRole("button", { name: /Ben Carter/i });
    expect(within(tile).getByText("Intervention logged")).toBeInTheDocument();
  });
});
