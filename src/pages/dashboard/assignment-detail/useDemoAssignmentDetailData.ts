import { useCallback, useEffect, useState } from "react";

import { safeParseGradeBreakdown } from "@/lib/schemas/aiResponses";
import {
  DEMO_ASSIGNMENT_GRADES,
  DEMO_ASSIGNMENT_INTEGRITY_FLAGS,
  DEMO_ASSIGNMENT_INTEGRITY_SUMMARIES,
  DEMO_ASSIGNMENT_SUBMISSIONS,
  DEMO_STUDENT_ASSIGNMENTS,
  DEMO_STUDENT_ASSIGNMENT_GRADES,
  DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS,
  getDemoAssignmentById,
} from "@/pages/dashboard/demoAssignments";
import { toWorkflowRubric } from "@/types/academic";

import type {
  AssignmentDetailAssignment,
  AssignmentDetailBreakdown,
  AssignmentDetailSubmission,
  Grade,
  IntegrityReview,
  ModerationCase,
  PlagiarismFlag,
} from "./types";

const toAssignmentDetailBreakdown = (value: unknown): AssignmentDetailBreakdown[] => {
  const parsed = safeParseGradeBreakdown(value);
  return parsed.success ? parsed.data.map((item) => ({ ...item })) : [];
};

interface UseDemoAssignmentDetailDataArgs {
  id?: string;
  role: string | null | undefined;
}

export const useDemoAssignmentDetailData = ({ id, role }: UseDemoAssignmentDetailDataArgs) => {
  const [assignment, setAssignment] = useState<AssignmentDetailAssignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentDetailSubmission[]>([]);
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [integrityReviews, setIntegrityReviews] = useState<Record<string, IntegrityReview>>({});
  const [moderationCases, setModerationCases] = useState<Record<string, ModerationCase>>({});
  const [plagiarismFlags, setPlagiarismFlags] = useState<PlagiarismFlag[]>([]);
  const [plagiarismSummary, setPlagiarismSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reloadSubmissions = useCallback(async () => {
    if (!id) return;
    setLoadError(null);

    const demoSubmissions =
      role === "student" ? DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS[id] ?? [] : DEMO_ASSIGNMENT_SUBMISSIONS[id] ?? [];
    const gradeSource = role === "student" ? DEMO_STUDENT_ASSIGNMENT_GRADES : DEMO_ASSIGNMENT_GRADES;
    const demoGradeEntries = demoSubmissions
      .map((submission): [string, Grade] | null => {
        const grade = gradeSource[submission.id];
        if (!grade) return null;

        return [
          submission.id,
          {
            id: grade.id,
            submission_id: grade.submission_id,
            ai_score: grade.ai_score,
            ai_feedback: grade.ai_feedback,
            ai_breakdown: toAssignmentDetailBreakdown(grade.ai_breakdown),
            assignment_type: grade.assignment_type,
            grading_confidence: grade.grading_confidence,
            grading_metadata: grade.grading_metadata,
            lecturer_score: grade.lecturer_score,
            lecturer_feedback: grade.lecturer_feedback,
            final_score: grade.final_score,
            final_feedback: grade.final_feedback,
            grade_source: grade.grade_source ?? null,
            source_metadata: (grade.source_metadata as Record<string, unknown> | null) ?? null,
          },
        ];
      })
      .filter((entry): entry is [string, Grade] => entry !== null);

    setSubmissions(demoSubmissions);
    setGrades(Object.fromEntries(demoGradeEntries));
    setIntegrityReviews({});
    setModerationCases({});
    setPlagiarismFlags(role === "student" ? [] : DEMO_ASSIGNMENT_INTEGRITY_FLAGS[id] ?? []);
    setPlagiarismSummary(role === "student" ? "" : DEMO_ASSIGNMENT_INTEGRITY_SUMMARIES[id] ?? "");
  }, [id, role]);

  const loadAssignment = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setLoadError(null);

    const demoAssignment =
      role === "student" ? DEMO_STUDENT_ASSIGNMENTS.find((assignmentRecord) => assignmentRecord.id === id) ?? null : getDemoAssignmentById(id);

    if (demoAssignment) {
      setAssignment({
        id: demoAssignment.id,
        title: demoAssignment.title,
        description: demoAssignment.description,
        module_code: demoAssignment.module_code,
        max_score: demoAssignment.max_score,
        due_date: demoAssignment.due_date,
        status: demoAssignment.status,
        lecturer_id: demoAssignment.lecturer_id,
        rubric: toWorkflowRubric(demoAssignment.rubric ?? []),
      });
    } else {
      setAssignment(null);
      setSubmissions([]);
      setGrades({});
    }

    setPlagiarismFlags(DEMO_ASSIGNMENT_INTEGRITY_FLAGS[id] ?? []);
    setPlagiarismSummary(DEMO_ASSIGNMENT_INTEGRITY_SUMMARIES[id] ?? "");
    setLoading(false);
  }, [id, role]);

  useEffect(() => {
    void loadAssignment();
  }, [loadAssignment]);

  useEffect(() => {
    void reloadSubmissions();
  }, [reloadSubmissions]);

  return {
    assignment,
    grades,
    integrityReviews,
    loadError,
    loading,
    moderationCases,
    plagiarismFlags,
    plagiarismSummary,
    refreshData: async () => {
      await loadAssignment();
      await reloadSubmissions();
    },
    reloadSubmissions,
    setModerationCases,
    setPlagiarismFlags,
    setPlagiarismSummary,
    submissions,
  };
};
