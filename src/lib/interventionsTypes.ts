import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";

export type ManualInterventionType = "email" | "meeting" | "feedback" | "referral";
export type ManualInterventionStatus = "planned" | "in_progress" | "completed" | "resolved";
export type InterventionContactTargetType =
  | "student"
  | "parent"
  | "guardian"
  | "tutor"
  | "course_leader"
  | "department_head"
  | "support_service"
  | "placement_supervisor"
  | "employer"
  | "other";
export type InterventionContactMethod = "email" | "meeting" | "phone" | "lms_message" | "sms" | "in_person" | "referral" | "other";
export type InterventionOutcome =
  | "no_response"
  | "left_message"
  | "responded"
  | "attended"
  | "referred"
  | "resolved"
  | "follow_up_scheduled"
  | "escalated"
  | "ongoing"
  | "other";

export interface InterventionEntry {
  id: string;
  createdAt: string;
  title: string;
  type: string;
  note: string;
  followUpDate: string | null;
  status: ManualInterventionStatus;
}

export interface InterventionEventEntry {
  id: string;
  interventionId: string;
  studentId: string;
  lecturerId: string;
  contactedAt: string;
  contactTargetType: InterventionContactTargetType;
  contactTargetName: string;
  contactMethod: InterventionContactMethod;
  outcome: InterventionOutcome;
  summary: string;
  nextStep: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentInterventionReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export type StudentInterventionRow = Tables<"student_interventions">;
export type StudentInterventionEventRow = Tables<"student_intervention_events">;

export interface RecommendationInterventionTarget {
  studentId: string;
  name: string;
  email: string | null;
}

export interface ManualInterventionPayloadInput {
  lecturerId: string;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  interventionType: ManualInterventionType;
  interventionStatus: ManualInterventionStatus;
  note: string;
  followUpDate: string | null;
  riskLevel?: string | null;
}

export interface StudentInterventionEventPayloadInput {
  lecturerId: string;
  studentId: string;
  interventionId: string;
  contactTargetType: InterventionContactTargetType;
  contactTargetName: string;
  contactMethod: InterventionContactMethod;
  outcome: InterventionOutcome;
  summary: string;
  nextStep?: string | null;
  contactedAt?: string;
}

export type InterventionDbClient = SupabaseClient<Database>;
export type StudentInterventionInsert = TablesInsert<"student_interventions">;
export type StudentInterventionEventInsert = TablesInsert<"student_intervention_events">;
