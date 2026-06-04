import { z } from "npm:zod";
import { logError } from "../_shared/log.ts";
import { extractOutputText, parseJsonText } from "../_shared/openai.ts";
import { normalizeFlags as sharedNormalizeFlags } from "./flags.ts";
import type { fetchFileContent as sharedFetchFileContent } from "./extraction.ts";
import {
  preprocessSubmissionText,
  truncateText,
  type IntegrityFlag,
  type ProcessedSubmissionText,
  type SubmissionRow,
} from "./analysis.ts";

const MAX_SINGLE_TEXT_CHARS = 12000;
const MAX_MULTI_TEXT_CHARS = 3500;

const AnalysisResponseSchema = z.object({
  flags: z.array(z.unknown()).catch([]),
  summary: z.string().catch("Analysis complete"),
});

type SubmissionContent = Awaited<ReturnType<typeof sharedFetchFileContent>>;

export async function runLegacyIntegrityAnalysis(params: {
  isSingleMode: boolean;
  assignmentTitle: string;
  submissions: SubmissionRow[];
  contentMap: Map<string, SubmissionContent>;
  processedContentMap: Map<string, ProcessedSubmissionText>;
  integrityModel: string;
  requestIntegrityResponse: (body: Record<string, unknown>) => Promise<unknown>;
  warnings: string[];
}) {
  const systemPrompt = params.isSingleMode
    ? `You are an academic integrity detection assistant.

Your output is a risk indicator, never a verdict.

Assess AI-writing suspicion using multiple indicators:
- unnatural consistency
- generic phrasing
- shallow but polished analysis
- limited revision traces
- overly formulaic structure

Do not flag strong writing alone. Moderate or high risk requires multiple concerns.`
    : `You are an academic integrity analyst.

Compare submissions for suspicious similarity and independently assess AI-writing suspicion.

Rules:
- Similarity concerns must be based on substantive overlap in student-authored content.
- Ignore prompt text, boilerplate templates, file metadata, PDF artefacts, and reference sections.
- Treat properly quoted or cited material as cited overlap, not high-risk plagiarism.
- Distinguish cited overlap from uncited overlap.
- AI-writing concerns must rely on multiple indicators rather than one stylistic feature.
- Never output a verdict, only a risk indicator with evidence.`;

  const userContent: Array<Record<string, string>> = [];

  if (params.isSingleMode) {
    const sub = params.submissions[0];
    const content = params.contentMap.get(sub.id) || {
      plainText: "",
      fullText: null,
      fileType: "unsupported",
      mimeType: "application/octet-stream",
      success: false,
      extractionWarning: null,
      extractionError: "Document extraction failed.",
      extractionQuality: null,
    };
    const processed = params.processedContentMap.get(sub.id) || preprocessSubmissionText(content.plainText);
    const preview = truncateText(processed.mainBody, MAX_SINGLE_TEXT_CHARS);

    userContent.push({
      type: "input_text",
      text: `Analyse this submission for AI-writing suspicion only.

Assignment: ${params.assignmentTitle}
Student: ${sub.student_name || sub.student_email || "Anonymous"}
File: ${sub.file_name || "submission"}

Main body (reference section removed for scoring):
${preview || "No readable text could be extracted."}

Citation signals detected: ${processed.citationPatternCount}
Reference section detected: ${processed.hasReferenceSection ? "yes" : "no"}
Quoted content share: ${Math.round(processed.quoteShare * 100)}%
Extraction quality: ${processed.extractionQuality ? `${processed.extractionQuality.qualityScore}/100` : "unknown"}

Return a structured flag only if there is a genuine concern. Otherwise return no flags.`,
    });
  } else {
    const summaries = params.submissions.map((submission) => {
      const content = params.contentMap.get(submission.id) || {
        plainText: "",
        fullText: null,
        fileType: "unsupported",
        mimeType: "application/octet-stream",
        success: false,
        extractionWarning: null,
        extractionError: "Document extraction failed.",
        extractionQuality: null,
      };
      const processed = params.processedContentMap.get(submission.id) || preprocessSubmissionText(content.plainText);
      const preview = truncateText(processed.mainBody, MAX_MULTI_TEXT_CHARS);
      const studentLabel = `${submission.student_name || submission.student_email || "Anonymous"} (submission id: ${submission.id})`;
      if (!preview) {
        params.warnings.push(`No readable text extracted for ${submission.file_name || submission.id}; similarity analysis may be less reliable.`);
        return `${studentLabel}\n[no readable text extracted]`;
      }

      return `${studentLabel}
Reference section excluded: ${processed.hasReferenceSection ? "yes" : "no"}
Quoted content share: ${Math.round(processed.quoteShare * 100)}%
Citation markers detected: ${processed.citationPatternCount}
Extraction quality: ${processed.extractionQuality ? `${processed.extractionQuality.qualityScore}/100` : "unknown"}
Main body for scoring:
${preview}`;
    });

    userContent.push({
      type: "input_text",
      text: `Analyse these submissions for suspicious similarity and AI-writing indicators.

Assignment: ${params.assignmentTitle}

Submissions:
${summaries.join("\n\n---\n\n")}

Only flag real concerns. Return valid JSON only.`,
    });
  }

  let parsedFlags: IntegrityFlag[] = [];
  let summary = "Analysis complete";

  try {
    const aiData = await params.requestIntegrityResponse({
      model: params.integrityModel,
      input: [
        { role: "developer", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: userContent },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "report_integrity_results",
          schema: {
            type: "object",
            properties: {
              flags: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    student_a: { type: "string" },
                    student_b: { type: "string" },
                    submission_a_id: { type: "string" },
                    submission_b_id: { type: "string" },
                    similarity_score: { type: "number" },
                    ai_suspicion_score: { type: "number" },
                    baseline_deviation_score: { type: "number" },
                    total_risk_score: { type: "number" },
                    reason: { type: "string" },
                    evidence_summary: { type: "string" },
                    matched_excerpt: { type: "string" },
                    recommended_action: { type: "string", enum: ["clear", "review", "investigate"] },
                    integrity_type: {
                      type: "string",
                      enum: ["similarity", "ai-writing", "baseline-deviation", "mixed"],
                    },
                    severity: { type: "string", enum: ["low", "medium", "high"] },
                    overlap_analysis: {
                      type: "object",
                      properties: {
                        total_overlap: { type: "number" },
                        cited_overlap: { type: "number" },
                        uncited_overlap: { type: "number" },
                        internal_peer_overlap: { type: "number" },
                        external_source_overlap: { type: "number" },
                      },
                      required: [
                        "total_overlap",
                        "cited_overlap",
                        "uncited_overlap",
                        "internal_peer_overlap",
                        "external_source_overlap",
                      ],
                      additionalProperties: false,
                    },
                    evidence_groups: {
                      type: "object",
                      properties: {
                        uncited_matches: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              label: { type: "string" },
                              value: { type: "string" },
                              score: { type: "number" },
                            },
                            required: ["label", "value", "score"],
                            additionalProperties: false,
                          },
                        },
                        cited_matches: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              label: { type: "string" },
                              value: { type: "string" },
                              score: { type: "number" },
                            },
                            required: ["label", "value", "score"],
                            additionalProperties: false,
                          },
                        },
                        peer_matches: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              label: { type: "string" },
                              value: { type: "string" },
                              score: { type: "number" },
                            },
                            required: ["label", "value", "score"],
                            additionalProperties: false,
                          },
                        },
                        external_matches: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              label: { type: "string" },
                              value: { type: "string" },
                              score: { type: "number" },
                            },
                            required: ["label", "value", "score"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["uncited_matches", "cited_matches", "peer_matches", "external_matches"],
                      additionalProperties: false,
                    },
                  },
                  required: [
                    "student_a",
                    "student_b",
                    "submission_a_id",
                    "submission_b_id",
                    "similarity_score",
                    "ai_suspicion_score",
                    "baseline_deviation_score",
                    "total_risk_score",
                    "reason",
                    "evidence_summary",
                    "matched_excerpt",
                    "recommended_action",
                    "integrity_type",
                    "severity",
                    "overlap_analysis",
                    "evidence_groups",
                  ],
                  additionalProperties: false,
                },
              },
              summary: { type: "string" },
            },
            required: ["flags", "summary"],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });

    try {
      const parsed = AnalysisResponseSchema.parse(parseJsonText(extractOutputText(aiData)));
      parsedFlags = sharedNormalizeFlags(parsed.flags, params.submissions, params.processedContentMap);
      summary = typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : summary;
    } catch {
      parsedFlags = sharedNormalizeFlags((aiData as Record<string, unknown>)?.output?.[0]?.content?.[0]?.json?.flags, params.submissions, params.processedContentMap);
    }
  } catch (aiError) {
    params.warnings.push("AI similarity analysis was temporarily unavailable; returning baseline and persistence-safe results only.");
    logError("check-plagiarism AI analysis failed after retries", aiError);
  }

  return { parsedFlags, summary };
}
