import { describe, expect, it } from "vitest";
import {
  buildManualInterventionPayload,
  buildRecommendationInterventionRows,
  buildStudentInterventionEventPayload,
  fetchStudentInterventionEvents,
  fetchStudentInterventions,
  insertRecommendationInterventions,
  formatManualInterventionStatus,
  formatInterventionContactMethod,
  formatInterventionContactTargetType,
  formatInterventionOutcome,
  getStudentInterventionReadiness,
  isInterventionOverdue,
  mapInterventionRow,
  mapInterventionEventRow,
  normalizeManualInterventionStatus,
  normalizeManualInterventionType,
  normalizeInterventionContactMethod,
  normalizeInterventionContactTargetType,
  normalizeInterventionOutcome,
} from "@/lib/interventions";

describe("interventions", () => {
  it("normalizes manual intervention form values safely", () => {
    expect(normalizeManualInterventionType("meeting")).toBe("meeting");
    expect(normalizeManualInterventionType("referral")).toBe("referral");
    expect(normalizeManualInterventionType("unknown")).toBe("email");

    expect(normalizeManualInterventionStatus("ongoing")).toBe("in_progress");
    expect(normalizeManualInterventionStatus("resolved")).toBe("resolved");
    expect(normalizeManualInterventionStatus("invalid")).toBe("planned");
    expect(formatManualInterventionStatus("in_progress")).toBe("Ongoing");
  });

  it("builds a manual intervention payload with db-safe values", () => {
    const payload = buildManualInterventionPayload({
      lecturerId: "lecturer-1",
      studentId: "student-1",
      studentName: "Ada Student",
      studentEmail: "ada@example.edu",
      interventionType: "referral",
      interventionStatus: "in_progress",
      note: " Refer to academic support. ",
      followUpDate: "2026-04-30",
      riskLevel: "critical",
    });

    expect(payload.lecturer_id).toBe("lecturer-1");
    expect(payload.student_id).toBe("student-1");
    expect(payload.intervention_type).toBe("support_referral");
    expect(payload.status).toBe("in_progress");
    expect(payload.priority).toBe("high");
    expect(payload.notes).toBe("Refer to academic support.");
  });

  it("normalizes unknown intervention values to safe fallbacks", () => {
    expect(normalizeInterventionContactTargetType("unknown")).toBe("other");
    expect(normalizeInterventionContactMethod("signal")).toBe("other");
    expect(normalizeInterventionOutcome("unexpected")).toBe("other");
    expect(formatInterventionContactTargetType("course_leader")).toBe("Course leader");
    expect(formatInterventionContactMethod("lms_message")).toBe("LMS message");
    expect(formatInterventionOutcome("follow_up_scheduled")).toBe("Follow-up scheduled");
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

  it("maps intervention events and payloads with fallback timestamps and trimmed fields", () => {
    const event = mapInterventionEventRow({
      id: "event-1",
      intervention_id: "intervention-1",
      student_id: "student-1",
      lecturer_id: "lecturer-1",
      contact_target_type: "unknown",
      contact_target_name: "  Sam Student  ",
      contact_method: "mystery",
      contacted_at: null,
      outcome: "strange",
      summary: "  Follow up recorded.  ",
      next_step: "  Check in next week. ",
      created_at: null,
      updated_at: "2026-04-21T12:00:00Z",
    } as never);

    const payload = buildStudentInterventionEventPayload({
      lecturerId: "lecturer-1",
      studentId: "student-1",
      interventionId: "intervention-1",
      contactTargetType: "student",
      contactTargetName: "  Sam Student  ",
      contactMethod: "email",
      outcome: "follow_up_scheduled",
      summary: "  Follow up recorded.  ",
      nextStep: "  Check in next week. ",
      contactedAt: "",
    });

    expect(event).toMatchObject({
      contactTargetType: "other",
      contactTargetName: "  Sam Student  ",
      contactMethod: "other",
      outcome: "other",
      summary: "  Follow up recorded.  ",
      nextStep: "  Check in next week. ",
      contactedAt: "2026-04-21T12:00:00Z",
      createdAt: "2026-04-21T12:00:00Z",
      updatedAt: "2026-04-21T12:00:00Z",
    });
    expect(payload).toMatchObject({
      contact_target_name: "Sam Student",
      summary: "Follow up recorded.",
      next_step: "Check in next week.",
    });
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
    expect(rows[0].status).toBe("planned");
    expect(rows[0].priority).toBe("high");
    expect(rows[0].assignment_id).toBe("assignment-1");
  });

  it("caps recommendation intervention rows at five and downgrades low severity to medium priority", () => {
    const rows = buildRecommendationInterventionRows({
      lecturerId: "lecturer-1",
      title: "Routine support check-in",
      summary: "Nudge the cohort to stay on track.",
      recommendedActions: ["Review draft", "Book office hour"],
      severity: "low",
      assignmentId: null,
      targets: Array.from({ length: 7 }, (_, index) => ({
        studentId: `student-${index + 1}`,
        name: `Student ${index + 1}`,
        email: `student-${index + 1}@example.edu`,
      })),
    });

    expect(rows).toHaveLength(5);
    expect(rows[0].priority).toBe("medium");
    expect(rows[0].assignment_id).toBeNull();
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

  it("handles overdue and stabilisation intervention readiness branches", () => {
    expect(
      getStudentInterventionReadiness({
        riskLevel: "high",
        recommendation: "Keep monitoring the student.",
        missedAssignmentsCount: 0,
        openInterventions: 1,
        overdueInterventions: 2,
        latestIntervention: {
          id: "intervention-1",
          createdAt: "2026-04-20T10:00:00Z",
          title: "Email intervention",
          type: "email",
          note: "Follow up overdue.",
          followUpDate: "2026-04-15T10:00:00Z",
          status: "planned",
        },
      }),
    ).toEqual({
      postureLabel: "Follow-up overdue position",
      likelyChallenge: "2 intervention follow-up dates are overdue",
      bestNextAction: "Review overdue interventions, confirm progress, and either resolve or reschedule them",
    });

    expect(
      getStudentInterventionReadiness({
        riskLevel: "low",
        recommendation: "Keep monitoring the student.",
        missedAssignmentsCount: 0,
        openInterventions: 2,
        overdueInterventions: 0,
        latestIntervention: {
          id: "intervention-2",
          createdAt: "2026-04-20T10:00:00Z",
          title: "Meeting intervention",
          type: "meeting",
          note: "Follow up recorded.",
          followUpDate: "2026-04-25T10:00:00Z",
          status: "resolved",
        },
      }),
    ).toEqual({
      postureLabel: "Stabilisation position",
      likelyChallenge: "Follow up recorded.",
      bestNextAction: "Close resolved actions or schedule the next support check-in",
    });
  });

  it("marks only planned and in-progress interventions with due dates as overdue", () => {
    expect(isInterventionOverdue({ status: "completed", followUpDate: "2026-04-01T00:00:00Z" }, Date.parse("2026-04-02T00:00:00Z"))).toBe(false);
    expect(isInterventionOverdue({ status: "planned", followUpDate: null }, Date.parse("2026-04-02T00:00:00Z"))).toBe(false);
    expect(isInterventionOverdue({ status: "planned", followUpDate: "2026-04-01T00:00:00Z" }, Date.parse("2026-04-02T00:00:00Z"))).toBe(true);
  });

  it("returns safe errors when intervention reads fail", async () => {
    const result = { data: null, error: { message: "boom" } };
    const query: Record<string, unknown> = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve),
    };
    const supabase = {
      from: vi.fn(() => query),
    } as never;

    await expect(fetchStudentInterventions(supabase, "lecturer-1", "student-1")).resolves.toEqual({
      data: null,
      error: { message: "boom" },
    });
    await expect(fetchStudentInterventionEvents(supabase, "lecturer-1", "student-1")).resolves.toEqual({
      data: null,
      error: { message: "boom" },
    });
  });

  it("returns early when there are no recommendation intervention rows to insert", async () => {
    const result = await insertRecommendationInterventions({} as never, []);

    expect(result).toEqual({ error: null });
  });
});
