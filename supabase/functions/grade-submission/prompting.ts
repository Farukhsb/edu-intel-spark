import { createResponse, extractOutputText, parseJsonText } from "../_shared/openai.ts";
import { safeParseGradeAIResponse, type GradeAIResponse } from "../_shared/grade-ai-response.ts";
import type { AssignmentType } from "../_shared/text-analysis.ts";

export type RubricCriterion = {
  criterion: string;
  weight: number;
  description?: string;
};

export type ExistingGradeRecord = {
  ai_score: number | null;
  ai_feedback: string | null;
  ai_breakdown: unknown;
};

function buildDomainSpecificRubricExemplars(rubric: RubricCriterion[]) {
  const rubricText = rubric
    .map((criterion) => `${criterion.criterion} ${criterion.description ?? ""}`)
    .join(" ")
    .toLowerCase();

  const isNormalizationTask =
    rubricText.includes("functional depend") ||
    rubricText.includes("normalisation") ||
    rubricText.includes("normalization") ||
    rubricText.includes("integrity constraint") ||
    rubricText.includes("trade-off") ||
    rubricText.includes("trade off");

  if (!isNormalizationTask) return "";

  return `DATABASE NORMALISATION EXEMPLARS:
- Strong concise functional dependency analysis can still deserve Good or better. Example: "student_id determines student_name and programme_id; module_id determines module_title and credits; delivery_id determines lecturer_id and semester." If those dependencies are correct and tied to the schema, treat that as strong evidence rather than penalising brevity.
- Good key and integrity reasoning does not need long prose. Example: "Student uses student_id as the primary key, Enrolment uses a surrogate enrolment_id plus a unique constraint on student_id + delivery_id, and foreign keys from Enrolment to Student and Delivery preserve integrity." If that structure is correct, mark it in the Good band rather than capping it for brevity.
- Brief but correct trade-off justification can still deserve strong marks. Example: "Delivery stays separate from Module because staffing changes by run, which avoids update anomalies but adds joins when reporting." If the trade-off is defensible and relevant, reward it even if only one or two sentences.
- Do not require textbook wording. If the schema logic, keys, and trade-off rationale are correct in plain language, award the marks for correctness rather than penalising short wording.
- Distinguish missing detail from wrong logic. A concise but correct normalization answer belongs in Good or Satisfactory depending on completeness; reserve Basic or Weak for incorrect, missing, or incoherent schema reasoning.`;
}

export function buildAssignmentTypeStrategy(assignmentType: AssignmentType) {
  switch (assignmentType) {
    case "Code":
      return `ASSIGNMENT-TYPE STRATEGY: CODE
- Judge functional correctness, completeness against the stated task, and whether the implementation or explanation actually matches the requirement.
- Prioritise algorithm choice, data handling, edge cases, and whether the submission would plausibly work as described.
- Reward clean structure and justified design decisions only when the underlying solution is correct enough to deserve them.
- Do not over-reward comments, formatting, or fluent explanation when the logic is weak or incomplete.
- If the submission mixes prose and code, use the criterion-specific evidence packets to keep technical correctness separate from explanation quality.`;
    case "Reflective":
      return `ASSIGNMENT-TYPE STRATEGY: REFLECTIVE
- Judge specificity, authenticity, self-awareness, and application of learning rather than polished generic prose.
- Reward concrete examples, explicit reflection on decisions, and clear links between experience and learning outcomes.
- Penalise generic reflection that sounds fluent but remains vague, unpersonalised, or unsupported by specific experience.
- Do not confuse emotional tone or fluent style with depth of reflection.`;
    case "Report":
      return `ASSIGNMENT-TYPE STRATEGY: REPORT
- Judge structure, methodology, evidence use, analysis, and recommendation quality.
- Reward clear use of findings, comparison of options, and justified professional conclusions.
- Distinguish description from analysis: a well-written summary without evaluation should not receive high analytical marks.
- Give more weight to whether claims are supported by evidence than to surface polish alone.`;
    case "Problem Solving":
      return `ASSIGNMENT-TYPE STRATEGY: PROBLEM SOLVING
- Judge whether the submission addresses the problem directly, applies the correct method, and shows enough working to justify the result.
- Reward coherent stepwise reasoning and partial progress when it is genuinely relevant.
- Distinguish a minor slip from a wrong method or missing reasoning.
- Do not reward a correct-looking final answer if the working is absent, contradictory, or unsupported.`;
    case "Mathematics":
      return `ASSIGNMENT-TYPE STRATEGY: MATHEMATICS
- Judge derivation validity, symbolic correctness, carry-forward logic, and whether each step follows from the previous one.
- Reward mathematically valid progress even when arithmetic slips occur later.
- Distinguish arithmetic slips from conceptual flaws.
- Do not judge mathematical quality mainly by prose fluency.`;
    case "Essay":
    default:
      return `ASSIGNMENT-TYPE STRATEGY: ESSAY
- Judge argument quality, relevance, evidence use, conceptual understanding, and whether claims are defended rather than merely stated.
- Reward clear thesis development, engagement with competing ideas where relevant, and supported interpretation.
- Distinguish descriptive summary from analysis: descriptive but accurate prose should not receive high analytical marks.
- Do not over-reward style if the argument, evidence, or conceptual depth is weak.`;
  }
}

export function buildRegradeAnchorText(existingGrade: ExistingGradeRecord | null | undefined) {
  if (!existingGrade || existingGrade.ai_score == null) return "";
  const previousBreakdown = Array.isArray(existingGrade.ai_breakdown) ? existingGrade.ai_breakdown : [];
  return `

PRIOR STORED AI GRADE (use as a consistency anchor, not a hard constraint):
- Previous AI score: ${existingGrade.ai_score}
- Previous AI feedback: ${existingGrade.ai_feedback || "N/A"}
- Previous criterion breakdown:
${JSON.stringify(previousBreakdown, null, 2)}

If your new judgement differs materially from the prior score, only do so when the rubric evidence strongly requires it.`;
}

export function buildRubricCalibrationGuide(rubric: RubricCriterion[], maxScore: number) {
  const criterionLines = rubric.map((criterion, index) =>
    `${index + 1}. ${criterion.criterion} (${criterion.weight}/${maxScore})` +
    `${criterion.description ? ` -> ${criterion.description}` : ""}`
  );
  const domainSpecificExemplars = buildDomainSpecificRubricExemplars(rubric);

  return `RUBRIC-FIRST CALIBRATION GUIDE:
- Use the rubric wording as the primary basis for marking. Do not introduce hidden expectations.
- Award marks because the submission satisfies the stated rubric criterion, not because it resembles an ideal answer.
- Concise but correct answers can still deserve high marks when they identify the right method, the right structure, and the right justification.
- Do not require exhaustive textbook-style explanation before awarding upper-band marks if the core reasoning and evidence are already correct.
- If the rubric is broad, mark according to the quality of the evidence actually shown.
- Do not collapse competent work into the 40s just because it lacks distinction-level depth.
- If work meets the main requirements of a broad criterion, it will normally sit in the 50s.
- If work meets all core requirements with correct methods and reasonable interpretation, it will normally sit in the 60s.
- 70+ requires strong depth, strong evidence, and clear analytical insight.
- 70+ does not require long prose. If a submission is concise but clearly correct, well-structured, and explicitly justified, award strong marks rather than capping it for brevity alone.
- For criteria like keys, integrity constraints, and design trade-offs, award high marks when the submission states the correct relationships or rationale clearly, even if every implication is not expanded at length.
- If unsure between two adjacent bands, lower confidence and recommend lecturer review rather than forcing the lower band.

${domainSpecificExemplars ? `${domainSpecificExemplars}

` : ""}Criterion guide:
${criterionLines.join("\n")}`;
}

export function buildGradingPrompt({
  assignmentType,
  assignmentTitle,
  assignmentDescription,
  moduleCode,
  maximumScore,
  rubricText,
  rubricCalibrationGuide,
  regradeAnchorText,
  textPreview,
  criterionEvidenceText,
}: {
  assignmentType: AssignmentType;
  assignmentTitle: string;
  assignmentDescription: string | null | undefined;
  moduleCode: string | null | undefined;
  maximumScore: number;
  rubricText: string;
  rubricCalibrationGuide: string;
  regradeAnchorText: string;
  textPreview: string;
  criterionEvidenceText?: string;
}) {
  return `AssignmentType: ${assignmentType}

Assignment title: ${assignmentTitle}
Assignment description: ${assignmentDescription || "N/A"}
Module: ${moduleCode || "N/A"}
Maximum score: ${maximumScore}

Rubric:
${rubricText}

${rubricCalibrationGuide}

${buildAssignmentTypeStrategy(assignmentType)}

Evaluate criterion-by-criterion. Do not award a score unless supported by the submission evidence.
If evidence is weak or ambiguous, reduce confidence and require lecturer review.
For a single broad 100-mark criterion, use UK university bands:
- 70+: excellent distinction-level work
- 60-69: good work with reasonable methods and interpretation
- 50-59: competent work meeting the main requirements
- 40-49: only a basic partial attempt
- below 40: major omissions, off-topic, unreadable, or little relevant evidence
Do not assign the 40s to competent work that addresses the task and meets the main requirements unless several important elements are weak or missing.
${regradeAnchorText}
Submission text:
${textPreview}

${criterionEvidenceText ? `Criterion-specific evidence packets:
${criterionEvidenceText}

Use the criterion-specific packets as your primary evidence map. If a criterion packet contains weak or limited evidence, lower confidence for that criterion rather than borrowing evidence from another criterion.` : ""}

Return valid JSON only.`;
}

export function buildPositiveFeedbackReevaluationPrompt({
  prompt,
  passResult,
  maximumScore,
}: {
  prompt: string;
  passResult: GradeAIResponse;
  maximumScore: number;
}) {
  return `${prompt}

Your previous grading output was internally inconsistent: the feedback was broadly positive but the total score was below 40% of the maximum.

Previous JSON:
${JSON.stringify(passResult)}

Re-evaluate the rubric faithfully. If the evidence supports only a fail-range score, rewrite the feedback so it clearly explains failure against the rubric. Otherwise correct the criterion scores into a fair band. Return corrected JSON only.`;
}

export async function requestStructuredGrade({
  gradingModel,
  systemPrompt,
  prompt,
  rubricLength,
  isMathMode,
  responseSchema,
}: {
  gradingModel: string;
  systemPrompt: string;
  prompt: string;
  rubricLength: number;
  isMathMode: boolean;
  responseSchema?: Record<string, unknown>;
}) {
  let aiData: Awaited<ReturnType<typeof createResponse>>;
  try {
    aiData = await createResponse({
      model: gradingModel,
      temperature: 0,
      top_p: 1,
      input: [
        { role: "developer", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: prompt }] },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "submit_grade",
          schema: responseSchema ?? buildResponseSchema(rubricLength, isMathMode),
          strict: true,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && /aborted|timeout/i.test(error.message)) {
      throw new Error("AI provider request timed out.");
    }

    throw new Error(`AI provider request failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  try {
    const parsed = safeParseGradeAIResponse(parseJsonText(extractOutputText(aiData)));
    if (parsed.success) {
      return parsed.data;
    }
    throw new Error("AI provider returned an invalid or incomplete JSON response.");
  } catch {
    const parsed = safeParseGradeAIResponse(aiData?.output?.[0]?.content?.[0]?.json ?? aiData?.output_parsed ?? null);
    if (parsed.success) {
      return parsed.data;
    }
    throw new Error("AI provider returned an invalid or incomplete JSON response.");
  }
}

export function buildSystemPrompt(assignmentType: AssignmentType, rubricLength: number, maxScore: number) {
  const baseRules = `You are an academic marking assistant for higher education.

Your role is to apply the rubric exactly and produce fair, consistent, evidence-based marks.

You are NOT a strict examiner and NOT a generous tutor.
You are a fair, rubric-faithful marker.

CORE RULE:
The rubric defines what good work is. You must not introduce hidden criteria.

MARKING PROCESS (MANDATORY):

For EACH rubric criterion:

1. Read the criterion and its max_score.
2. Identify specific evidence from the submission relevant to that criterion.
3. If no relevant evidence is found, state that clearly.
4. Choose a performance band based ONLY on the evidence.
5. Assign a score within that criterion's max_score.
6. Explain the reason for the score using the evidence.
7. Assign a confidence score using the calibration table below.

PERFORMANCE BANDS:
Percentages refer to the proportion of the criterion's own max_score.

- Excellent (85â€“100%): strong, clear, well-developed evidence fully meeting the criterion
- Good (70â€“84%): clear evidence with minor gaps or limited depth
- Satisfactory (55â€“69%): meets basic requirement but lacks depth or consistency
- Basic (40â€“54%): some relevant evidence but weak or incomplete
- Weak (20â€“39%): very limited relevant evidence
- No evidence (0â€“19%): little or no relevant evidence

UPPER-BAND CALIBRATION:

- A concise answer can still be Good or Excellent if it is correct, relevant, and directly satisfies the criterion.
- Do not cap a strong answer at Satisfactory purely because it is brief.
- If the student correctly identifies the right decomposition, the right keys or integrity relationships, or the right practical trade-off, reward that substance even when the explanation is compact.
- Use lack of detail to separate Excellent from Good, or Good from Satisfactory. Do not use brevity alone to push clearly correct work into Basic.

EMPTY OR OFF-TOPIC SUBMISSIONS:
If a criterion has no addressable submission content, meaning blank, gibberish, unreadable, or entirely off-topic, set awarded_score to 0, performance_band to "No evidence", and explain clearly in reason_for_score.

CALIBRATION OVERRIDES:

- Treat lack of depth alone as a Satisfactory-level limitation, not a Basic-level failure.
- If work meets all core requirements, applies required techniques correctly, and provides a logical interpretation, default to at least the Satisfactory band.
- If work is concise but clearly correct on the criterion, default to at least the Good band unless important rubric elements are genuinely missing.
- When the submission names the correct keys, foreign-key structure, or trade-off rationale in a defensible way, do not mark it down simply for not elaborating every implication.
- Reserve the Basic band for cases where multiple required elements are weak or missing, or understanding is clearly limited.

FAIRNESS RULES (CRITICAL):

- If the student clearly addresses the criterion, DO NOT assign a near-zero or fail score.
- If the student meets core requirements, the score must not fall below the Basic or Satisfactory band.
- If the student meets all core requirements, applies required techniques correctly, and provides a logical interpretation, the score must not fall below the Satisfactory band.
- If the student meets the criterion correctly and succinctly, the score should normally sit in the Good band unless there is a specific missing element required by the rubric.
- Lack of depth alone should reduce a Good score to Satisfactory, not to Basic.
- Use partial credit fairly when there is some correct or relevant work.
- Do NOT over-penalise grammar, structure, or formatting unless the rubric explicitly assesses writing quality.
- Do NOT reward fluent writing if required analysis or evidence is weak.
- Do NOT assume work that is not shown.
- Do NOT invent evidence.

CONSISTENCY RULES:

- Feedback must match the score.
- If feedback is positive, for example "clear", "relevant", or "meets requirement", the score must not be in the fail range.
- If feedback says the work is coherent, correct, clear, or shows a defensible design choice, the score should not remain in a low mid-band without a specific rubric-based reason.
- If score is below 40%, you must clearly explain why the work fails to meet the criterion.
- If unsure, reduce confidence instead of reducing score.
- When describing off-topic or non-responsive work, prefer the phrase "assignment instruction" instead of "assignment prompt" or "assignment brief".

SCORING RULES:

- Score each criterion out of its own max_score, not out of 100 unless that criterion's max_score is 100.
- Final score must equal the exact sum of all criterion awarded_scores.
- Do NOT apply hidden scaling or normalisation.

CONFIDENCE CALIBRATION:
Assign a confidence_score to each criterion and to the overall result using these anchors:

- 0.90 or above: criterion is unambiguous, evidence is clear, and evidence maps directly to a band
- 0.70 to 0.89: minor interpretation required, but score is well-supported
- 0.50 to 0.69: criterion is vague, evidence is partial, or submission is ambiguous. Reduce score only if clearly justified by evidence
- Below 0.50: serious uncertainty. Flag for lecturer review

LECTURER REVIEW TRIGGERS:
Set lecturer_review_required to true if ANY of the following apply:

- Overall confidence_score is below 0.65
- Total score falls within 3 marks of a grade boundary
- Any single criterion confidence_score is below 0.50
- The submission raises academic integrity concerns, such as inconsistent voice, implausible sophistication, or suspected AI generation
- Score-feedback mismatch is detected
- Any criterion score had to be recalibrated

OUTPUT FORMAT (STRICT):

Return JSON only. No preamble, no explanation outside the JSON.

{
  "criteria": [
    {
      "criterion_name": "...",
      "max_score": 20,
      "awarded_score": 14,
      "performance_band": "Good",
      "evidence_from_submission": ["..."],
      "reason_for_score": "...",
      "strengths": ["..."],
      "weaknesses": ["..."],
      "improvement_feedback": "...",
      "confidence_score": 0.82
    }
  ],
  "total_score": 72,
  "overall_feedback": "...",
  "main_strengths": ["..."],
  "main_weaknesses": ["..."],
  "confidence_score": 0.80,
  "lecturer_review_required": false
}

FINAL CHECK (MANDATORY BEFORE OUTPUT):

- Does each score reflect the band percentages applied to that criterion's max_score?
- Does feedback tone match the score?
- Are any scores unfairly low given the evidence?
- Does total_score equal the exact sum of all awarded_scores?
- Do any lecturer review triggers apply? If yes, set lecturer_review_required to true.
- If any inconsistency is found, correct it before returning.

Return exactly ${rubricLength} criterion rows in the same order as the rubric.
The evidence_from_submission must quote or closely excerpt the student's submission, not the rubric.
If the rubric wording is vague, apply a reasonable academic interpretation, lower confidence, and recommend lecturer review.
Be neither harsh nor generous. Be rubric-faithful.
Output valid JSON only.`;

  if (assignmentType === "Mathematics" || assignmentType === "Problem Solving") {
    return `${baseRules}

You are in MATHEMATICS / LOGIC-CHECKER mode.

Maths-specific rules:
- Prioritise symbolic correctness, derivation validity, and whether each step follows from the previous one.
- Distinguish arithmetic slips from conceptual flaws.
- Apply carry-forward credit for arithmetic slips when later reasoning remains coherent.
- Flag solver-like behaviour when there are impossible leaps, notation mismatches, or correct final answers without adequate working.
- Include a math_analysis object with:
  - symbolic_extraction: array of key expressions or equations you identified
  - derivation_checks: array of step checks with step_label, status, rationale
  - error_classification: arithmetic_slip | conceptual_flaw | none
  - solver_signals: array of suspicious solver-signature observations
- For each criterion, set error_type to arithmetic_slip, conceptual_flaw, or none.
- Do not judge mathematical work mainly by prose style.
- Final score is out of ${maxScore}.`;
  }

  return `${baseRules}

You are in ${assignmentType.toUpperCase()} mode.
- Final score is out of ${maxScore}.`;
}

export function buildResponseSchema(rubricLength: number, includeMathAnalysis: boolean) {
  const schema: Record<string, unknown> = {
    type: "object",
    properties: {
      assignment_type: { type: "string" },
      total_score: { type: "number" },
      overall_feedback: { type: "string" },
      main_strengths: { type: "array", items: { type: "string" } },
      main_weaknesses: { type: "array", items: { type: "string" } },
      confidence_score: { type: "number" },
      lecturer_review_required: { type: "boolean" },
      criteria: {
        type: "array",
        minItems: rubricLength,
        maxItems: rubricLength,
        items: {
          type: "object",
          properties: {
            criterion_name: { type: "string" },
            awarded_score: { type: "number" },
            max_score: { type: "number" },
            performance_band: { type: "string" },
            evidence_from_submission: { type: "array", items: { type: "string" } },
            reason_for_score: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            weaknesses: { type: "array", items: { type: "string" } },
            improvement_feedback: { type: "string" },
            confidence_score: { type: "number" },
            error_type: {
              type: "string",
              enum: ["arithmetic_slip", "conceptual_flaw", "none"],
            },
          },
          required: [
            "criterion_name",
            "awarded_score",
            "max_score",
            "performance_band",
            "evidence_from_submission",
            "reason_for_score",
            "strengths",
            "weaknesses",
            "improvement_feedback",
            "confidence_score",
            "error_type",
          ],
          additionalProperties: false,
        },
      },
    },
    required: [
      "assignment_type",
      "total_score",
      "overall_feedback",
      "main_strengths",
      "main_weaknesses",
      "confidence_score",
      "lecturer_review_required",
      "criteria",
    ],
    additionalProperties: false,
  };

  if (includeMathAnalysis) {
    (schema.properties as Record<string, unknown>).math_analysis = {
      type: "object",
      properties: {
        symbolic_extraction: { type: "array", items: { type: "string" } },
        derivation_checks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              step_label: { type: "string" },
              status: { type: "string", enum: ["valid", "unclear", "invalid"] },
              rationale: { type: "string" },
            },
            required: ["step_label", "status", "rationale"],
            additionalProperties: false,
          },
        },
        error_classification: {
          type: "string",
          enum: ["arithmetic_slip", "conceptual_flaw", "none"],
        },
        solver_signals: { type: "array", items: { type: "string" } },
      },
      required: ["symbolic_extraction", "derivation_checks", "error_classification", "solver_signals"],
      additionalProperties: false,
    };
    (schema.required as string[]).push("math_analysis");
  }

  return schema;
}
