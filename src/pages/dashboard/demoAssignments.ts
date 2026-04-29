import type { RubricCriterion } from "@/components/RubricBuilder";

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

const now = new Date().toISOString();

export const DEMO_ASSIGNMENTS: DemoAssignmentRecord[] = [
  {
    id: "demo-1",
    title: "Comparative Analysis of Sorting Algorithm Performance",
    description:
      "Produce a 1,500-word technical report that compares merge sort, quicksort, and heapsort using benchmark evidence from at least three input distributions. Your submission must include: a clear testing methodology, justified dataset selection, asymptotic analysis, interpretation of measured results, and a short recommendation for production use. AI grader input in this demo: the full student submission text, this assignment brief, and the rubric criteria below. Expected feedback output in this demo: criterion-level scoring, cited evidence snippets, strengths, risks, and next-step improvements.",
    module_code: "CS301",
    lecturer_id: "demo-lecturer",
    max_score: 100,
    due_date: null,
    status: "draft",
    created_at: now,
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
    created_at: now,
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
    created_at: now,
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
      submitted_at: now,
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
};

export const getDemoAssignmentById = (assignmentId: string) =>
  DEMO_ASSIGNMENTS.find((assignment) => assignment.id === assignmentId) ?? null;
