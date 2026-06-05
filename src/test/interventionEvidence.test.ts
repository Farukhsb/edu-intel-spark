import { describe, expect, it } from "vitest";

import {
  buildInterventionEvidenceReport,
  type AdminInterventionEvidenceDataset,
} from "@/lib/data/admin";

describe("buildInterventionEvidenceReport", () => {
  it("summarizes filtered intervention evidence and renders csv rows", () => {
    const dataset: AdminInterventionEvidenceDataset = {
      profiles: [
        { id: "student-1", full_name: "Asha Khan", email: "asha@example.edu", cohort_id: "2025-cohort" },
        { id: "lecturer-1", full_name: "Dr Patel", email: "patel@example.edu", cohort_id: null },
      ],
      interventions: [
        {
          id: "intervention-1",
          lecturer_id: "lecturer-1",
          student_id: "student-1",
          student_name: "Asha Khan",
          student_email: "asha@example.edu",
          intervention_type: "email",
          status: "in_progress",
          title: "Email intervention",
          notes: "Check-in logged",
          follow_up_date: "2026-06-10T12:00:00.000Z",
          created_at: "2026-06-01T12:00:00.000Z",
          updated_at: "2026-06-01T12:00:00.000Z",
        },
      ],
      events: [
        {
          id: "event-1",
          intervention_id: "intervention-1",
          student_id: "student-1",
          lecturer_id: "lecturer-1",
          contact_target_type: "student",
          contact_target_name: "Asha Khan",
          contact_method: "email",
          contacted_at: "2026-06-02T12:00:00.000Z",
          outcome: "follow_up_scheduled",
          summary: "Email sent and follow-up arranged.",
          next_step: "Review on Friday.",
          created_at: "2026-06-02T12:00:00.000Z",
          updated_at: "2026-06-02T12:00:00.000Z",
        },
        {
          id: "event-2",
          intervention_id: "intervention-1",
          student_id: "student-1",
          lecturer_id: "lecturer-1",
          contact_target_type: "student",
          contact_target_name: "Asha Khan",
          contact_method: "meeting",
          contacted_at: "2026-06-03T12:00:00.000Z",
          outcome: "resolved",
          summary: "Meeting completed and support agreed.",
          next_step: null,
          created_at: "2026-06-03T12:00:00.000Z",
          updated_at: "2026-06-03T12:00:00.000Z",
        },
      ],
    };

    const report = buildInterventionEvidenceReport(dataset, {
      cohortId: "2025-cohort",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(report.summary).toEqual({
      interventionCount: 1,
      eventCount: 2,
      uniqueStudents: 1,
      uniqueLecturers: 1,
      resolvedCount: 1,
      openCount: 1,
      overdueCount: 0,
    });
    expect(report.rows).toHaveLength(2);
    expect(report.csv).toContain("Contacted At");
    expect(report.csv).toContain("Asha Khan");
    expect(report.csv).toContain("follow_up_scheduled");
  });
});
