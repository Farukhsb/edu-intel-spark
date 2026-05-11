export type SimilarityBenchmarkCase = {
  id: string;
  label: string;
  submissionA: string;
  submissionB: string;
  expected: {
    analysisLimited?: boolean;
    minScore?: number;
    maxScore?: number;
  };
  risk: "true_positive" | "false_positive_guard" | "known_gap";
  notes: string;
};

const networkIncidentBase = `
  The incident response review found that the security team detected the intrusion only after unusual outbound traffic was observed on a finance workstation.
  Investigators reconstructed a timeline showing that the attacker first obtained credentials through a phishing email, then used remote access tooling to move laterally across two internal systems.
  The report explains that containment was delayed because account lockout alerts were routed to a mailbox that was not actively monitored during the evening shift.
  Recommended improvements include enforcing phishing-resistant authentication, tightening privileged access review, centralising alert triage, and rehearsing the incident playbook with cross-team tabletop exercises.
  The conclusion states that effective recovery depends on combining technical controls with faster escalation, clearer ownership, and better documentation of security incidents.
`.replace(/\s+/g, " ").trim();

const networkIncidentCopy = `
  The incident response review found that the security team detected the intrusion only after unusual outbound traffic was observed on a finance workstation.
  Investigators reconstructed a timeline showing that the attacker first obtained credentials through a phishing email, then used remote access tooling to move laterally across two internal systems.
  The report explains that containment was delayed because account lockout alerts were routed to a mailbox that was not actively monitored during the evening shift.
  Recommended improvements include enforcing phishing-resistant authentication, tightening privileged access review, centralising alert triage, and rehearsing the incident playbook with cross-team tabletop exercises.
  The conclusion states that effective recovery depends on combining technical controls with faster escalation, clearer ownership, and better documentation of security incidents.
`.replace(/\s+/g, " ").trim();

const networkIncidentParaphrase = `
  The assignment argues that the breach was not identified until analysts noticed suspicious traffic leaving a payroll device.
  It says the attacker began with a successful phishing message, harvested login details, and then pivoted across internal machines using remote administration utilities.
  The writer claims containment took too long because high-risk account alerts were being delivered to an inbox nobody watched after normal office hours.
  The submission recommends stronger authentication, stricter privileged access oversight, unified alert handling, and repeated cross-functional incident simulations.
  It finishes by arguing that recovery from security incidents depends as much on escalation discipline and ownership clarity as on technical defences.
`.replace(/\s+/g, " ").trim();

const citationHeavyA = `
  Network security incidents require coordinated detection and response across people, process, and technology. As NIST (2024) notes, response planning should define roles clearly before an event occurs.
  Effective preparation also depends on rehearsing playbooks and ensuring logs are centralised for rapid review (Ahmad, 2023). According to ENISA (2024), communication breakdowns often prolong containment.
  In conclusion, organisations benefit when incident handling is structured, rehearsed, and supported by monitored escalation channels.
  References
  NIST. Computer Security Incident Handling Guide. 2024.
  Ahmad, S. Security Operations and Preparedness. 2023.
  ENISA. Incident Coordination Guidance. 2024.
`.replace(/\s+/g, " ").trim();

const citationHeavyB = `
  Responding to cyber incidents depends on clear roles, escalation paths, and preparation across staff and systems. NIST (2024) emphasises that incident response planning should be established before attacks occur.
  Preparedness also requires exercises, consistent logging, and clear communication between teams (Ahmad, 2023). ENISA (2024) similarly highlights that weak coordination increases containment time.
  Overall, structured rehearsal and active escalation monitoring improve incident recovery.
  References
  NIST. Computer Security Incident Handling Guide. 2024.
  Ahmad, S. Security Operations and Preparedness. 2023.
  ENISA. Incident Coordination Guidance. 2024.
`.replace(/\s+/g, " ").trim();

const unrelatedEssay = `
  Employment trends in regional logistics have shifted because warehouses are adopting data-driven scheduling and shorter inventory cycles.
  Managers now prioritise route optimisation, staff retention, and seasonal forecasting to stabilise service quality during demand spikes.
  The essay concludes that labour planning and operational analytics are more influential than legacy expansion strategies in modern distribution networks.
`.replace(/\s+/g, " ").trim();

const shortTextA = "This submission is too short to compare reliably.";
const shortTextB = "Another very short submission cannot support strong similarity analysis.";

export const INTERNAL_TEXT_SIMILARITY_BENCHMARK_CASES: SimilarityBenchmarkCase[] = [
  {
    id: "direct-copy",
    label: "Direct copy of substantive prose",
    submissionA: networkIncidentBase,
    submissionB: networkIncidentCopy,
    expected: {
      minScore: 95,
      analysisLimited: false,
    },
    risk: "true_positive",
    notes: "Exact reuse should be detected strongly by shingle overlap.",
  },
  {
    id: "paraphrase",
    label: "Heavy paraphrase of same incident narrative",
    submissionA: networkIncidentBase,
    submissionB: networkIncidentParaphrase,
    expected: {
      minScore: 10,
      maxScore: 45,
      analysisLimited: false,
    },
    risk: "known_gap",
    notes: "The hybrid detector should surface some overlap for paraphrase-heavy reuse, but this remains a known weak spot compared with true semantic models.",
  },
  {
    id: "citation-heavy",
    label: "Legitimate citation-heavy overlap",
    submissionA: citationHeavyA,
    submissionB: citationHeavyB,
    expected: {
      maxScore: 45,
      analysisLimited: false,
    },
    risk: "false_positive_guard",
    notes: "Reference reuse should not dominate the score, though the current provider does not explicitly strip citations.",
  },
  {
    id: "unrelated",
    label: "Unrelated academic content",
    submissionA: networkIncidentBase,
    submissionB: unrelatedEssay,
    expected: {
      maxScore: 10,
      analysisLimited: false,
    },
    risk: "false_positive_guard",
    notes: "Distinct topics should stay near zero.",
  },
  {
    id: "short-text",
    label: "Texts below minimum word threshold",
    submissionA: shortTextA,
    submissionB: shortTextB,
    expected: {
      analysisLimited: true,
      maxScore: 0,
    },
    risk: "false_positive_guard",
    notes: "The provider should refuse a confident comparison when content is too short.",
  },
];
