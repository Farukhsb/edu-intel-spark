// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  assessExtractionQuality,
  classifyAssignmentType,
  cleanExtractedDocumentText,
  computeBaselineDeviation,
  computeWritingProfileMetrics,
  extractReadablePdfText,
  mergeWritingProfile,
  normalizeReadableText,
} from "../../supabase/functions/_shared/text-analysis";

describe("text analysis coverage", () => {
  it("normalizes and cleans extracted text", () => {
    expect(normalizeReadableText("Line 1\r\r\n\nLine 2   text")).toBe("Line 1\n\nLine 2 text");
    expect(cleanExtractedDocumentText("obj /Page 1 0 R ReportLab\n\ntext")).toContain("ReportLab");
    expect(cleanExtractedDocumentText("obj /Page 1 0 R ReportLab\n\ntext")).not.toContain("/Page");
  });

  it("extracts readable pdf text and evaluates quality across code and pdf paths", async () => {
    const extracted = await extractReadablePdfText({
      bytes: new Uint8Array(new TextEncoder().encode("BT (Readable PDF text) Tj ET")),
    });
    expect(extracted.method).toBe("pdf_fallback");
    expect(extracted.text).toContain("Readable PDF text");

    const codeQuality = assessExtractionQuality(
      "function main() {\n  return 1;\n}\n".repeat(20),
      { fileType: "code", rawText: "function main() {\n  return 1;\n}\n".repeat(20) },
    );
    expect(codeQuality.isUsable).toBe(true);

    const pdfQuality = assessExtractionQuality(
      "ReportLab Generated PDF document 1 0 obj xref trailer startxref.".repeat(8),
      { fileType: "pdf", rawText: "%PDF-1.4 ReportLab Generated PDF document 1 0 obj xref trailer startxref." },
    );
    expect(pdfQuality.isUsable).toBe(false);
    expect(pdfQuality.suspiciousPdfArtifactCount).toBeGreaterThan(0);
  });

  it("classifies assignments across the major detection branches", () => {
    expect(classifyAssignmentType({
      title: "Mathematics proof",
      description: "Solve the equation and provide derivation",
    })).toBe("Mathematics");
    expect(classifyAssignmentType({ fileName: "solution.py" })).toBe("Code");
    expect(classifyAssignmentType({ text: "Reflective learning experience" })).toBe("Reflective");
    expect(classifyAssignmentType({ description: "Methodology, results and discussion" })).toBe("Report");
    expect(classifyAssignmentType({ description: "Scenario problem solving case study" })).toBe("Problem Solving");
    expect(classifyAssignmentType({ description: "Argumentative essay on policy" })).toBe("Essay");
    expect(classifyAssignmentType({ text: "x = y + 1" })).toBe("Mathematics");
    expect(classifyAssignmentType({ description: "Unrelated topic" })).toBe("Essay");
  });

  it("computes writing profiles, baseline deviation, and merge behaviour", () => {
    const text = [
      "Although the analysis is complex, it remains clear.",
      "However, the conclusion differs from the previous draft.",
      "Colour and behaviour indicate british spelling.",
    ].join(" ");

    const metrics = computeWritingProfileMetrics(text);
    expect(metrics.sentence_count).toBeGreaterThan(0);
    expect(metrics.error_fingerprint).toEqual(expect.arrayContaining(["british_spelling"]));
    expect(metrics.average_sentence_complexity).toBeGreaterThan(0);

    expect(computeBaselineDeviation(null, metrics)).toEqual({ score: 0, reasons: [] });

    const deviation = computeBaselineDeviation(
      {
        average_sentence_complexity: 0,
        lexile_level: 0,
        error_fingerprint: ["comma_splice_risk", "missing_cap_after_period"],
        vocabulary_breadth: 0,
        word_count: 10,
        sentence_count: 2,
        average_words_per_sentence: 5,
        sample_count: 3,
      },
      metrics,
      {
        previousAverage: 40,
        currentGrade: 90,
      },
    );
    expect(deviation.score).toBeGreaterThan(0);
    expect(deviation.reasons.length).toBeGreaterThan(0);

    const merged = mergeWritingProfile(
      {
        average_sentence_complexity: 1,
        lexile_level: 200,
        error_fingerprint: ["comma_splice_risk"],
        vocabulary_breadth: 0.3,
        word_count: 100,
        sentence_count: 10,
        average_words_per_sentence: 10,
        sample_count: 2,
      },
      metrics,
    );

    expect(merged.sample_count).toBe(3);
    expect(merged.error_fingerprint).toEqual(expect.arrayContaining(["comma_splice_risk", "british_spelling"]));
    expect(merged.word_count).toBeGreaterThan(0);
  });
});
