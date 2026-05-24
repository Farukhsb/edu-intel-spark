import { describe, expect, it } from "vitest";

import {
  buildCriterionEvidencePackets,
  buildGradingEvidencePacket,
} from "../../supabase/functions/grade-submission/grading-support";

describe("grading evidence packet", () => {
  it("pulls rubric-aligned evidence from across the submission instead of only the opening text", () => {
    const submissionText = [
      "Introduction\nThis report introduces a distributed systems design and outlines the scope of the analysis without yet giving the benchmark evidence or recommendation.",
      "Background\nThe service uses asynchronous workers, replicated queues, and eventual consistency. This section explains architecture context only.",
      "Methodology\nBenchmark setup compared latency, throughput, failover recovery, and replication cost across three deployment strategies in controlled load tests.",
      "Analysis\nMeasured results showed that quorum replication reduced stale reads, while partition-aware routing lowered tail latency under burst traffic.",
      "Evidence and trade-offs\nThe benchmark tables showed 18% lower p99 latency for partition-aware routing, but replication cost increased under failure recovery windows.",
      "Recommendation\nFor production use, the strongest option is partition-aware routing with selective quorum replication because it balances latency, resilience, and operating cost better than the alternatives.",
    ].join("\n\n");

    const packet = buildGradingEvidencePacket({
      submissionText,
      rubric: [
        {
          criterion: "Evidence and benchmark use",
          weight: 50,
          description: "Use benchmark evidence to justify trade-off evaluation.",
        },
        {
          criterion: "Recommendation quality",
          weight: 50,
          description: "Provide a justified production recommendation.",
        },
      ],
      assignmentTitle: "Distributed systems design report",
      assignmentDescription: "Compare deployment strategies using benchmark evidence and recommend one for production use.",
      maxChars: 4000,
    });

    expect(packet).toContain("OPENING SECTION:");
    expect(packet).toContain("RUBRIC-ALIGNED EXCERPT");
    expect(packet).toContain("benchmark tables showed 18% lower p99 latency");
    expect(packet).toContain("strongest option is partition-aware routing with selective quorum replication");
    expect(packet.length).toBeLessThanOrEqual(4000);
  });

  it("builds different focused evidence packets for different rubric criteria", () => {
    const submissionText = [
      "Design discussion\nThe architecture balances consistency, latency, and recovery complexity across multiple deployment strategies.",
      "Benchmark evidence\nThe benchmark tables showed 18% lower p99 latency for partition-aware routing under burst traffic.",
      "Recommendation\nThe strongest production choice is partition-aware routing with selective quorum replication because the operational cost remained acceptable while failover stayed reliable.",
    ].join("\n\n");

    const packets = buildCriterionEvidencePackets({
      submissionText,
      rubric: [
        {
          criterion: "Evidence and benchmark use",
          weight: 50,
          description: "Use benchmark evidence to justify trade-off evaluation.",
        },
        {
          criterion: "Recommendation quality",
          weight: 50,
          description: "Provide a justified production recommendation.",
        },
      ],
      assignmentTitle: "Distributed systems design report",
      assignmentDescription: "Compare deployment strategies using benchmark evidence and recommend one for production use.",
      maxCharsPerCriterion: 1800,
    });

    expect(packets).toHaveLength(2);
    expect(packets[0].criterion).toBe("Evidence and benchmark use");
    expect(packets[0].packet).toContain("benchmark tables showed 18% lower p99 latency");
    expect(packets[1].criterion).toBe("Recommendation quality");
    expect(packets[1].packet).toContain("strongest production choice is partition-aware routing");
  });
});
