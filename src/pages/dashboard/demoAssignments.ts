import type { RubricCriterion } from "@/components/RubricBuilder";
import type { AcademicIntegrityFlag } from "@/types/academic";

export interface DemoAssignmentRecord {
  id: string;
  title: string;
  description: string | null;
  module_code: string | null;
  lecturer_id: string;
  max_score: number;
  due_date: string | null;
  status: "draft" | "published" | "closed";
  created_at: string;
  rubric: RubricCriterion[];
  cohorts: string[];
  departments: string[];
  target_cohorts: string[];
  target_departments: string[];
}

export interface DemoAssignmentSubmissionRecord {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  file_name: string;
  file_type: string | null;
  file_url: string;
  status:
    | "submitted"
    | "ai_grading"
    | "ai_graded"
    | "first_review"
    | "moderation_pending"
    | "moderation_in_progress"
    | "moderated"
    | "escalated"
    | "under_review"
    | "approved"
    | "released";
  submitted_at: string;
}

export interface DemoAssignmentGradeRecord {
  id: string;
  submission_id: string;
  ai_score: number | null;
  ai_feedback: string | null;
  ai_breakdown: Array<{
    criterion: string;
    score: number;
    max_score: number;
    feedback: string;
    confidence_score: number;
    evidence_snippet?: string | null;
    rubric_expectation?: string | null;
    improvement_actions?: string[] | null;
    review_required?: boolean | null;
    error_type?: "arithmetic_slip" | "conceptual_flaw" | "none";
  }>;
  assignment_type: string | null;
  grading_confidence: number | null;
  grading_metadata: {
    fairness_notes?: string[];
    math_analysis?: {
      solver_signals?: string[];
    } | null;
  } | null;
  lecturer_score: number | null;
  lecturer_feedback: string | null;
  final_score: number | null;
  final_feedback: string | null;
}

const createdAt = "2026-04-01T09:00:00.000Z";

export const DEMO_ASSIGNMENTS: DemoAssignmentRecord[] = [
  {
    id: "demo-1",
    title: "Comparative Analysis of Sorting Algorithm Performance",
    description:
      "Produce a 1,500-word technical report that compares merge sort, quicksort, and heapsort using benchmark evidence from at least three input distributions. Your submission must include: a clear testing methodology, justified dataset selection, asymptotic analysis, interpretation of measured results, and a short recommendation for production use. AI grader input in this demo: the full student submission text, this assignment brief, and the rubric criteria below. Expected feedback output in this demo: criterion-level scoring, cited evidence snippets, strengths, integrity risks, and next-step improvements for lecturer review.",
    module_code: "CS301",
    lecturer_id: "demo-lecturer",
    max_score: 100,
    due_date: null,
    status: "draft",
    created_at: createdAt,
    rubric: [
      {
        criterion: "Methodology and Experimental Design",
        weight: 25,
        description: "Defines a valid benchmarking approach, explains dataset choices, and controls variables consistently.",
      },
      {
        criterion: "Technical Analysis",
        weight: 25,
        description: "Explains time and space complexity accurately and connects theory to observed results.",
      },
      {
        criterion: "Use of Evidence",
        weight: 20,
        description: "Interprets benchmark tables or graphs carefully and uses evidence to support claims.",
      },
      {
        criterion: "Evaluation and Recommendation",
        weight: 15,
        description: "Identifies limitations, trade-offs, and recommends an algorithm for a realistic scenario.",
      },
      {
        criterion: "Structure and Academic Writing",
        weight: 15,
        description: "Presents a coherent report with clear sections, precise terminology, and professional writing.",
      },
    ],
    cohorts: [],
    departments: [],
    target_cohorts: [],
    target_departments: [],
  },
  {
    id: "demo-2",
    title: "Database Normalisation Case Study",
    description:
      "Redesign the provided enrolment dataset to third normal form and explain the trade-offs in your final schema.",
    module_code: "CS220",
    lecturer_id: "demo-lecturer",
    max_score: 80,
    due_date: null,
    status: "draft",
    created_at: createdAt,
    rubric: [],
    cohorts: [],
    departments: [],
    target_cohorts: [],
    target_departments: [],
  },
  {
    id: "demo-3",
    title: "Network Security Incident Reflection",
    description:
      "Write a reflective analysis of the incident timeline, root causes, response quality, and preventive controls.",
    module_code: "CS340",
    lecturer_id: "demo-lecturer",
    max_score: 60,
    due_date: null,
    status: "draft",
    created_at: createdAt,
    rubric: [],
    cohorts: [],
    departments: [],
    target_cohorts: [],
    target_departments: [],
  },
];

export const DEMO_ASSIGNMENT_SUBMISSIONS: Record<string, DemoAssignmentSubmissionRecord[]> = {
  "demo-1": [
    {
      id: "demo-submission-1",
      assignment_id: "demo-1",
      student_id: "demo-student-1",
      student_name: "Amina Yusuf",
      student_email: "amina.yusuf@example.edu",
      file_name: "sorting-analysis-amina-yusuf.pdf",
      file_type: "application/pdf",
      file_url: "https://example.edu/demo/sorting-analysis-amina-yusuf.pdf",
      status: "ai_graded",
      submitted_at: "2026-04-14T10:20:00.000Z",
    },
    {
      id: "demo-submission-2",
      assignment_id: "demo-1",
      student_id: "demo-student-2",
      student_name: "Daniel Okafor",
      student_email: "daniel.okafor@example.edu",
      file_name: "sorting-analysis-daniel-okafor.pdf",
      file_type: "application/pdf",
      file_url: "https://example.edu/demo/sorting-analysis-daniel-okafor.pdf",
      status: "moderation_pending",
      submitted_at: "2026-04-14T11:05:00.000Z",
    },
    {
      id: "demo-submission-3",
      assignment_id: "demo-1",
      student_id: "demo-student-3",
      student_name: "Grace Mensah",
      student_email: "grace.mensah@example.edu",
      file_name: "sorting-analysis-grace-mensah.pdf",
      file_type: "application/pdf",
      file_url: "https://example.edu/demo/sorting-analysis-grace-mensah.pdf",
      status: "released",
      submitted_at: "2026-04-14T11:40:00.000Z",
    },
  ],
};

export const DEMO_ASSIGNMENT_GRADES: Record<string, DemoAssignmentGradeRecord> = {
  "demo-submission-1": {
    id: "demo-grade-1",
    submission_id: "demo-submission-1",
    ai_score: 74,
    ai_feedback:
      "The report shows a sound understanding of sorting algorithm trade-offs and uses benchmark data to justify most claims. The strongest section is the interpretation of merge sort and heapsort under different input patterns. The main weakness is that the quicksort evaluation does not fully explain why pivot choice affects worst-case behaviour, so some conclusions are stronger than the evidence provided. To improve, tighten the methodology discussion, make the benchmark controls more explicit, and connect performance claims to specific dataset characteristics.",
    ai_breakdown: [
      {
        criterion: "Methodology and Experimental Design",
        score: 18,
        max_score: 25,
        feedback: "Benchmark steps are credible, but controls for hardware noise and repeated runs are underdeveloped.",
        confidence_score: 0.84,
        evidence_snippet: "Each algorithm was executed five times and the average runtime was recorded.",
        rubric_expectation: "A high-scoring report should define a repeatable process and justify test conditions.",
        improvement_actions: ["State how outliers were handled.", "Explain how the same input sets were reused fairly."],
        review_required: false,
        error_type: "none",
      },
      {
        criterion: "Technical Analysis",
        score: 19,
        max_score: 25,
        feedback: "The complexity discussion is mostly accurate, but the quicksort worst-case explanation is too brief.",
        confidence_score: 0.81,
        evidence_snippet: "Quicksort was usually faster, although it can degrade in poor pivot conditions.",
        rubric_expectation: "Students should connect theoretical complexity to observed patterns and edge cases.",
        improvement_actions: ["Explain pivot sensitivity more precisely.", "Separate average-case and worst-case claims."],
        review_required: true,
        error_type: "conceptual_flaw",
      },
      {
        criterion: "Use of Evidence",
        score: 15,
        max_score: 20,
        feedback: "Tables are used well, though one claim about large random inputs needs a direct numerical reference.",
        confidence_score: 0.87,
        evidence_snippet: "Merge sort remained stable as the dataset increased from 10k to 100k items.",
        rubric_expectation: "Evidence should be cited directly when supporting comparative claims.",
        improvement_actions: ["Quote the relevant runtime figures.", "Add a short figure commentary."],
        review_required: false,
        error_type: "none",
      },
      {
        criterion: "Evaluation and Recommendation",
        score: 11,
        max_score: 15,
        feedback: "The recommendation is sensible, but the operational context could be narrower and more realistic.",
        confidence_score: 0.8,
        evidence_snippet: "For production, merge sort is the safest overall choice because it behaved consistently.",
        rubric_expectation: "Recommendations should be scenario-specific and justified against trade-offs.",
        improvement_actions: ["Name a concrete deployment context.", "Balance consistency against memory cost."],
        review_required: false,
        error_type: "none",
      },
      {
        criterion: "Structure and Academic Writing",
        score: 11,
        max_score: 15,
        feedback: "The report is clear overall, with minor repetition in the conclusion and limited signposting in section transitions.",
        confidence_score: 0.9,
        evidence_snippet: "The conclusion repeats two earlier benchmark observations almost verbatim.",
        rubric_expectation: "Writing should be concise, coherent, and professionally structured.",
        improvement_actions: ["Tighten the conclusion.", "Use clearer transition sentences between sections."],
        review_required: false,
        error_type: "none",
      },
    ],
    assignment_type: "technical-report",
    grading_confidence: 0.83,
    grading_metadata: {
      fairness_notes: [
        "Score held within the mid-70s band because evidence supports the recommendation, but not consistently at distinction depth.",
      ],
      math_analysis: null,
    },
    lecturer_score: null,
    lecturer_feedback: null,
    final_score: 74,
    final_feedback:
      "Strong comparative analysis with credible benchmark evidence and a mostly accurate complexity discussion. Improve the explanation of quicksort edge cases, reference your benchmark numbers more directly, and make the final recommendation more scenario-specific.",
  },
  "demo-submission-2": {
    id: "demo-grade-2",
    submission_id: "demo-submission-2",
    ai_score: 58,
    ai_feedback:
      "The report identifies the main algorithm trade-offs, but the benchmark evidence is too thin to support the final recommendation confidently. Explanations of worst-case behaviour and memory trade-offs are present but uneven, and two performance claims need explicit numerical support.",
    ai_breakdown: [
      {
        criterion: "Methodology and Experimental Design",
        score: 12,
        max_score: 25,
        feedback: "The testing setup is described at a high level, but the report does not control for repeated runs or system variance clearly enough.",
        confidence_score: 0.79,
        evidence_snippet: "The algorithms were tested on random, sorted, and reverse-sorted lists.",
        rubric_expectation: "A strong report should define repeatable benchmarking conditions and explain fairness controls.",
        improvement_actions: ["Specify run counts and averaging method.", "Clarify whether the same datasets were reused across algorithms."],
        review_required: true,
        error_type: "none",
      },
      {
        criterion: "Technical Analysis",
        score: 14,
        max_score: 25,
        feedback: "Complexity concepts are mostly correct, but the explanation of recursion depth and heap operations is incomplete.",
        confidence_score: 0.75,
        evidence_snippet: "Heapsort uses a tree structure so it avoids some pivot problems seen in quicksort.",
        rubric_expectation: "Technical claims should be precise and linked directly to measured outcomes.",
        improvement_actions: ["Explain why heapsort runtime remains bounded.", "Separate complexity claims from implementation detail."],
        review_required: true,
        error_type: "conceptual_flaw",
      },
      {
        criterion: "Use of Evidence",
        score: 11,
        max_score: 20,
        feedback: "The report includes a summary table, but several claims are not anchored to specific figures.",
        confidence_score: 0.82,
        evidence_snippet: "Quicksort performed best overall except when the inputs were nearly ordered.",
        rubric_expectation: "Students should support comparative claims with direct references to benchmark evidence.",
        improvement_actions: ["Quote the relevant runtime values.", "Add one short commentary per figure or table."],
        review_required: false,
        error_type: "none",
      },
      {
        criterion: "Evaluation and Recommendation",
        score: 10,
        max_score: 15,
        feedback: "The recommendation is plausible, but the deployment scenario is too generic and does not weigh memory cost against consistency.",
        confidence_score: 0.8,
        evidence_snippet: "Merge sort is preferable because it is more stable for production systems.",
        rubric_expectation: "Recommendations should be scenario-specific and balanced against trade-offs.",
        improvement_actions: ["Name a realistic production setting.", "Discuss the memory implications more clearly."],
        review_required: false,
        error_type: "none",
      },
      {
        criterion: "Structure and Academic Writing",
        score: 11,
        max_score: 15,
        feedback: "Organisation is clear enough, but topic sentences and transitions are inconsistent.",
        confidence_score: 0.88,
        evidence_snippet: "The conclusion introduces a new claim about cache locality without earlier support.",
        rubric_expectation: "Writing should be coherent, concise, and supported throughout.",
        improvement_actions: ["Tighten paragraph openings.", "Remove unsupported claims from the conclusion."],
        review_required: false,
        error_type: "none",
      },
    ],
    assignment_type: "technical-report",
    grading_confidence: 0.79,
    grading_metadata: {
      fairness_notes: [
        "Marked for moderation because the borderline 2:2 profile depends on weak evidence use and one conceptual gap.",
      ],
      math_analysis: null,
    },
    lecturer_score: 56,
    lecturer_feedback:
      "The script shows basic understanding but needs tighter benchmarking controls and more precise use of evidence before the mark can be confirmed.",
    final_score: 56,
    final_feedback:
      "Borderline lower-second work. Improve the benchmarking method, anchor comparative claims to data, and explain key algorithm trade-offs more precisely.",
  },
  "demo-submission-3": {
    id: "demo-grade-3",
    submission_id: "demo-submission-3",
    ai_score: 81,
    ai_feedback:
      "This submission is well structured, technically accurate, and uses benchmark evidence consistently. The strongest feature is the link between measured performance and algorithmic trade-offs. Minor improvements would be a sharper explanation of cache effects and a more concise conclusion.",
    ai_breakdown: [
      {
        criterion: "Methodology and Experimental Design",
        score: 21,
        max_score: 25,
        feedback: "Benchmark conditions are clear and repeated runs are reported.",
        confidence_score: 0.9,
        evidence_snippet: "Each benchmark was repeated ten times and the median runtime was used to limit outlier impact.",
        rubric_expectation: "A high-scoring report should define repeatable and justified test conditions.",
        improvement_actions: ["State the hardware profile more explicitly."],
        review_required: false,
        error_type: "none",
      },
      {
        criterion: "Technical Analysis",
        score: 20,
        max_score: 25,
        feedback: "Theory and results are connected well, with only minor simplification around cache behaviour.",
        confidence_score: 0.88,
        evidence_snippet: "Quicksort remained fastest on random inputs, but merge sort retained more stable performance when order increased.",
        rubric_expectation: "Theoretical analysis should illuminate the observed results, not sit separately from them.",
        improvement_actions: ["Tighten the discussion of memory locality."],
        review_required: false,
        error_type: "none",
      },
      {
        criterion: "Use of Evidence",
        score: 17,
        max_score: 20,
        feedback: "Claims are well supported by tables and concise interpretation.",
        confidence_score: 0.91,
        evidence_snippet: "Runtime increased by 2.8x for heapsort between the 10k and 100k random datasets.",
        rubric_expectation: "Evidence should be cited directly and interpreted accurately.",
        improvement_actions: ["Label one figure axis more clearly."],
        review_required: false,
        error_type: "none",
      },
      {
        criterion: "Evaluation and Recommendation",
        score: 12,
        max_score: 15,
        feedback: "The recommendation is realistic and balanced, though a specific operational context could strengthen it further.",
        confidence_score: 0.86,
        evidence_snippet: "Merge sort is preferable where stability matters more than in-place performance.",
        rubric_expectation: "Recommendations should reflect trade-offs in a concrete scenario.",
        improvement_actions: ["Name a target workload or production context."],
        review_required: false,
        error_type: "none",
      },
      {
        criterion: "Structure and Academic Writing",
        score: 12,
        max_score: 15,
        feedback: "Professional presentation with minor repetition in the final paragraph.",
        confidence_score: 0.93,
        evidence_snippet: "The final paragraph repeats the opening recommendation in slightly different terms.",
        rubric_expectation: "Academic writing should be polished and economical.",
        improvement_actions: ["Shorten the conclusion by one paragraph."],
        review_required: false,
        error_type: "none",
      },
    ],
    assignment_type: "technical-report",
    grading_confidence: 0.89,
    grading_metadata: {
      fairness_notes: [
        "Released example retained within the first-class band because the evidence use and methodology both meet the higher standard consistently.",
      ],
      math_analysis: null,
    },
    lecturer_score: 81,
    lecturer_feedback:
      "Clear, evidence-led, and technically accurate. A stronger production context would sharpen the recommendation further.",
    final_score: 81,
    final_feedback:
      "Very strong work with clear methodology, accurate analysis, and well-supported conclusions. To push further, narrow the recommendation to a more concrete deployment scenario.",
  },
};

export const DEMO_ASSIGNMENT_INTEGRITY_SUMMARIES: Record<string, string> = {
  "demo-1":
    "Synthetic integrity review: one moderate-risk overlap cluster was surfaced for lecturer review because benchmark methodology phrasing overlaps across two reports, but both remain available as sample evidence in the demo workflow.",
};

export const DEMO_ASSIGNMENT_INTEGRITY_FLAGS: Record<string, AcademicIntegrityFlag[]> = {
  "demo-1": [
    {
      submission_a_id: "demo-submission-1",
      submission_b_id: "demo-submission-2",
      student_a: "Amina Yusuf",
      student_b: "Daniel Okafor",
      similarity_score: 46,
      ai_suspicion_score: 18,
      baseline_deviation_score: 22,
      total_risk_score: 44,
      reason: "Shared methodology phrasing and uncited overlap in the benchmark setup paragraphs.",
      evidence_summary: "The overlap is concentrated in the testing-method section rather than the comparative analysis itself.",
      matched_excerpt: "Each algorithm was run on random, sorted, and reverse-sorted datasets before the average execution time was compared.",
      overlap_analysis: {
        total_overlap: 24,
        cited_overlap: 6,
        uncited_overlap: 18,
        internal_peer_overlap: 24,
        external_source_overlap: 0,
      },
      recommended_action: "review",
      integrity_type: "mixed",
      severity: "medium",
    },
  ],
};

export const getDemoAssignmentById = (assignmentId: string) =>
  DEMO_ASSIGNMENTS.find((assignment) => assignment.id === assignmentId) ?? null;
