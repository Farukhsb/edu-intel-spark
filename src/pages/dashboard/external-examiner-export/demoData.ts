import type { ExternalExaminerExportRow } from "@/types/academic";

export const DEMO_EXTERNAL_EXAMINER_ASSIGNMENTS = [
  {
    id: "demo-assignment-policy-brief",
    title: "Strategic Policy Brief: Housing Affordability Interventions",
    moduleCode: "PPL502",
  },
  {
    id: "demo-assignment-ethics-review",
    title: "Research Ethics Review Memo",
    moduleCode: "SOC411",
  },
];

export const DEMO_EXTERNAL_EXAMINER_EXPORT_DATA: ExternalExaminerExportRow[] = [
  {
    studentName: "Amina Hassan",
    studentEmail: "amina.hassan@demo.gradeai.test",
    assignmentTitle: "Strategic Policy Brief: Housing Affordability Interventions",
    moduleCode: "PPL502",
    aiScore: 68,
    lecturerScore: 70,
    finalScore: 69,
    gradeSource: "lecturer_reviewed",
    aiFeedback:
      "The brief identifies the main affordability pressures clearly and uses current evidence effectively. Policy options are compared with reasonable balance, but the implementation risks need stronger quantification.",
    lecturerFeedback:
      "A well-structured brief with credible analysis. The strongest section is the evaluation of rent stabilisation trade-offs; the recommendation section should be more explicit about cost and political feasibility.",
    finalFeedback:
      "A strong policy brief that demonstrates sound judgement and use of evidence. To move into a clearer distinction range, tighten the implementation plan and support the final recommendation with sharper fiscal reasoning.",
    status: "released",
    submittedAt: "2026-04-11",
    reviewedAt: "2026-04-18",
    reviewedBy: "Dr Priya Malhotra",
    classification: "1st",
  },
  {
    studentName: "Daniel Reed",
    studentEmail: "daniel.reed@demo.gradeai.test",
    assignmentTitle: "Research Ethics Review Memo",
    moduleCode: "SOC411",
    aiScore: 61,
    lecturerScore: 63,
    finalScore: 62,
    gradeSource: "ai_graded",
    aiFeedback:
      "The memo covers informed consent, confidentiality, and participant risk appropriately. The discussion of data retention is accurate, but the mitigation plan for vulnerable participants is underdeveloped.",
    lecturerFeedback:
      "Clear and competent overall. The ethical principles are understood, but the memo would benefit from a more critical treatment of power dynamics and withdrawal procedures.",
    finalFeedback:
      "A solid upper-second response with secure coverage of core ethics issues. Further depth in participant safeguarding and procedural detail would strengthen the analysis.",
    status: "approved",
    submittedAt: "2026-04-09",
    reviewedAt: "2026-04-16",
    reviewedBy: "Dr Priya Malhotra",
    classification: "2:1",
  },
];
