import type { Tables } from "@/integrations/supabase/types";

export type ModerationProfile = Tables<"profiles">;

export type ModerationBulkApprovalSummary = {
  assignmentTitle: string;
  baselineScore: number | null;
  caseId: string;
  disagreementLabel: string;
  feedbackChanged: boolean;
  moderatorScore: number | null;
  studentLabel: string;
};
