import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RubricCriterion } from "@/components/RubricBuilder";
import {
  buildAssignmentSubmissionStats,
  normalizeAssignment,
  type AssignmentCatalogItem,
  type AssignmentSubmissionStats,
} from "@/lib/assignmentCatalog";
import { log } from "@/lib/logger";
import { isAssignmentVisibleToStudent } from "@/lib/assignmentVisibility";
import {
  DEMO_ASSIGNMENTS,
  DEMO_STUDENT_ASSIGNMENTS,
  DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS,
} from "@/pages/dashboard/demoAssignments";

export interface AssignmentDataItem {
  id: string;
  title: string;
  description: string | null;
  module_code: string | null;
  lecturer_id: string;
  max_score: number;
  due_date: string | null;
  status: "draft" | "published" | "closed";
  created_at: string;
  rubric: RubricCriterion[] | null;
  cohorts: string[];
  departments: string[];
  target_cohorts: string[];
  target_departments: string[];
}

export interface StudentAssignmentWorkflowState {
  assignmentId: string;
  submissionId: string;
  status: string;
  submittedAt: string;
}

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
        status: submission.status,
        submittedAt: submission.submitted_at,
      };
    }
  }

  return latestByAssignment;
};

export const useAssignmentsData = ({
  role,
  userId,
  isDemo,
}: {
  role: string | null | undefined;
  userId: string | undefined;
  isDemo: boolean;
}) => {
  const [assignments, setAssignments] = useState<AssignmentDataItem[]>([]);
  const [submissionStats, setSubmissionStats] = useState<Record<string, AssignmentSubmissionStats>>({});
  const [studentWorkflow, setStudentWorkflow] = useState<Record<string, StudentAssignmentWorkflowState>>({});
  const [loading, setLoading] = useState(true);

  const fetchAssignments = async () => {
    if (isDemo) {
      const demoAssignments = role === "student" ? DEMO_STUDENT_ASSIGNMENTS : DEMO_ASSIGNMENTS;
      setAssignments((demoAssignments ?? []).map(normalizeAssignment));
      setSubmissionStats({});
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
      return;
    }

    if (!userId) {
      setStudentWorkflow({});
      setLoading(false);
      return;
    }

    setLoading(true);

    let query = supabase.from("assignments").select("*").order("created_at", { ascending: false });
    if (role !== "student") {
      query = query.eq("lecturer_id", userId);
    }

    const { data, error } = await query;
    if (error) {
      log.error("Assignments query failed", error, {
        role,
        userId,
      });
      toast.error("Failed to load assignments");
      setLoading(false);
      return;
    }

    const assignmentIds = (data || []).map((assignment) => assignment.id);
    const { data: assignmentCohorts } =
      role === "lecturer" && assignmentIds.length > 0
        ? await supabase
            .from("assignment_cohorts")
            .select("assignment_id, cohort_id")
            .in("assignment_id", assignmentIds)
        : { data: [] };
    const { data: assignmentDepartments } =
      role === "lecturer" && assignmentIds.length > 0
        ? await supabase
            .from("assignment_departments")
            .select("assignment_id, department_id")
            .in("assignment_id", assignmentIds)
        : { data: [] };

    const cohortMap = new Map<string, string[]>();
    for (const row of assignmentCohorts || []) {
      const existing = cohortMap.get(row.assignment_id) ?? [];
      existing.push(row.cohort_id);
      cohortMap.set(row.assignment_id, existing);
    }

    const departmentMap = new Map<string, string[]>();
    for (const row of assignmentDepartments || []) {
      const existing = departmentMap.get(row.assignment_id) ?? [];
      existing.push(row.department_id);
      departmentMap.set(row.assignment_id, existing);
    }

    const mapped: AssignmentDataItem[] = (data || [])
      .map((assignment) =>
        normalizeAssignment({
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          module_code: assignment.module_code,
          lecturer_id: assignment.lecturer_id,
          max_score: assignment.max_score,
          due_date: assignment.due_date,
          status: assignment.status,
          created_at: assignment.created_at,
          rubric: assignment.rubric as unknown as RubricCriterion[] | null,
          cohorts: cohortMap.get(assignment.id) ?? [],
          departments: departmentMap.get(assignment.id) ?? [],
          target_cohorts: cohortMap.get(assignment.id) ?? [],
          target_departments: departmentMap.get(assignment.id) ?? [],
        }),
      )
      .filter((assignment) => (role === "student" ? isAssignmentVisibleToStudent(assignment) : true));

    setAssignments(mapped);

    if (role === "lecturer" && mapped.length > 0) {
      const { data: submissions } = await supabase.from("submissions").select("id, assignment_id, status");
      if (submissions) {
        setSubmissionStats(buildAssignmentSubmissionStats(mapped as AssignmentCatalogItem[], submissions));
      }
      setStudentWorkflow({});
    } else if (role === "student" && mapped.length > 0) {
      const { data: studentSubmissions, error: studentSubmissionsError } = await supabase
        .from("submissions")
        .select("id, assignment_id, status, submitted_at")
        .eq("student_id", userId)
        .in("assignment_id", mapped.map((assignment) => assignment.id))
        .order("submitted_at", { ascending: false });

      if (studentSubmissionsError) {
        log.error("Student assignment workflow query failed", studentSubmissionsError, {
          role,
          userId,
        });
        setStudentWorkflow({});
      } else {
        setStudentWorkflow(
          buildLatestStudentWorkflowMap(
            (studentSubmissions ?? []) as Array<{
              id: string;
              assignment_id: string;
              status: string;
              submitted_at: string;
            }>,
          ),
        );
      }
    } else {
      setSubmissionStats({});
      setStudentWorkflow({});
    }

    setLoading(false);
  };

  useEffect(() => {
    void fetchAssignments();
  }, [role, userId, isDemo]);

  return {
    assignments,
    submissionStats,
    studentWorkflow,
    loading,
    refreshAssignments: fetchAssignments,
  };
};
