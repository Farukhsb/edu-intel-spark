import { classifyAssignmentType } from "../_shared/text-analysis.ts";
import {
  buildCriterionEvidencePackets,
  buildGradingEvidencePacket,
} from "./grading-support.ts";
import { buildSubmissionSafetyNotice } from "./guardrails.ts";
import {
  buildGradingPrompt,
  buildRegradeAnchorText,
  buildRubricCalibrationGuide,
  buildResponseSchema,
  buildSystemPrompt,
  type RubricCriterion,
} from "./prompting.ts";
import {
  buildPilotLeanGradingPrompt,
  buildPilotLeanResponseSchema,
  buildPilotLeanSystemPrompt,
  isPilotLeanGradingMode,
  PILOT_LEAN_CRITERION_EVIDENCE_MAX_CHARS,
  PILOT_LEAN_GRADING_EVIDENCE_MAX_CHARS,
} from "./pilot-grading.ts";
import type { AssignmentForGrading } from "./types.ts";
import type { ExistingGradeRecordWithMeta } from "./calibration.ts";

export type GradingPromptBundle = {
  pilotLeanMode: boolean;
  submissionSafetyNotice: string;
  promptInjectionRisk: { hasRisk: boolean; signals: string[] };
  assignmentType: string;
  isMathMode: boolean;
  systemPrompt: string;
  responseSchema: Record<string, unknown>;
  prompt: string;
  requestDiagnostics: Record<string, unknown>;
};

export function buildGradingPromptBundle({
  assignment,
  normalizedRubric,
  rubricText,
  blindedText,
  existingGrade,
  promptInjectionRisk,
}: {
  assignment: AssignmentForGrading;
  normalizedRubric: RubricCriterion[];
  rubricText: string;
  blindedText: string;
  existingGrade: ExistingGradeRecordWithMeta | null;
  promptInjectionRisk: { hasRisk: boolean; signals: string[] };
}): GradingPromptBundle {
  const pilotLeanMode = isPilotLeanGradingMode();
  const submissionSafetyNotice = buildSubmissionSafetyNotice(promptInjectionRisk.hasRisk);
  const gradingEvidencePacket = buildGradingEvidencePacket({
    submissionText: blindedText,
    rubric: normalizedRubric,
    assignmentTitle: assignment.title,
    assignmentDescription: assignment.description,
    maxChars: pilotLeanMode ? PILOT_LEAN_GRADING_EVIDENCE_MAX_CHARS : 18_000,
  });
  const criterionEvidencePackets = buildCriterionEvidencePackets({
    submissionText: blindedText,
    rubric: normalizedRubric,
    assignmentTitle: assignment.title,
    assignmentDescription: assignment.description,
    maxCharsPerCriterion: pilotLeanMode ? PILOT_LEAN_CRITERION_EVIDENCE_MAX_CHARS : 2600,
  });
  const criterionEvidenceText = criterionEvidencePackets
    .map((entry, index) =>
      `Criterion ${index + 1}: ${entry.criterion}\n${entry.packet || "No focused evidence packet could be extracted."}`)
    .join("\n\n---\n\n");
  const assignmentType = classifyAssignmentType({
    title: assignment.title,
    description: assignment.description,
    rubricText,
    fileName: null,
    text: blindedText,
  });
  const isMathMode = assignmentType === "Mathematics" || assignmentType === "Problem Solving";
  const systemPrompt = pilotLeanMode
    ? buildPilotLeanSystemPrompt({
      assignmentType,
      rubricLength: normalizedRubric.length,
      maximumScore: assignment.max_score,
    })
    : buildSystemPrompt(assignmentType, normalizedRubric.length, assignment.max_score);
  const responseSchema = pilotLeanMode
    ? buildPilotLeanResponseSchema(normalizedRubric.length, isMathMode)
    : buildResponseSchema(normalizedRubric.length, isMathMode);
  const prompt = pilotLeanMode
    ? buildPilotLeanGradingPrompt({
      assignmentType,
      assignmentTitle: assignment.title,
      assignmentDescription: assignment.description,
      maximumScore: assignment.max_score,
      rubric: normalizedRubric,
      textPreview: `${submissionSafetyNotice}\n\n${gradingEvidencePacket}`,
      criterionEvidenceText,
    })
    : buildGradingPrompt({
      assignmentType,
      assignmentTitle: assignment.title,
      assignmentDescription: assignment.description,
      moduleCode: assignment.module_code,
      maximumScore: assignment.max_score,
      rubricText,
      rubricCalibrationGuide: buildRubricCalibrationGuide(
        normalizedRubric,
        assignment.max_score,
      ),
      regradeAnchorText: buildRegradeAnchorText(existingGrade),
      textPreview: `${submissionSafetyNotice}\n\n${gradingEvidencePacket}`,
      criterionEvidenceText,
    });

  return {
    pilotLeanMode,
    submissionSafetyNotice,
    promptInjectionRisk,
    assignmentType,
    isMathMode,
    systemPrompt,
    responseSchema,
    prompt,
    requestDiagnostics: {
      pilot_lean_mode: pilotLeanMode,
      system_prompt_char_length: systemPrompt.length,
      user_prompt_char_length: prompt.length,
      response_schema_char_length: JSON.stringify(responseSchema).length,
      rubric_criterion_count: normalizedRubric.length,
      submission_evidence_char_length: gradingEvidencePacket.length,
      criterion_evidence_total_char_length: criterionEvidencePackets.reduce(
        (sum, entry) => sum + entry.packet.length,
        0,
      ),
      prompt_injection_suspected: promptInjectionRisk.hasRisk,
      prompt_injection_signals: promptInjectionRisk.signals,
    },
  };
}
