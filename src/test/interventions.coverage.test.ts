import { describe, expect, it, vi } from "vitest";

import {
  buildManualInterventionPayload,
  buildRecommendationInterventionRows,
  buildStudentInterventionEventPayload,
  fetchStudentInterventionEvents,
  fetchStudentInterventions,
  formatInterventionContactMethod,
  formatInterventionContactTargetType,
  formatInterventionOutcome,
  formatManualInterventionStatus,
  getInterventionErrorText,
  getStudentInterventionReadiness,
  insertManualIntervention,
  insertRecommendationInterventions,
  insertStudentInterventionEvent,
  isInterventionOverdue,
  mapInterventionEventRow,
  mapInterventionRow,
  normalizeInterventionContactMethod,
  normalizeInterventionContactTargetType,
  normalizeInterventionOutcome,
  normalizeManualInterventionStatus,
  normalizeManualInterventionType,
  updateStudentInterventionStatus,
} from "@/lib/interventions";

const createReadWriteQuery = (data: unknown, error: unknown = null) => {
  const query: Record<string, unknown> = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    single: vi.fn().mockResolvedValue({ data, error }),
  };

  return query;
};

describe("interventions coverage", () => {
  it("covers normalisation and formatting branches", () => {
    expect(normalizeManualInterventionType("meeting")).toBe("meeting");
    expect(normalizeManualInterventionType("something_else")).toBe("email");
    expect(normalizeManualInterventionStatus("ongoing")).toBe("in_progress");
    expect(normalizeManualInterventionStatus("resolved")).toBe("resolved");
    expect(normalizeManualInterventionStatus("unexpected")).toBe("planned");
    expect(normalizeInterventionContactTargetType("student")).toBe("student");
    expect(normalizeInterventionContactTargetType("mystery")).toBe("other");
    expect(normalizeInterventionContactMethod("sms")).toBe("sms");
    expect(normalizeInterventionContactMethod("mystery")).toBe("other");
    expect(normalizeInterventionOutcome("responded")).toBe("responded");
    expect(normalizeInterventionOutcome("mystery")).toBe("other");
    expect(formatManualInterventionStatus("planned")).toBe("Planned");
    expect(formatManualInterventionStatus("resolved")).toBe("Resolved");
    expect(formatManualInterventionStatus("resolved-again" as never)).toBe("resolved-again");
    expect(formatInterventionContactTargetType("student")).toBe("Student");
    expect(formatInterventionContactTargetType("course_leader")).toBe("Course leader");
    expect(formatInterventionContactMethod("email")).toBe("Email");
    expect(formatInterventionContactMethod("lms_message")).toBe("LMS message");
    expect(formatInterventionOutcome("responded")).toBe("Responded");
    expect(formatInterventionOutcome("follow_up_scheduled")).toBe("Follow-up scheduled");
    expect(getInterventionErrorText(null)).toBe("");
    expect(getInterventionErrorText({ message: "boom", details: "trace", hint: "try again" })).toBe("boom | trace | try again");
  });

  it("maps rows and payloads with fallbacks", () => {
    expect(
      mapInterventionRow({
        id: "row-1",
        lecturer_id: "lecturer-1",
        student_id: "student-1",
        student_name: "Ada Student",
        student_email: "ada@example.edu",
        intervention_type: null as never,
        status: "ongoing",
        priority: "high",
        title: "Email intervention",
        notes: "",
        follow_up_date: null,
        assignment_id: null,
        created_at: null,
        updated_at: "2026-04-21T10:00:00Z",
      }),
    ).toMatchObject({
      type: "other",
      status: "in_progress",
      createdAt: "2026-04-21T10:00:00Z",
      note: "",
      followUpDate: null,
    });

    expect(
      mapInterventionEventRow({
        id: "event-1",
        intervention_id: "intervention-1",
        student_id: "student-1",
        lecturer_id: "lecturer-1",
        contact_target_type: "mystery" as never,
        contact_target_name: "  Sam Student  ",
        contact_method: "mystery" as never,
        contacted_at: null,
        outcome: "mystery" as never,
        summary: "  Follow up recorded.  ",
        next_step: "  Check in next week. ",
        created_at: null,
        updated_at: "2026-04-21T12:00:00Z",
      }),
    ).toMatchObject({
      contactTargetType: "other",
      contactMethod: "other",
      outcome: "other",
      contactedAt: "2026-04-21T12:00:00Z",
      createdAt: "2026-04-21T12:00:00Z",
      updatedAt: "2026-04-21T12:00:00Z",
      nextStep: "  Check in next week. ",
    });

    expect(
      buildManualInterventionPayload({
        lecturerId: "lecturer-1",
        studentId: "student-1",
        studentName: "Ada Student",
        studentEmail: null,
        interventionType: "feedback",
        interventionStatus: "resolved",
        note: " Follow up completed. ",
        followUpDate: null,
        riskLevel: "low",
      }),
    ).toMatchObject({
      intervention_type: "feedback",
      status: "resolved",
      priority: "medium",
      notes: "Follow up completed.",
      follow_up_date: null,
    });

    expect(
      buildStudentInterventionEventPayload({
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
      }),
    ).toMatchObject({
      contact_target_name: "Sam Student",
      summary: "Follow up recorded.",
      next_step: "Check in next week.",
    });

    expect(
      buildRecommendationInterventionRows({
        lecturerId: "lecturer-1",
        title: "Cohort support",
        summary: "Follow up on risk.",
        recommendedActions: ["Review submissions"],
        severity: "critical",
        assignmentId: "assignment-1",
        targets: Array.from({ length: 6 }, (_, index) => ({
          studentId: `student-${index + 1}`,
          name: `Student ${index + 1}`,
          email: `student-${index + 1}@example.edu`,
        })),
      }),
    ).toHaveLength(5);
  });

  it("covers query success paths for fetch and write helpers", async () => {
    const interventionRows = [
      {
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
      },
    ];
    const interventionEventRows = [
      {
        id: "event-1",
        intervention_id: "intervention-1",
        student_id: "student-1",
        lecturer_id: "lecturer-1",
        contact_target_type: "student",
        contact_target_name: "Sam Student",
        contact_method: "email",
        contacted_at: "2026-04-21T12:00:00Z",
        outcome: "responded",
        summary: "Recorded follow up.",
        next_step: null,
        created_at: "2026-04-21T12:00:00Z",
        updated_at: "2026-04-21T12:00:00Z",
      },
    ];
    const writeRow = {
      id: "row-1",
      lecturer_id: "lecturer-1",
      student_id: "student-1",
      student_name: "Ada Student",
      student_email: "ada@example.edu",
      intervention_type: "email",
      status: "planned",
      priority: "medium",
      title: "Email intervention",
      notes: "Check in soon.",
      follow_up_date: "2026-04-30",
      assignment_id: null,
      created_at: "2026-04-21T10:00:00Z",
      updated_at: "2026-04-21T10:00:00Z",
    };

    const fetchQuery = createReadWriteQuery(interventionRows);
    const writeQuery = createReadWriteQuery(writeRow);
    const eventFetchQuery: Record<string, unknown> = {};
    Object.assign(eventFetchQuery, {
      select: vi.fn(() => eventFetchQuery),
      eq: vi.fn(() => eventFetchQuery),
      order: vi
        .fn()
        .mockImplementationOnce(() => eventFetchQuery)
        .mockImplementationOnce(() => Promise.resolve({ data: interventionEventRows, error: null })),
    });
    const eventWriteQuery = createReadWriteQuery({
      id: "event-1",
      intervention_id: "intervention-1",
      student_id: "student-1",
      lecturer_id: "lecturer-1",
      contact_target_type: "student",
      contact_target_name: "Sam Student",
      contact_method: "email",
      contacted_at: "2026-04-21T12:00:00Z",
      outcome: "responded",
      summary: "Recorded follow up.",
      next_step: null,
      created_at: "2026-04-21T12:00:00Z",
      updated_at: "2026-04-21T12:00:00Z",
    });

  const fetchSupabase = {
      from: vi.fn((table: string) => {
        if (table === "student_interventions") return fetchQuery;
        return eventFetchQuery;
      }),
    } as never;
    const writeSupabase = {
      from: vi.fn(() => writeQuery),
    } as never;
    const eventWriteSupabase = {
      from: vi.fn(() => eventWriteQuery),
    } as never;

    await expect(fetchStudentInterventions(fetchSupabase, "lecturer-1", "student-1")).resolves.toEqual({
      data: [
        {
          id: "row-1",
          createdAt: "2026-04-21T10:00:00Z",
          title: "Referral intervention",
          type: "referral",
          note: "Resolved after support session.",
          followUpDate: "2026-04-30",
          status: "resolved",
        },
      ],
      error: null,
    });

    await expect(fetchStudentInterventionEvents(fetchSupabase, "lecturer-1", "student-1")).resolves.toEqual({
      data: [
        {
          id: "event-1",
          interventionId: "intervention-1",
          studentId: "student-1",
          lecturerId: "lecturer-1",
          contactedAt: "2026-04-21T12:00:00Z",
          contactTargetType: "student",
          contactTargetName: "Sam Student",
          contactMethod: "email",
          outcome: "responded",
          summary: "Recorded follow up.",
          nextStep: null,
          createdAt: "2026-04-21T12:00:00Z",
          updatedAt: "2026-04-21T12:00:00Z",
        },
      ],
      error: null,
    });

    await expect(
      insertManualIntervention(
        writeSupabase,
        buildManualInterventionPayload({
          lecturerId: "lecturer-1",
          studentId: "student-1",
          studentName: "Ada Student",
          studentEmail: "ada@example.edu",
          interventionType: "email",
          interventionStatus: "planned",
          note: " Check in soon. ",
          followUpDate: "2026-04-30",
          riskLevel: "medium",
        }),
      ),
    ).resolves.toMatchObject({
      data: {
        id: "row-1",
        type: "email",
      },
      error: null,
    });

    await expect(
      insertStudentInterventionEvent(
        eventWriteSupabase,
        buildStudentInterventionEventPayload({
          lecturerId: "lecturer-1",
          studentId: "student-1",
          interventionId: "intervention-1",
          contactTargetType: "student",
          contactTargetName: "Sam Student",
          contactMethod: "email",
          outcome: "responded",
          summary: "Recorded follow up.",
          nextStep: null,
          contactedAt: "2026-04-21T12:00:00Z",
        }),
      ),
    ).resolves.toMatchObject({
      data: {
        id: "event-1",
        outcome: "responded",
      },
      error: null,
    });
  });

  it("covers empty recommendation inserts and overdue/readiness branches", async () => {
    const insertQuery = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };
    const supabase = {
      from: vi.fn(() => insertQuery),
    } as never;

    await expect(
      insertRecommendationInterventions(supabase, [
        {
          lecturer_id: "lecturer-1",
          student_id: "student-1",
          student_name: "Ada Student",
          student_email: "ada@example.edu",
          intervention_type: "check_in",
          title: "High-risk cluster",
          notes: "Follow up on risk.",
          priority: "high",
          follow_up_date: "2026-04-30",
          status: "planned",
          assignment_id: "assignment-1",
          updated_at: "2026-04-21T10:00:00Z",
        },
      ] as never),
    ).resolves.toEqual({ error: null });
    expect(insertQuery.insert).toHaveBeenCalledTimes(1);

    expect(
      isInterventionOverdue({ status: "planned", followUpDate: "2026-04-01T00:00:00Z" }, Date.parse("2026-04-02T00:00:00Z")),
    ).toBe(true);
    expect(
      isInterventionOverdue({ status: "completed", followUpDate: "2026-04-01T00:00:00Z" }, Date.parse("2026-04-02T00:00:00Z")),
    ).toBe(false);

    expect(
      getStudentInterventionReadiness({
        riskLevel: "critical",
        recommendation: "Schedule a support meeting.",
        missedAssignmentsCount: 0,
        openInterventions: 0,
        overdueInterventions: 0,
        latestIntervention: null,
      }),
    ).toMatchObject({
      postureLabel: "Immediate intervention position",
      bestNextAction: "Log the first intervention and send a student support alert",
    });

    expect(
      getStudentInterventionReadiness({
        riskLevel: "high",
        recommendation: "Keep monitoring.",
        missedAssignmentsCount: 1,
        openInterventions: 2,
        overdueInterventions: 0,
        latestIntervention: {
          id: "intervention-1",
          createdAt: "2026-04-20T10:00:00Z",
          title: "Meeting intervention",
          type: "meeting",
          note: "Follow up recorded.",
          followUpDate: "2026-04-25T10:00:00Z",
          status: "planned",
        },
      }),
    ).toMatchObject({
      postureLabel: "Active follow-up position",
      likelyChallenge: "1 missed assignment still unresolved",
      bestNextAction: "Review the latest intervention and confirm follow-up progress",
    });

    expect(
      getStudentInterventionReadiness({
        riskLevel: "low",
        recommendation: "Keep monitoring.",
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
    ).toMatchObject({
      postureLabel: "Stabilisation position",
      likelyChallenge: "Follow up recorded.",
      bestNextAction: "Close resolved actions or schedule the next support check-in",
    });

    expect(
      getStudentInterventionReadiness({
        riskLevel: "high",
        recommendation: "Keep monitoring.",
        missedAssignmentsCount: 0,
        openInterventions: 0,
        overdueInterventions: 2,
        latestIntervention: {
          id: "intervention-3",
          createdAt: "2026-04-20T10:00:00Z",
          title: "Email intervention",
          type: "email",
          note: "Follow up overdue.",
          followUpDate: "2026-04-15T10:00:00Z",
          status: "planned",
        },
      }),
    ).toMatchObject({
      postureLabel: "Follow-up overdue position",
      likelyChallenge: "2 intervention follow-up dates are overdue",
      bestNextAction: "Review overdue interventions, confirm progress, and either resolve or reschedule them",
    });
  });
});
