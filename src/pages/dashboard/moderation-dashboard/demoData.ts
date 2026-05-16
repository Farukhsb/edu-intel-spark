import type { Tables } from "@/integrations/supabase/types";
import type {
  GradeAuditRow,
  ModerationCaseView,
  ModerationReviewRow,
} from "@/lib/moderationWorkflow";

type Profile = Tables<"profiles">;

export const DEMO_LECTURERS = [
  {
    id: "demo-lecturer",
    full_name: "Dr. Demo Lecturer",
    email: "demo@gradeai.com",
    role: "lecturer",
  },
  {
    id: "demo-moderator",
    full_name: "Prof. Maya Chen",
    email: "maya.chen@demo.gradeai.test",
    role: "lecturer",
  },
] as unknown as Profile[];

export const DEMO_MODERATION_CASES = [
  {
    moderationCase: {
      id: "demo-moderation-case-1",
      submission_id: "demo-submission-1",
      assignment_id: "demo-assignment-policy-brief",
      grade_id: "demo-grade-1",
      lecturer_id: "demo-lecturer",
      first_marker_id: "demo-lecturer",
      moderator_id: "demo-moderator",
      status: "moderation_pending",
      trigger_flags: ["score_variance", "boundary_score"],
      trigger_summary: "AI and lecturer scores diverged near a classification boundary.",
      confidence_score: 0.64,
      integrity_risk_score: 18,
      ai_score_snapshot: 68,
      first_marker_score: 71,
      moderator_score: null,
      final_agreed_score: null,
      final_agreed_feedback: null,
      moderated_at: null,
      approved_at: null,
    },
    submission: {
      id: "demo-submission-1",
      student_name: "Amina Hassan",
      student_email: "amina.hassan@demo.gradeai.test",
      submitted_at: "2026-04-11T09:00:00.000Z",
      status: "moderation_pending",
    },
    grade: {
      id: "demo-grade-1",
      ai_score: 68,
      ai_feedback: "Strong evidence use, but the policy implementation section needs tighter evaluation.",
      lecturer_score: 71,
      lecturer_feedback: "Very good policy analysis with room to sharpen feasibility costing.",
      final_score: null,
      final_feedback: null,
      grading_confidence: 0.64,
      grading_metadata: null,
      ai_breakdown: null,
    },
    assignment: {
      id: "demo-assignment-policy-brief",
      title: "Strategic Policy Brief: Housing Affordability Interventions",
      max_score: 100,
    },
    firstMarker: DEMO_LECTURERS[0],
    moderator: DEMO_LECTURERS[1],
    integrityReview: null,
    reviews: [],
    auditLog: [],
  },
  {
    moderationCase: {
      id: "demo-moderation-case-2",
      submission_id: "demo-submission-2",
      assignment_id: "demo-assignment-ethics-review",
      grade_id: "demo-grade-2",
      lecturer_id: "demo-lecturer",
      first_marker_id: "demo-lecturer",
      moderator_id: "demo-moderator",
      status: "moderated",
      trigger_flags: ["integrity_risk"],
      trigger_summary: "Moderation retained because the integrity review required an independent second look.",
      confidence_score: 0.78,
      integrity_risk_score: 61,
      ai_score_snapshot: 61,
      first_marker_score: 63,
      moderator_score: 62,
      final_agreed_score: 62,
      final_agreed_feedback:
        "A solid upper-second response with clear ethics coverage and moderate scope for deeper critical analysis.",
      moderated_at: "2026-04-16T10:00:00.000Z",
      approved_at: null,
    },
    submission: {
      id: "demo-submission-2",
      student_name: "Daniel Reed",
      student_email: "daniel.reed@demo.gradeai.test",
      submitted_at: "2026-04-09T14:30:00.000Z",
      status: "moderated",
    },
    grade: {
      id: "demo-grade-2",
      ai_score: 61,
      ai_feedback: "Competent ethical analysis with limited depth on participant safeguarding.",
      lecturer_score: 63,
      lecturer_feedback:
        "Clear structure and secure knowledge, though the withdrawal procedure discussion could be stronger.",
      final_score: 62,
      final_feedback:
        "A secure upper-second piece with a clear line of argument and moderate room for deeper evaluative detail.",
      grading_confidence: 0.78,
      grading_metadata: null,
      ai_breakdown: null,
    },
    assignment: {
      id: "demo-assignment-ethics-review",
      title: "Research Ethics Review Memo",
      max_score: 100,
    },
    firstMarker: DEMO_LECTURERS[0],
    moderator: DEMO_LECTURERS[1],
    integrityReview: {
      decision: "investigate",
      lecturer_note:
        "Reviewed in demo moderation flow due to concentrated overlap in cited methods language.",
      updated_at: "2026-04-15T09:30:00.000Z",
    },
    reviews: [
      {
        id: "demo-review-1",
        moderation_case_id: "demo-moderation-case-2",
        submission_id: "demo-submission-2",
        reviewer_role: "moderator",
        action: "agree",
        proposed_score: 62,
        proposed_feedback:
          "A secure upper-second piece with a clear line of argument and moderate room for deeper evaluative detail.",
        notes:
          "Moderator agreed a slight downward adjustment from the first marker after reviewing the evidence.",
        created_at: "2026-04-16T10:00:00.000Z",
      },
    ],
    auditLog: [
      {
        id: "demo-audit-1",
        event_type: "moderation_agree",
        reason: "Demo moderation audit entry",
        created_at: "2026-04-16T10:00:00.000Z",
      },
    ],
  },
] as unknown as ModerationCaseView[];

export const buildDemoModeratorDrafts = (cases: ModerationCaseView[]) =>
  Object.fromEntries(
    cases.map((item) => [item.moderationCase.id, item.moderationCase.moderator_id || "unassigned"]),
  );

export const createDemoModerationReview = (entry: {
  id: string;
  moderation_case_id: string;
  submission_id: string;
  reviewer_role: string;
  action: string;
  proposed_score: number | null;
  proposed_feedback: string | null;
  notes: string | null;
  created_at: string;
}): ModerationReviewRow => ({
  ...entry,
  reviewer_id: "demo-reviewer",
  snapshot: {},
});

export const createDemoGradeAuditLog = (entry: {
  id: string;
  event_type: string;
  reason: string | null;
  created_at: string;
  submission_id: string;
}): GradeAuditRow => ({
  ...entry,
  actor_role: "lecturer",
  changed_by: "demo-lecturer",
  grade_id: null,
  moderation_case_id: null,
  new_values: {},
  previous_values: {},
});
