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
    id: "ai-higher-education-essay",
    name: "AI in Higher Education Essay Workflow",
    label: "Essay / Critical Analysis example",
    reviewerSummary:
      "Complete essay workflow sample with a detailed rubric, AI-facing context, integrity evidence, a moderation-ready case, and released feedback.",
    template: {
      title: "Evaluating the Role of Artificial Intelligence in University Assessment and Student Support",
      moduleCode: "EDU401",
      description:
        "This assignment requires students to critically evaluate the use of artificial intelligence in higher education assessment and student support.\n\nStudents should write a structured essay discussing whether AI can improve assessment quality, feedback speed, academic integrity monitoring, and early identification of students who may need support. The essay should also consider the risks of relying on AI in academic settings, including bias, transparency, data privacy, fairness, over-automation, and the need for human academic judgement.\n\nThe response should include:\n1. an introduction explaining the growing use of AI in higher education\n2. a discussion of how AI could support lecturers in grading, feedback, moderation, and workload management\n3. an analysis of how AI could help identify students at risk of underperformance\n4. a critical discussion of risks such as bias, privacy, academic integrity concerns, and over-reliance on automated systems\n5. a conclusion explaining whether AI should be used as a decision-support tool or as a replacement for academic judgement",
      maxScore: 100,
      dueDate: null,
      status: "draft",
      targetCohorts: ["400"],
      targetDepartments: ["Computer Science"],
      rubric: [
        {
          criterion: "Understanding of AI in Higher Education",
          weight: 25,
          description:
            "Assesses how clearly the student explains the role of artificial intelligence in university assessment, feedback, moderation, academic integrity, and student support. Strong answers should show an accurate understanding of how AI can support academic workflows without replacing human academic judgement.",
        },
        {
          criterion: "Critical Analysis and Evaluation",
          weight: 30,
          description:
            "Assesses the depth of the student's analysis of both the benefits and risks of AI in higher education. Strong answers should consider issues such as bias, fairness, transparency, data privacy, academic integrity concerns, over-reliance on automation, and the need for lecturer oversight.",
        },
        {
          criterion: "Use of Evidence and Examples",
          weight: 20,
          description:
            "Assesses whether the student supports their argument with relevant examples, academic reasoning, and practical higher education contexts. Strong answers should go beyond general statements and explain how AI could realistically affect lecturers, students, and institutions.",
        },
        {
          criterion: "Structure, Clarity, and Academic Writing",
          weight: 15,
          description:
            "Assesses the organisation, clarity, grammar, paragraph structure, and overall academic presentation of the essay. Strong answers should have a clear introduction, logically developed body paragraphs, and a coherent conclusion.",
        },
        {
          criterion: "Conclusion and Judgement",
          weight: 10,
          description:
            "Assesses whether the student provides a clear, balanced final judgement on whether AI should be used as a decision-support tool or as a replacement for academic judgement. Strong answers should show a reasoned position rather than a one-sided opinion.",
        },
      ],
    },
    submissions: [
      {
        id: "demo-submission-1",
        studentId: "demo-student-1",
        studentName: "Amina Yusuf",
        studentEmail: "amina.yusuf@example.edu",
        fileName: "ai-assessment-support-amina-yusuf.pdf",
        fileType: "application/pdf",
        fileUrl: "https://example.edu/demo/ai-assessment-support-amina-yusuf.pdf",
        status: "ai_graded",
        submittedAt: "2026-04-14T10:20:00.000Z",
        grade: {
          id: "demo-grade-1",
          aiScore: 76,
          aiFeedback:
            "This essay explains the main educational uses of AI clearly and gives a balanced overview of assessment support, feedback speed, and student-support workflows. The strongest sections discuss lecturer workload and the value of AI as a decision-support tool. The main weakness is that the privacy and transparency risks are not analysed in enough depth, so the evaluation reads as more descriptive than critical in places.",
          aiBreakdown: [
            {
              criterion: "Understanding of AI in Higher Education",
              score: 18,
              maxScore: 25,
              feedback:
                "The essay explains assessment, feedback, moderation, and student-support use cases accurately, but the distinction between support and replacement could be sharper.",
              confidenceScore: 0.86,
              evidenceSnippet:
                "AI can support lecturers by generating first-pass feedback and highlighting patterns that may require human review.",
              rubricExpectation:
                "High-scoring work should explain how AI supports academic workflows without replacing academic judgement.",
              improvementActions: [
                "Clarify where lecturer oversight remains essential.",
                "Differentiate support automation from final academic decision making.",
              ],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Critical Analysis and Evaluation",
              score: 21,
              maxScore: 30,
              feedback:
                "Benefits and risks are both identified, but the bias, transparency, and fairness discussion needs more explicit comparison and stronger evaluation of trade-offs.",
              confidenceScore: 0.82,
              evidenceSnippet:
                "If AI systems inherit biased historical data, they may reinforce patterns that disadvantage some students.",
              rubricExpectation:
                "Strong work should evaluate benefits and risks in depth, including bias, privacy, over-reliance, and lecturer oversight.",
              improvementActions: [
                "Compare efficiency gains directly against fairness risks.",
                "Push the privacy and transparency discussion beyond listing concerns.",
              ],
              reviewRequired: true,
              errorType: "conceptual_flaw",
            },
            {
              criterion: "Use of Evidence and Examples",
              score: 15,
              maxScore: 20,
              feedback:
                "The essay uses plausible higher education examples, but several points would be stronger with more explicit institutional scenarios and clearer evidence-led reasoning.",
              confidenceScore: 0.84,
              evidenceSnippet:
                "An early-warning system could detect repeated non-submission patterns and prompt support before a student disengages fully.",
              rubricExpectation:
                "Strong work should support claims with realistic higher education examples and practical academic reasoning.",
              improvementActions: [
                "Add one concrete example of AI-supported moderation.",
                "Strengthen the early-support section with a clearer university context.",
              ],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Structure, Clarity, and Academic Writing",
              score: 12,
              maxScore: 15,
              feedback:
                "The structure is clear and readable, though some paragraphs combine multiple ideas and weaken the flow of the critical discussion.",
              confidenceScore: 0.88,
              evidenceSnippet:
                "The essay moves from grading to student support and integrity concerns within a single long paragraph.",
              rubricExpectation:
                "High-scoring essays should present a clear introduction, organised body sections, and a coherent academic style.",
              improvementActions: [
                "Split the risks discussion into shorter analytical paragraphs.",
                "Use stronger topic sentences to guide the reader.",
              ],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Conclusion and Judgement",
              score: 10,
              maxScore: 10,
              feedback:
                "The conclusion gives a clear and balanced judgement that AI should support academic judgement rather than replace it.",
              confidenceScore: 0.9,
              evidenceSnippet:
                "AI should be used to support faster and more consistent decision making, but final academic judgement must remain human-led.",
              rubricExpectation:
                "Strong conclusions should take a balanced, reasoned position on support versus replacement.",
              improvementActions: [
                "Link the final judgement more explicitly back to the fairness and oversight discussion.",
              ],
              reviewRequired: false,
              errorType: "none",
            },
          ],
          assignmentType: "essay-critical-analysis",
          gradingConfidence: 0.84,
          gradingMetadata: {
            fairnessNotes: [
              "Placed in the mid-70s because the understanding is accurate and balanced, but the risk evaluation lacks enough depth for a stronger distinction-level mark.",
            ],
            mathAnalysis: null,
          },
          lecturerScore: null,
          lecturerFeedback: null,
          finalScore: 76,
          finalFeedback:
            "A strong and balanced essay with clear understanding of how AI can support assessment and student support in higher education. To improve further, deepen the analysis of bias, privacy, and transparency, and use more specific higher education examples when evaluating risk.",
        },
      },
      {
        id: "demo-submission-2",
        studentId: "demo-student-2",
        studentName: "Daniel Okafor",
        studentEmail: "daniel.okafor@example.edu",
        fileName: "ai-assessment-support-daniel-okafor.pdf",
        fileType: "application/pdf",
        fileUrl: "https://example.edu/demo/ai-assessment-support-daniel-okafor.pdf",
        status: "moderation_pending",
        submittedAt: "2026-04-14T11:05:00.000Z",
        grade: {
          id: "demo-grade-2",
          aiScore: 61,
          aiFeedback:
            "The essay identifies practical benefits of AI for grading efficiency and student support, but the critical evaluation is underdeveloped. The response tends to describe AI as broadly helpful without examining fairness, privacy, integrity, and over-automation in enough depth to support a stronger academic judgement.",
          aiBreakdown: [
            {
              criterion: "Understanding of AI in Higher Education",
              score: 17,
              maxScore: 25,
              feedback:
                "The essay recognises the main assessment and support use cases, but some workflow descriptions are too general and do not show enough academic nuance.",
              confidenceScore: 0.79,
              evidenceSnippet:
                "AI can help lecturers by grading work faster and helping students get support earlier.",
              rubricExpectation:
                "Strong work should explain assessment, feedback, moderation, integrity, and student-support uses with academic precision.",
              improvementActions: [
                "Explain moderation and integrity support in more detail.",
                "Clarify why academic judgement still matters in each workflow.",
              ],
              reviewRequired: true,
              errorType: "none",
            },
            {
              criterion: "Critical Analysis and Evaluation",
              score: 16,
              maxScore: 30,
              feedback:
                "The essay mentions bias and privacy, but mostly as a checklist. The trade-offs between efficiency and fairness are not fully evaluated.",
              confidenceScore: 0.76,
              evidenceSnippet:
                "AI can sometimes be biased, so universities should be careful when using it.",
              rubricExpectation:
                "Strong answers should critically evaluate bias, fairness, transparency, privacy, integrity concerns, over-reliance, and oversight.",
              improvementActions: [
                "Move beyond listing risks to analysing their consequences.",
                "Explain how lecturer oversight reduces but does not eliminate risk.",
              ],
              reviewRequired: true,
              errorType: "conceptual_flaw",
            },
            {
              criterion: "Use of Evidence and Examples",
              score: 12,
              maxScore: 20,
              feedback:
                "Examples are relevant but thin. The essay would be stronger with more concrete university scenarios and clearer evidence-led explanation.",
              confidenceScore: 0.82,
              evidenceSnippet:
                "A chatbot might answer routine student questions before staff need to intervene directly.",
              rubricExpectation:
                "Strong answers should use realistic higher education examples and practical academic reasoning.",
              improvementActions: [
                "Use one example from grading and one from student support in more detail.",
                "Explain how institutions might implement the tools in practice.",
              ],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Structure, Clarity, and Academic Writing",
              score: 10,
              maxScore: 15,
              feedback:
                "The essay is readable, but the argument drifts and several paragraphs mix benefits and risks without clear signposting.",
              confidenceScore: 0.8,
              evidenceSnippet:
                "The essay shifts from feedback speed to bias concerns within one paragraph without a transition.",
              rubricExpectation:
                "Strong essays should be clearly organised and academically presented.",
              improvementActions: [
                "Separate the benefits and risks sections more clearly.",
                "Tighten paragraph structure and transitions.",
              ],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Conclusion and Judgement",
              score: 6,
              maxScore: 10,
              feedback:
                "The conclusion supports AI use, but the final judgement is not balanced enough and does not resolve the oversight question clearly.",
              confidenceScore: 0.83,
              evidenceSnippet:
                "Universities should use AI more widely because it saves time and can improve consistency.",
              rubricExpectation:
                "Strong conclusions should weigh support versus replacement and give a reasoned final judgement.",
              improvementActions: [
                "State explicitly that AI should support, not replace, academic judgement.",
                "Reconnect the conclusion to the risks you identified earlier.",
              ],
              reviewRequired: false,
              errorType: "none",
            },
          ],
          assignmentType: "essay-critical-analysis",
          gradingConfidence: 0.78,
          gradingMetadata: {
            fairnessNotes: [
              "Sent to moderation because the essay is borderline between bands and the critical evaluation of fairness and privacy is too thin to confirm the mark confidently.",
            ],
            mathAnalysis: null,
          },
          lecturerScore: 59,
          lecturerFeedback:
            "The essay shows awareness of AI uses in universities, but the risks are under-analysed and the final judgement is too one-sided. A stronger balance between efficiency and academic safeguards is needed.",
          finalScore: 59,
          finalFeedback:
            "A competent but limited critical analysis. To improve, deepen the discussion of bias, privacy, transparency, and oversight, and use more concrete higher education examples to support your judgement.",
        },
      },
      {
        id: "demo-submission-3",
        studentId: "demo-student-3",
        studentName: "Grace Mensah",
        studentEmail: "grace.mensah@example.edu",
        fileName: "ai-assessment-support-grace-mensah.pdf",
        fileType: "application/pdf",
        fileUrl: "https://example.edu/demo/ai-assessment-support-grace-mensah.pdf",
        status: "released",
        submittedAt: "2026-04-14T11:40:00.000Z",
        grade: {
          id: "demo-grade-3",
          aiScore: 84,
          aiFeedback:
            "This is a well-structured and persuasive essay with a strong balance between the opportunities and risks of AI in higher education. It explains clearly how AI can improve lecturer workflows and student support, while also maintaining a strong critical emphasis on fairness, privacy, transparency, and the need for human academic judgement.",
          aiBreakdown: [
            {
              criterion: "Understanding of AI in Higher Education",
              score: 21,
              maxScore: 25,
              feedback:
                "The essay gives a clear and accurate explanation of how AI can support assessment, feedback, moderation, integrity work, and student support.",
              confidenceScore: 0.9,
              evidenceSnippet:
                "AI can support moderation by highlighting anomalies and helping lecturers focus attention where human review is most needed.",
              rubricExpectation:
                "Strong work should explain how AI supports academic workflows without displacing human judgement.",
              improvementActions: [
                "Tighten one sentence on the boundary between support and replacement.",
              ],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Critical Analysis and Evaluation",
              score: 25,
              maxScore: 30,
              feedback:
                "The evaluation is balanced and thoughtful, with strong discussion of fairness, transparency, over-reliance, and lecturer oversight. A slightly deeper treatment of institutional accountability would strengthen it further.",
              confidenceScore: 0.89,
              evidenceSnippet:
                "If AI outputs are treated as neutral simply because they are automated, universities risk embedding bias behind a layer of procedural efficiency.",
              rubricExpectation:
                "Top answers should evaluate benefits and risks in depth and weigh them against the need for academic oversight.",
              improvementActions: ["Add one more explicit institutional accountability example."],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Use of Evidence and Examples",
              score: 17,
              maxScore: 20,
              feedback:
                "Examples are specific and realistic, especially where lecturer workload, student support, and integrity monitoring are discussed together.",
              confidenceScore: 0.91,
              evidenceSnippet:
                "An early-alert system could combine missed submissions, low engagement, and grade patterns to prompt timely pastoral or academic intervention.",
              rubricExpectation:
                "Strong work should support claims with relevant examples and realistic university contexts.",
              improvementActions: ["Add one brief example from institutional policy or governance."],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Structure, Clarity, and Academic Writing",
              score: 12,
              maxScore: 15,
              feedback:
                "The essay is clearly organised, readable, and academically presented, with only minor repetition near the end.",
              confidenceScore: 0.86,
              evidenceSnippet:
                "Each section builds logically from adoption pressures to benefits, risks, and final judgement.",
              rubricExpectation:
                "Strong essays should have clear structure, coherent paragraphing, and polished academic style.",
              improvementActions: ["Tighten the final paragraph to avoid repeating the central claim."],
              reviewRequired: false,
              errorType: "none",
            },
            {
              criterion: "Conclusion and Judgement",
              score: 9,
              maxScore: 10,
              feedback:
                "The conclusion provides a balanced and well-argued judgement that AI should support but not replace academic judgement.",
              confidenceScore: 0.93,
              evidenceSnippet:
                "AI should remain a decision-support tool, because educational judgement requires accountability, context, and ethical responsibility that automated systems cannot fully provide.",
              rubricExpectation:
                "Strong conclusions should present a reasoned judgement on support versus replacement.",
              improvementActions: ["Condense the final sentence for slightly sharper impact."],
              reviewRequired: false,
              errorType: "none",
            },
          ],
          assignmentType: "essay-critical-analysis",
          gradingConfidence: 0.89,
          gradingMetadata: {
            fairnessNotes: [
              "Released in the first-class band because the essay sustains a balanced critical argument while keeping human academic judgement central to the conclusion.",
            ],
            mathAnalysis: null,
          },
          lecturerScore: 84,
          lecturerFeedback:
            "A thoughtful and well-balanced critical essay. The strongest feature is the way the risks of bias, privacy, and over-automation are weighed against the practical gains in assessment and student support.",
          finalScore: 84,
          finalFeedback:
            "An excellent critical analysis of AI in higher education. The essay is clear, balanced, and well-argued, and it makes a persuasive case that AI should be used to support academic judgement rather than replace it. To improve further, add one slightly more developed institutional governance example.",
        },
      },
    ],
    integritySummary:
      "Synthetic integrity review: one moderate-risk overlap cluster was surfaced because two essays use very similar phrasing in the section on AI bias, transparency, and fairness safeguards. The overlap is kept as a demo evidence example for reviewer workflows.",
    integrityFlags: [
      {
        submission_a_id: "demo-submission-1",
        submission_b_id: "demo-submission-2",
        student_a: "Amina Yusuf",
        student_b: "Daniel Okafor",
        similarity_score: 43,
        ai_suspicion_score: 20,
        baseline_deviation_score: 19,
        total_risk_score: 42,
        reason:
          "Shared phrasing appears in the discussion of bias, transparency, and the limits of automated academic decision making.",
        evidence_summary:
          "The overlap is concentrated in one policy-focused paragraph rather than across the full essay, so the case remains moderate risk and suitable for lecturer review.",
        matched_excerpt:
          "AI systems may appear efficient and objective, but if their decision logic is not transparent they can reproduce bias while reducing opportunities for human challenge.",
        overlap_analysis: {
          total_overlap: 22,
          cited_overlap: 5,
          uncited_overlap: 17,
          internal_peer_overlap: 22,
          external_source_overlap: 0,
        },
        recommended_action: "review",
        integrity_type: "mixed",
        severity: "medium",
      },
    ],
  },
  {
    id: "algorithms-report",
    name: "Algorithms Report Workflow",
    label: "Reviewer-ready example",
    reviewerSummary:
      "Earlier technical-report workflow sample kept as an optional reusable example after the new AI-in-education essay.",
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
          description:
            "Defines a valid benchmarking approach, explains dataset choices, and controls variables consistently.",
        },
        {
          criterion: "Technical Analysis",
          weight: 25,
          description:
            "Explains time and space complexity accurately and connects theory to observed results.",
        },
        {
          criterion: "Use of Evidence",
          weight: 20,
          description:
            "Interprets benchmark tables or graphs carefully and uses evidence to support claims.",
        },
        {
          criterion: "Evaluation and Recommendation",
          weight: 15,
          description:
            "Identifies limitations, trade-offs, and recommends an algorithm for a realistic scenario.",
        },
        {
          criterion: "Structure and Academic Writing",
          weight: 15,
          description:
            "Presents a coherent report with clear sections, precise terminology, and professional writing.",
        },
      ],
    },
    submissions: [],
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
          description:
            "Identifies functional dependencies clearly and justifies them against the case material.",
        },
        {
          criterion: "Schema Design",
          weight: 25,
          description:
            "Produces a coherent normalised schema with appropriate keys and relations.",
        },
        {
          criterion: "Trade-off Discussion",
          weight: 20,
          description:
            "Explains design compromises, implementation costs, and any denormalisation considerations.",
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
          description:
            "Explains the incident sequence accurately and identifies the critical turning points.",
        },
        {
          criterion: "Root Cause Analysis",
          weight: 20,
          description:
            "Connects the breach to technical and procedural failures in a defensible way.",
        },
        {
          criterion: "Quality of Reflection",
          weight: 15,
          description:
            "Shows critical reflection on response decisions, alternatives, and lessons learned.",
        },
        {
          criterion: "Preventive Controls",
          weight: 10,
          description:
            "Recommends realistic controls linked directly to the incident findings.",
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
