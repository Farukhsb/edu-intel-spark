import { buildResourceRecommendations, type PlanModule } from "@/lib/improvementPlan";

export const DEMO_PLAN: PlanModule[] = [
  {
    module: "CS301 - Data Structures",
    currentGrade: 61,
    targetGrade: 70,
    guidanceMode: "future",
    trend: "up",
    trendDelta: 9,
    strengths: ["Code Quality", "Tree Traversal Accuracy"],
    weaknesses: ["Complexity Analysis", "Test Coverage"],
    nextSubmissionFocus: [
      "Show time and space complexity explicitly for each major function.",
      "Add edge-case tests for empty, single-node, and unbalanced trees.",
    ],
    tasks: [
      { id: "demo-ds-1", task: "Complete Big-O analysis worksheet", area: "Complexity Analysis", done: false },
      { id: "demo-ds-2", task: "Write 5 extra edge-case tests", area: "Test Coverage", done: false },
      { id: "demo-ds-3", task: "Review lecturer feedback before next lab", area: "Feedback", done: true },
    ],
    weakCriteria: [
      { criterion: "Complexity Analysis", average: 54, attempts: 3 },
      { criterion: "Test Coverage", average: 58, attempts: 2 },
    ],
    chart: [
      { assessment: "A1", score: 54 },
      { assessment: "Quiz", score: 58 },
      { assessment: "Lab", score: 61 },
      { assessment: "A2", score: 63 },
    ],
  },
  {
    module: "CS205 - Algorithms",
    currentGrade: 66,
    targetGrade: 72,
    guidanceMode: "future",
    trend: "down",
    trendDelta: -6,
    strengths: ["Problem Framing", "Presentation"],
    weaknesses: ["Efficiency", "Dynamic Programming Structure"],
    nextSubmissionFocus: [
      "State the recurrence relation before coding the solution.",
      "Compare brute-force and optimized complexity in the write-up.",
    ],
    tasks: [
      { id: "demo-algo-1", task: "Solve 3 dynamic programming exercises", area: "Dynamic Programming Structure", done: false },
      { id: "demo-algo-2", task: "Create a complexity comparison sheet", area: "Efficiency", done: true },
    ],
    weakCriteria: [
      { criterion: "Dynamic Programming Structure", average: 59, attempts: 3 },
      { criterion: "Efficiency", average: 63, attempts: 2 },
    ],
    chart: [
      { assessment: "A1", score: 71 },
      { assessment: "Midterm", score: 68 },
      { assessment: "A2", score: 66 },
      { assessment: "Lab", score: 65 },
    ],
  },
];

export const DEMO_RESOURCES = buildResourceRecommendations(DEMO_PLAN);
