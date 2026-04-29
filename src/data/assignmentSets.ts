import type { RubricCriterion } from "@/components/RubricBuilder";
import type { AcademicIntegrityFlag } from "@/types/academic";

export type AssignmentSetSubmissionStatus =
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

export interface AssignmentSetGradeRecord {
  id: string;
  aiScore: number | null;
  aiFeedback: string | null;
  aiBreakdown: Array<{
    criterion: string;
    score: number;
    maxScore: number;
    feedback: string;
    confidenceScore: number;
    evidenceSnippet?: string | null;
    rubricExpectation?: string | null;
    improvementActions?: string[] | null;
    reviewRequired?: boolean | null;
    errorType?: "arithmetic_slip" | "conceptual_flaw" | "none";
  }>;
  assignmentType: string | null;
  gradingConfidence: number | null;
  gradingMetadata: {
    fairnessNotes?: string[];
    mathAnalysis?: {
      solverSignals?: string[];
    } | null;
  } | null;
  lecturerScore: number | null;
  lecturerFeedback: string | null;
  finalScore: number | null;
  finalFeedback: string | null;
}

export interface AssignmentSetSubmissionRecord {
  id: string;
  studentId: string | null;
  studentName: string | null;
  studentEmail: string | null;
  fileName: string;
  fileType: string | null;
  fileUrl: string;
  status: AssignmentSetSubmissionStatus;
  submittedAt: string;
  grade?: AssignmentSetGradeRecord;
}

export interface AssignmentSetTemplateRecord {
  title: string;
  moduleCode: string | null;
  description: string | null;
  maxScore: number;
  dueDate: string | null;
  status: "draft" | "published" | "closed";
  targetCohorts: string[];
  targetDepartments: string[];
  rubric: RubricCriterion[];
}

export interface AssignmentSetRecord {
  id: string;
  name: string;
  label: string;
  reviewerSummary: string;
  template: AssignmentSetTemplateRecord;
  submissions: AssignmentSetSubmissionRecord[];
  integritySummary?: string;
  integrityFlags?: AcademicIntegrityFlag[];
}

const createdAt = "2026-04-01T09:00:00.000Z";

export const SYNTHETIC_ASSIGNMENT_SETS: AssignmentSetRecord[] = [
  {
    id: "algorithms-report",
    name: "Algorithms Report Workflow",
    label: "Reviewer-ready example",
    reviewerSummary:
      "Complete workflow sample with rubric, AI-facing brief, integrity evidence, a moderation-ready case, and released feedback.",
    template: {
      title: "Comparative Analysis of Sorting Algorithm Performance",
      moduleCode: "CS301",
      description:
        "Produce a 1,500-word technical report that compares merge sort, quicksort, and heapsort using benchmark evidence from at least three input distributions. Your submission must include: a clear testing methodology, justified dataset selection, asymptotic analysis, interpretation of measured results, and a short recommendation for production use. AI grader input in this demo: the full student submission text, this assignment brief, and the rubric criteria below. Expected feedback output in this demo: criterion-level scoring, cited evidence snippets, strengths, integrity risks, and next-step improvements for lecturer review.",
      maxScore: 100,
      dueDate: null,
      status: "draft",
      targetCohorts: ["300"],
      targetDepartments: ["Computer Science"],
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
    },
    submissions: [
      {
        id: "demo-submission-1",
        studentId: "demo-student-1",
        studentName: "Amina Yusuf",
        studentEmail: "amina.yusuf@example.edu",
        fileName: "sorting-analysis-amina-yusuf.pdf",
        fileType: "application/pdf",
        fileUrl: "https://example.edu/demo/sorting-analysis-amina-yusuf.pdf",
        status: "ai_graded",
        submittedAt: "2026-04-14T10:20:00.000Z",
        grade: {
          id: "demo-grade-1",
          aiScore: 74,
          aiFeedback:
            "The report shows a sound understanding of sorting algorithm trade-offs and uses benchmark data to justify most claims. The strongest section is the interpretation of merge sort and heapsort under different input patterns. The main weakness is that the quicksort evaluation does not fully explain why pivot choice affects worst-case behaviour, so some conclusions are stronger than the evidence provided. To improve, tighten the methodology discussion, make the benchmark controls more explicit, and connect performance claims to specific dataset characteristics.",
          aiBreakdown: [
            {
              criterion: "Methodology and Experimental Design",
              score: 18,
              maxScore: 25,
              feedback: "Benchmark steps are credible, but controls for hardware noise and repeated runs are underdeveloped.",
              confidenceScore: 0.84,
              evidenceSnippet: "Each algorithm was executed five times and the average runtime was recorded.",
              rubricExpectation: "A high-scoring report should define a repeatable process and justify test conditions.",
              improvementActions: ["State how outliers were handled.", "Explain how the same input sets were reused fairly."],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Technical Analysis",
              score: 19,
              maxScore: 25,
              feedback: "The complexity discussion is mostly accurate, but the quicksort worst-case explanation is too brief.",
              confidenceScore: 0.81,
              evidenceSnippet: "Quicksort was usually faster, although it can degrade in poor pivot conditions.",
              rubricExpectation: "Students should connect theoretical complexity to observed patterns and edge cases.",
              improvementActions: ["Explain pivot sensitivity more precisely.", "Separate average-case and worst-case claims."],
              reviewRequired: true,
              errorType: "conceptual_flaw",
            },
            {
              criterion: "Use of Evidence",
              score: 15,
              maxScore: 20,
              feedback: "Tables are used well, though one claim about large random inputs needs a direct numerical reference.",
              confidenceScore: 0.87,
              evidenceSnippet: "Merge sort remained stable as the dataset increased from 10k to 100k items.",
              rubricExpectation: "Evidence should be cited directly when supporting comparative claims.",
              improvementActions: ["Quote the relevant runtime figures.", "Add a short figure commentary."],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Evaluation and Recommendation",
              score: 11,
              maxScore: 15,
              feedback: "The recommendation is sensible, but the operational context could be narrower and more realistic.",
              confidenceScore: 0.8,
              evidenceSnippet: "For production, merge sort is the safest overall choice because it behaved consistently.",
              rubricExpectation: "Recommendations should be scenario-specific and justified against trade-offs.",
              improvementActions: ["Name a concrete deployment context.", "Balance consistency against memory cost."],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Structure and Academic Writing",
              score: 11,
              maxScore: 15,
              feedback: "The report is clear overall, with minor repetition in the conclusion and limited signposting in section transitions.",
              confidenceScore: 0.9,
              evidenceSnippet: "The conclusion repeats two earlier benchmark observations almost verbatim.",
              rubricExpectation: "Writing should be concise, coherent, and professionally structured.",
              improvementActions: ["Tighten the conclusion.", "Use clearer transition sentences between sections."],
              reviewRequired: false,
              errorType: "none",
            },
          ],
          assignmentType: "technical-report",
          gradingConfidence: 0.83,
          gradingMetadata: {
            fairnessNotes: [
              "Score held within the mid-70s band because evidence supports the recommendation, but not consistently at distinction depth.",
            ],
            mathAnalysis: null,
          },
          lecturerScore: null,
          lecturerFeedback: null,
          finalScore: 74,
          finalFeedback:
            "Strong comparative analysis with credible benchmark evidence and a mostly accurate complexity discussion. Improve the explanation of quicksort edge cases, reference your benchmark numbers more directly, and make the final recommendation more scenario-specific.",
        },
      },
      {
        id: "demo-submission-2",
        studentId: "demo-student-2",
        studentName: "Daniel Okafor",
        studentEmail: "daniel.okafor@example.edu",
        fileName: "sorting-analysis-daniel-okafor.pdf",
        fileType: "application/pdf",
        fileUrl: "https://example.edu/demo/sorting-analysis-daniel-okafor.pdf",
        status: "moderation_pending",
        submittedAt: "2026-04-14T11:05:00.000Z",
        grade: {
          id: "demo-grade-2",
          aiScore: 58,
          aiFeedback:
            "The report identifies the main algorithm trade-offs, but the benchmark evidence is too thin to support the final recommendation confidently. Explanations of worst-case behaviour and memory trade-offs are present but uneven, and two performance claims need explicit numerical support.",
          aiBreakdown: [
            {
              criterion: "Methodology and Experimental Design",
              score: 12,
              maxScore: 25,
              feedback: "The testing setup is described at a high level, but the report does not control for repeated runs or system variance clearly enough.",
              confidenceScore: 0.79,
              evidenceSnippet: "The algorithms were tested on random, sorted, and reverse-sorted lists.",
              rubricExpectation: "A strong report should define repeatable benchmarking conditions and explain fairness controls.",
              improvementActions: ["Specify run counts and averaging method.", "Clarify whether the same datasets were reused across algorithms."],
              reviewRequired: true,
              errorType: "none",
            },
            {
              criterion: "Technical Analysis",
              score: 14,
              maxScore: 25,
              feedback: "Complexity concepts are mostly correct, but the explanation of recursion depth and heap operations is incomplete.",
              confidenceScore: 0.75,
              evidenceSnippet: "Heapsort uses a tree structure so it avoids some pivot problems seen in quicksort.",
              rubricExpectation: "Technical claims should be precise and linked directly to measured outcomes.",
              improvementActions: ["Explain why heapsort runtime remains bounded.", "Separate complexity claims from implementation detail."],
              reviewRequired: true,
              errorType: "conceptual_flaw",
            },
            {
              criterion: "Use of Evidence",
              score: 11,
              maxScore: 20,
              feedback: "The report includes a summary table, but several claims are not anchored to specific figures.",
              confidenceScore: 0.82,
              evidenceSnippet: "Quicksort performed best overall except when the inputs were nearly ordered.",
              rubricExpectation: "Students should support comparative claims with direct references to benchmark evidence.",
              improvementActions: ["Quote the relevant runtime values.", "Add one short commentary per figure or table."],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Evaluation and Recommendation",
              score: 10,
              maxScore: 15,
              feedback: "The recommendation is plausible, but the deployment scenario is too generic and does not weigh memory cost against consistency.",
              confidenceScore: 0.8,
              evidenceSnippet: "Merge sort is preferable because it is more stable for production systems.",
              rubricExpectation: "Recommendations should be scenario-specific and balanced against trade-offs.",
              improvementActions: ["Name a realistic production setting.", "Discuss the memory implications more clearly."],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Structure and Academic Writing",
              score: 11,
              maxScore: 15,
              feedback: "Organisation is clear enough, but topic sentences and transitions are inconsistent.",
              confidenceScore: 0.88,
              evidenceSnippet: "The conclusion introduces a new claim about cache locality without earlier support.",
              rubricExpectation: "Writing should be coherent, concise, and supported throughout.",
              improvementActions: ["Tighten paragraph openings.", "Remove unsupported claims from the conclusion."],
              reviewRequired: false,
              errorType: "none",
            },
          ],
          assignmentType: "technical-report",
          gradingConfidence: 0.79,
          gradingMetadata: {
            fairnessNotes: [
              "Marked for moderation because the borderline 2:2 profile depends on weak evidence use and one conceptual gap.",
            ],
            mathAnalysis: null,
          },
          lecturerScore: 56,
          lecturerFeedback:
            "The script shows basic understanding but needs tighter benchmarking controls and more precise use of evidence before the mark can be confirmed.",
          finalScore: 56,
          finalFeedback:
            "Borderline lower-second work. Improve the benchmarking method, anchor comparative claims to data, and explain key algorithm trade-offs more precisely.",
        },
      },
      {
        id: "demo-submission-3",
        studentId: "demo-student-3",
        studentName: "Grace Mensah",
        studentEmail: "grace.mensah@example.edu",
        fileName: "sorting-analysis-grace-mensah.pdf",
        fileType: "application/pdf",
        fileUrl: "https://example.edu/demo/sorting-analysis-grace-mensah.pdf",
        status: "released",
        submittedAt: "2026-04-14T11:40:00.000Z",
        grade: {
          id: "demo-grade-3",
          aiScore: 81,
          aiFeedback:
            "This submission is well structured, technically accurate, and uses benchmark evidence consistently. The strongest feature is the link between measured performance and algorithmic trade-offs. Minor improvements would be a sharper explanation of cache effects and a more concise conclusion.",
          aiBreakdown: [
            {
              criterion: "Methodology and Experimental Design",
              score: 21,
              maxScore: 25,
              feedback: "Benchmark conditions are clear and repeated runs are reported.",
              confidenceScore: 0.9,
              evidenceSnippet: "Each benchmark was repeated ten times and the median runtime was used to limit outlier impact.",
              rubricExpectation: "A high-scoring report should define repeatable and justified test conditions.",
              improvementActions: ["State the hardware profile more explicitly."],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Technical Analysis",
              score: 20,
              maxScore: 25,
              feedback: "Theory and results are connected well, with only minor simplification around cache behaviour.",
              confidenceScore: 0.88,
              evidenceSnippet: "Quicksort remained fastest on random inputs, but merge sort retained more stable performance when order increased.",
              rubricExpectation: "Theoretical analysis should illuminate the observed results, not sit separately from them.",
              improvementActions: ["Tighten the discussion of memory locality."],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Use of Evidence",
              score: 17,
              maxScore: 20,
              feedback: "Claims are well supported by tables and concise interpretation.",
              confidenceScore: 0.91,
              evidenceSnippet: "Runtime increased by 2.8x for heapsort between the 10k and 100k random datasets.",
              rubricExpectation: "Evidence should be cited directly and interpreted accurately.",
              improvementActions: ["Label one figure axis more clearly."],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Evaluation and Recommendation",
              score: 12,
              maxScore: 15,
              feedback: "The recommendation is realistic and balanced, though a specific operational context could strengthen it further.",
              confidenceScore: 0.86,
              evidenceSnippet: "Merge sort is preferable where stability matters more than in-place performance.",
              rubricExpectation: "Recommendations should reflect trade-offs in a concrete scenario.",
              improvementActions: ["Name a target workload or production context."],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Structure and Academic Writing",
              score: 12,
              maxScore: 15,
              feedback: "Professional presentation with minor repetition in the final paragraph.",
              confidenceScore: 0.93,
              evidenceSnippet: "The final paragraph repeats the opening recommendation in slightly different terms.",
              rubricExpectation: "Academic writing should be polished and economical.",
              improvementActions: ["Shorten the conclusion by one paragraph."],
              reviewRequired: false,
              errorType: "none",
            },
          ],
          assignmentType: "technical-report",
          gradingConfidence: 0.89,
          gradingMetadata: {
            fairnessNotes: [
              "Released example retained within the first-class band because the evidence use and methodology both meet the higher standard consistently.",
            ],
            mathAnalysis: null,
          },
          lecturerScore: 81,
          lecturerFeedback:
            "Clear, evidence-led, and technically accurate. A stronger production context would sharpen the recommendation further.",
          finalScore: 81,
          finalFeedback:
            "Very strong work with clear methodology, accurate analysis, and well-supported conclusions. To push further, narrow the recommendation to a more concrete deployment scenario.",
        },
      },
    ],
    integritySummary:
      "Synthetic integrity review: one moderate-risk overlap cluster was surfaced for lecturer review because benchmark methodology phrasing overlaps across two reports, but both remain available as sample evidence in the demo workflow.",
    integrityFlags: [
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
  },
  {
    id: "database-normalisation",
    name: "Database Design Starter",
    label: "Starter template",
    reviewerSummary:
      "Structured starter assignment showing how a lecturer can begin from a realistic brief and rubric without synthetic workflow records.",
    template: {
      title: "Database Normalisation Case Study",
      moduleCode: "CS220",
      description:
        "Redesign the provided enrolment dataset to third normal form and explain the trade-offs in your final schema. Include entity assumptions, functional dependency analysis, and a short note on implementation compromises.",
      maxScore: 80,
      dueDate: null,
      status: "draft",
      targetCohorts: ["200"],
      targetDepartments: ["Computer Science"],
      rubric: [
        {
          criterion: "Dependency Analysis",
          weight: 20,
          description: "Identifies functional dependencies clearly and justifies them against the case material.",
        },
        {
          criterion: "Schema Design",
          weight: 25,
          description: "Produces a coherent normalised schema with appropriate keys and relations.",
        },
        {
          criterion: "Trade-off Discussion",
          weight: 20,
          description: "Explains design compromises, implementation costs, and any denormalisation considerations.",
        },
        {
          criterion: "Technical Communication",
          weight: 15,
          description: "Uses clear diagrams, notation, and concise explanation throughout.",
        },
      ],
    },
    submissions: [],
  },
  {
    id: "network-security",
    name: "Security Reflection Starter",
    label: "Starter template",
    reviewerSummary:
      "Shorter reflective assignment template that shows a non-technical-report rubric structure for future reuse.",
    template: {
      title: "Network Security Incident Reflection",
      moduleCode: "CS340",
      description:
        "Write a reflective analysis of the incident timeline, root causes, response quality, and preventive controls. Your submission should identify both technical and organisational lessons learned.",
      maxScore: 60,
      dueDate: null,
      status: "draft",
      targetCohorts: ["300"],
      targetDepartments: ["Computer Science"],
      rubric: [
        {
          criterion: "Incident Reconstruction",
          weight: 15,
          description: "Explains the incident sequence accurately and identifies the critical turning points.",
        },
        {
          criterion: "Root Cause Analysis",
          weight: 20,
          description: "Connects the breach to technical and procedural failures in a defensible way.",
        },
        {
          criterion: "Quality of Reflection",
          weight: 15,
          description: "Shows critical reflection on response decisions, alternatives, and lessons learned.",
        },
        {
          criterion: "Preventive Controls",
          weight: 10,
          description: "Recommends realistic controls linked directly to the incident findings.",
        },
      ],
    },
    submissions: [],
  },
];

export const SYNTHETIC_ASSIGNMENT_SET_CREATED_AT = createdAt;

export const STARTER_ASSIGNMENT_TEMPLATES = SYNTHETIC_ASSIGNMENT_SETS.map((set) => ({
  id: set.id,
  name: set.name,
  label: set.label,
  reviewerSummary: set.reviewerSummary,
  template: set.template,
}));

export const getSyntheticAssignmentSetById = (setId: string) =>
  SYNTHETIC_ASSIGNMENT_SETS.find((set) => set.id === setId) ?? null;
