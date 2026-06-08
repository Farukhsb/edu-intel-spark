// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  buildCriterionEvidencePackets,
  buildGradingEvidencePacket,
} from "../../supabase/functions/grade-submission/evidence-packets";
import {
  blindSubmissionText,
  computeContentFingerprint,
} from "../../supabase/functions/grade-submission/submission-text";
import {
  isSupportedSubmissionFile,
  normalizeSubmissionStoragePath,
} from "../../supabase/functions/grade-submission/submission-files";
import type { RubricCriterion } from "../../supabase/functions/grade-submission/prompting";

describe("grading submission helpers", () => {
  it("redacts identity details and fingerprints content deterministically", () => {
    const blinded = blindSubmissionText({
      text: "Name: Farukhsb\nEmail: farukhsb@example.com\nThe final report is attached as Farukhsb_Report.pdf.",
      studentName: "Farukhsb",
      studentEmail: "farukhsb@example.com",
      fileName: "Farukhsb_Report.pdf",
    });

    expect(blinded).toContain("[REDACTED IDENTITY LINE]");
    expect(blinded).not.toContain("Farukhsb");
    expect(computeContentFingerprint("assignment-1", "hello")).toBe(computeContentFingerprint("assignment-1", "hello"));
    expect(computeContentFingerprint("assignment-1", "hello")).not.toBe(
      computeContentFingerprint("assignment-1", "hello world"),
    );
  });

  it("normalizes submission paths and file support checks", () => {
    expect(
      normalizeSubmissionStoragePath("https://xyz.supabase.co/storage/v1/object/public/submissions/assignment-1/file.pdf"),
    ).toBe("assignment-1/file.pdf");
    expect(normalizeSubmissionStoragePath("relative/path/file.pdf")).toBe("relative/path/file.pdf");
    expect(isSupportedSubmissionFile("report.PDF", null)).toBe(true);
    expect(isSupportedSubmissionFile("archive.zip", null)).toBe(false);
  });

  it("extracts rubric-aligned evidence packets from the middle of the submission", () => {
    const submissionText = [
      "Introduction\nThis opening text stays generic.",
      "Methodology\nThe benchmark setup compared latency, throughput, failover recovery, and replication cost.",
      "Analysis\nThe benchmark tables showed 18% lower p99 latency for partition-aware routing under burst traffic.",
      "Recommendation\nThe strongest production choice is partition-aware routing with selective quorum replication.",
    ].join("\n\n");

    const rubric: RubricCriterion[] = [
      { criterion: "Evidence use", weight: 50, description: "Use benchmark evidence." },
      { criterion: "Recommendation quality", weight: 50, description: "Recommend a production option." },
    ];

    const packet = buildGradingEvidencePacket({
      submissionText,
      rubric,
      assignmentTitle: "Distributed systems design report",
      assignmentDescription: "Compare deployment strategies using benchmark evidence.",
      maxChars: 4000,
    });
    const packets = buildCriterionEvidencePackets({
      submissionText,
      rubric,
      assignmentTitle: "Distributed systems design report",
      assignmentDescription: "Compare deployment strategies using benchmark evidence.",
      maxCharsPerCriterion: 1800,
    });

    expect(packet).toContain("benchmark tables showed 18% lower p99 latency");
    expect(packet).toContain("strongest production choice is partition-aware routing");
    expect(packets).toHaveLength(2);
    expect(packets[0].packet).toContain("benchmark tables showed 18% lower p99 latency");
    expect(packets[1].packet).toContain("strongest production choice is partition-aware routing");
  });
});
