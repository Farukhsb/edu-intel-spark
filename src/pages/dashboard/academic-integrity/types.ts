import type { ElementType } from "react";
import type { Tables } from "@/integrations/supabase/types";
import type { AcademicIntegrityOverviewStat, FlaggedIntegrityCase } from "@/lib/integrityQueue";

export type StoredIntegrityReview = Tables<"academic_integrity_reviews">;

export type SubmissionRow = Pick<
  Tables<"submissions">,
  "id" | "assignment_id" | "student_name" | "student_email" | "status" | "submitted_at"
>;

export type IntegrityQueueFilter = "pending" | "investigate" | "resolved";

export type IntegrityOverviewItem = AcademicIntegrityOverviewStat & {
  icon: ElementType;
};

export type IntegrityDraftState = {
  decisionDrafts: Record<string, import("@/lib/integrityReviews").IntegrityDecision>;
  noteDrafts: Record<string, string>;
};

export type IntegrityCases = FlaggedIntegrityCase[];
