import { useCallback, useEffect, useState } from "react";

import { normalizeAssignment } from "@/lib/assignmentCatalog";
import {
  DEMO_ASSIGNMENTS,
  DEMO_ASSIGNMENT_SUBMISSIONS,
  DEMO_STUDENT_ASSIGNMENTS,
  DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS,
} from "@/pages/dashboard/demoAssignments";
import { buildAssignmentSubmissionStats, type AssignmentSubmissionStats } from "@/lib/assignmentCatalog";

import type { AssignmentDataItem, StudentAssignmentWorkflowState } from "./useAssignmentsData";

const buildLatestStudentWorkflowMap = (
  submissions: Array<{
    id: string;
    assignment_id: string;
    status: string;
    submitted_at: string;
  }>,
) => {
  const latestByAssignment: Record<string, StudentAssignmentWorkflowState> = {};

  for (const submission of submissions) {
    const existing = latestByAssignment[submission.assignment_id];
    if (!existing || new Date(submission.submitted_at).getTime() > new Date(existing.submittedAt).getTime()) {
      latestByAssignment[submission.assignment_id] = {
        assignmentId: submission.assignment_id,
        submissionId: submission.id,
        status: submission.status as StudentAssignmentWorkflowState["status"],
        submittedAt: submission.submitted_at,
      };
    }
  }

  return latestByAssignment;
};

export const useDemoAssignmentsData = (role: string | null | undefined) => {
  const [assignments, setAssignments] = useState<AssignmentDataItem[]>([]);
  const [submissionStats, setSubmissionStats] = useState<Record<string, AssignmentSubmissionStats>>({});
  const [studentWorkflow, setStudentWorkflow] = useState<Record<string, StudentAssignmentWorkflowState>>({});
  const [loading, setLoading] = useState(true);

  const fetchAssignments = useCallback(async () => {
    const demoAssignments = role === "student" ? DEMO_STUDENT_ASSIGNMENTS : DEMO_ASSIGNMENTS;
    setAssignments((demoAssignments ?? []).map(normalizeAssignment));
    setSubmissionStats(
      buildAssignmentSubmissionStats(
        (demoAssignments ?? []).map(normalizeAssignment),
        Object.values(DEMO_ASSIGNMENT_SUBMISSIONS)
          .flat()
          .map((submission) => ({
            id: submission.id,
            assignment_id: submission.assignment_id,
            status: submission.status,
          })),
      ),
    );
    setStudentWorkflow(
      role === "student"
        ? buildLatestStudentWorkflowMap(
            Object.values(DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS)
              .flat()
              .map((submission) => ({
                id: submission.id,
                assignment_id: submission.assignment_id,
                status: submission.status,
                submitted_at: submission.submitted_at,
              })),
          )
        : {},
    );
    setLoading(false);
  }, [role]);

  useEffect(() => {
    void fetchAssignments();
  }, [fetchAssignments]);

  return {
    assignments,
    loading,
    refreshAssignments: fetchAssignments,
    studentWorkflow,
    submissionStats,
  };
};
