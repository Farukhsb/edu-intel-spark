import type { ModerationCaseView } from "@/lib/moderationWorkflow";

export const buildDemoSelectableCaseIds = ({
  bulkApprovableFilteredCases,
  bulkAssignableFilteredCases,
}: {
  bulkApprovableFilteredCases: ModerationCaseView[];
  bulkAssignableFilteredCases: ModerationCaseView[];
}) =>
  Array.from(
    new Set([
      ...bulkAssignableFilteredCases.map((item) => item.moderationCase.id),
      ...bulkApprovableFilteredCases.map((item) => item.moderationCase.id),
    ]),
  );
