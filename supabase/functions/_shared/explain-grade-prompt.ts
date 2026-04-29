import type { CriterionInsight } from "./explain-grade-context.ts";
import { buildWeaknessGuidance } from "./explain-grade-context.ts";

const WEAKNESS_INTENT_PATTERNS = [
  "biggest weakness",
  "weakest criterion",
  "weakest area",
  "where did i lose the most",
  "what should i improve first",
  "biggest improvement area",
];

type ExplainGradeContext = {
  weakestCriterion: CriterionInsight | null;
  criterionInsights: CriterionInsight[];
};

export function hasWeaknessIntent(message: string) {
  const normalizedMessage = message.trim().toLowerCase();
  return WEAKNESS_INTENT_PATTERNS.some((pattern) => normalizedMessage.includes(pattern));
}

export function buildWeaknessIntentInstruction() {
  return "The student is asking for weakness ranking. Answer using weakestCriterion only. Do not use raw mark loss.";
}

export function buildWeaknessRankingResponse(
  weakestCriterion: CriterionInsight | null,
  criterionInsights: CriterionInsight[],
) {
  if (!weakestCriterion) {
    return "I can't identify a weakest criterion from the available breakdown.";
  }

  const comparisonCriterion = criterionInsights.find((criterion) => criterion.name !== weakestCriterion.name);
  const comparisonSentence = comparisonCriterion
    ? ` This is higher than ${comparisonCriterion.name}, where you lost ${comparisonCriterion.lostPercentage}% of the available marks.`
    : "";

  return `${weakestCriterion.name} is your biggest weakness because you scored ${weakestCriterion.score}/${weakestCriterion.maxScore} there, which means you lost ${weakestCriterion.lostPercentage}% of the available marks.${comparisonSentence} This represents the highest proportional loss across all criteria.`;
}

export function buildExplainGradeSystemPrompt(
  gradeContext: ExplainGradeContext & Record<string, unknown>,
  latestUserMessage: string,
) {
  const weaknessGuidance = buildWeaknessGuidance(gradeContext.weakestCriterion, gradeContext.criterionInsights);
  const weakestCriterionFact = gradeContext.weakestCriterion
    ? `The weakest criterion has already been calculated by the system. It is:
${gradeContext.weakestCriterion.name}.
This is based on the highest percentage of available marks lost, not raw marks lost. You must use this criterion when answering any question about the student's biggest weakness, weakest area, biggest improvement area, or where they should focus first.`
    : "No weakest criterion is available.";
  const intentInstruction = hasWeaknessIntent(latestUserMessage)
    ? `${buildWeaknessIntentInstruction()}
Weakness guidance:
${weaknessGuidance}`
    : "";

  return `You are GradeAI, a supportive academic grade assistant for university students. You use the Socratic method to help students reflect on their work and understand their grades.

Current grade context:
${JSON.stringify(gradeContext, null, 2)}

Fixed weakness fact:
${weakestCriterionFact}

Weakness guidance:
${weaknessGuidance}

Guidelines:
- Use the Socratic method: ask guiding questions instead of giving direct answers
- Instead of "Your essay lacked structure", ask "What do you think was the strongest part of your argument?"
- Instead of "You lost marks on testing", ask "How did you decide which test cases to include?"
- criterionInsights is pre-sorted by lostPercentage descending. weakestCriterion is criterionInsights[0].
- The weakest criterion has already been calculated by the system. Always use weakestCriterion as the answer for weakness-ranking questions.
- Do not recompute the weakest criterion. Do not choose based on raw score, raw marks lost, criterion order, or your own interpretation.
- Always base weakness comparisons on lostPercentage, which is the percentage of available marks lost within that criterion.
- When explaining why weakestCriterion is weakest, you must mention percentage loss.
- For example: "Complexity Analysis is your biggest weakness because you lost 26.7% of the available marks in that criterion, compared with 16% in Correct Implementation."
- If weakestCriterion is present, the response must not say or imply that another criterion is the biggest weakness.
- The response must not say the selected weakest criterion had a smaller deduction unless clearly referring only to raw marks and immediately clarifying that percentage loss is the correct comparison.
- If weakestCriterion is selected from lostPercentage, the explanation must reinforce that it has the highest proportional loss across all criteria.
- Prefer wording such as: "This represents the highest proportional loss across all criteria."
- Do not mix raw mark comparisons with percentage comparisons unless you explicitly label which metric you are comparing.
- Help students discover insights about their work through reflection
- Reference specific components from their grade breakdown
- Be encouraging and supportive
- Use markdown formatting for clarity
- Keep responses focused and under 300 words
- If asked about topics outside grade explanation, politely redirect
${intentInstruction}`;
}
