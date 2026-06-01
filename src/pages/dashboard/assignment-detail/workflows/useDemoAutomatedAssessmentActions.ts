import type { useAutomatedAssessmentActions } from "./useAutomatedAssessmentActions";

type AutomatedAssessmentActions = ReturnType<typeof useAutomatedAssessmentActions>;

export const useDemoAutomatedAssessmentActions = (): AutomatedAssessmentActions => ({
  checkingPlagiarism: false,
  grading: false,
  gradingCount: 0,
  gradingElapsed: 0,
  handleAIGrade: async () => undefined,
  handlePlagiarismCheck: async () => undefined,
  lastGradingRunSummary: null,
  lastSubmissionRecoveryIssues: {},
  retryFailedOnly: async () => undefined,
});
