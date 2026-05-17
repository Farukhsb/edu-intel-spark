import { describe, expect, it } from "vitest";
import {
  buildManualInterventionPayload,
  buildRecommendationInterventionRows,
  getStudentInterventionReadiness,
  mapInterventionRow,
  normalizeManualInterventionStatus,
  normalizeManualInterventionType,
} from "@/lib/interventions";

describe("interventions", () => {
  it("normalizes manual intervention form values safely", () => {
    expect(normalizeManualInterventionType("meeting")).toBe("meeting");
    expect(normalizeManualInterventionType("referral")).toBe("referral");
    expect(normalizeManualInterventionType("unknown")).toBe("email");

    expect(normalizeManualInterventionStatus("resolved")).toBe("resolved");
    expect(normalizeManualInterventionStatus("invalid")).toBe("ongoing");
  });

  it("builds a manual intervention payload with db-safe values", () => {
    const payload = buildManualInterventionPayload({
      lecturerId: "lecturer-1",
      studentId: "student-1",
      studentName: "Ada Student",
      studentEmail: "ada@example.edu",
      interventionType: "referral",
      interventionStatus: "ongoing",
      note: " Refer to academic support. ",
      followUpDate: "2026-04-30",
      riskLevel: "critical",
    });

    expect(payload.lecturer_id).toBe("lecturer-1");
    expect(payload.student_id).toBe("student-1");
    expect(payload.intervention_type).toBe("support_referral");
    expect(payload.status).toBe("ongoing");
    expect(payload.priority).toBe("high");
    expect(payload.notes).toBe("Refer to academic support.");
  });

  it("maps stored intervention rows to render-safe entries", () => {
    const entry = mapInterventionRow({
      id: "row-1",
      lecturer_id: "lecturer-1",
      student_id: "student-1",
      student_name: "Ada Student",
      student_email: "ada@example.edu",
      intervention_type: "support_referral",
      status: "resolved",
      priority: "high",
      title: "Referral intervention",
      notes: "Resolved after support session.",
      follow_up_date: "2026-04-30",
      assignment_id: null,
      created_at: "2026-04-21T10:00:00Z",
      updated_at: "2026-04-21T10:00:00Z",
    });

    expect(entry.type).toBe("referral");
    expect(entry.status).toBe("resolved");
    expect(entry.note).toBe("Resolved after support session.");
  });

  it("builds recommendation intervention rows for affected students", () => {
    const rows = buildRecommendationInterventionRows({
      lecturerId: "lecturer-1",
      title: "High-risk student cluster",
      summary: "A sizeable set of students need immediate check-in.",
      recommendedActions: ["Review recent submissions", "Arrange support session"],
      severity: "high",
      assignmentId: "assignment-1",
      targets: [
        { studentId: "student-1", name: "Ada Student", email: "ada@example.edu" },
        { studentId: "student-2", name: "Grace Student", email: "grace@example.edu" },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].intervention_type).toBe("check_in");
    expect(rows[0].priority).toBe("high");
    expect(rows[0].assignment_id).toBe("assignment-1");
  });

  it("derives a student intervention readiness summary from risk and follow-up state", () => {
    const readiness = getStudentInterventionReadiness({
      riskLevel: "critical",
      recommendation: "Schedule a support meeting and agree a short-term plan.",
      missedAssignmentsCount: 1,
      openInterventions: 0,
      latestIntervention: null,
    });

    expect(readiness.postureLabel).toBe("Immediate intervention position");
    expect(readiness.likelyChallenge).toBe("1 missed assignment still unresolved");
    expect(readiness.bestNextAction).toBe("Log the first intervention and send a student support alert");
  });
});
