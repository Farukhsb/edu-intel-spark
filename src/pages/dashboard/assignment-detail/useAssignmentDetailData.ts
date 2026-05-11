import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { isAssignmentVisibleToStudent } from "@/lib/assignmentVisibility";
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
  GradingMetadata,
  IntegrityReview,
  ModerationCase,
  PlagiarismFlag,
  SubmissionStatus,
} from "./types";

const toAssignmentDetailBreakdown = (value: unknown): AssignmentDetailBreakdown[] => {
  const parsed = safeParseGradeBreakdown(value);
  return parsed.success ? parsed.data.map((item) => ({ ...item })) : [];
};

interface UseAssignmentDetailDataArgs {
  id?: string;
  isDemo: boolean;
  role: string | null | undefined;
  userId?: string | null;
  hasUser: boolean;
}

export const useAssignmentDetailData = ({
  id,
  isDemo,
  role,
  userId,
  hasUser,
}: UseAssignmentDetailDataArgs) => {
  const [assignment, setAssignment] = useState<AssignmentDetailAssignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentDetailSubmission[]>([]);
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [integrityReviews, setIntegrityReviews] = useState<Record<string, IntegrityReview>>({});
  const [moderationCases, setModerationCases] = useState<Record<string, ModerationCase>>({});
  const [plagiarismFlags, setPlagiarismFlags] = useState<PlagiarismFlag[]>([]);
  const [plagiarismSummary, setPlagiarismSummary] = useState("");
  const [loading, setLoading] = useState(true);

  const loadGrades = useCallback(async (loadedSubmissions: AssignmentDetailSubmission[]) => {
    if (loadedSubmissions.length === 0) {
      setGrades({});
      return;
    }

    const { data } = await supabase
      .from("grades")
      .select("*")
      .in(
        "submission_id",
        loadedSubmissions.map((submission) => submission.id),
      );

    const gradeMap: Record<string, Grade> = {};
    for (const grade of data || []) {
      gradeMap[grade.submission_id] = {
        id: grade.id,
        submission_id: grade.submission_id,
        ai_score: grade.ai_score,
        ai_feedback: grade.ai_feedback,
        ai_breakdown: toAssignmentDetailBreakdown(grade.ai_breakdown),
        assignment_type: grade.assignment_type,
        grading_confidence: grade.grading_confidence,
        grading_metadata: (grade.grading_metadata as GradingMetadata | null) ?? null,
        lecturer_score: grade.lecturer_score,
        lecturer_feedback: grade.lecturer_feedback,
        final_score: grade.final_score,
        final_feedback: grade.final_feedback,
      };
    }
    setGrades(gradeMap);
  }, []);

  const loadIntegrityReviews = useCallback(
    async (loadedSubmissions: AssignmentDetailSubmission[]) => {
      if (loadedSubmissions.length === 0 || !userId) {
        setIntegrityReviews({});
        return;
      }

      const { data } = await supabase
        .from("academic_integrity_reviews")
        .select("*")
        .eq("lecturer_id", userId)
        .in(
          "submission_id",
          loadedSubmissions.map((submission) => submission.id),
        );

      const reviewMap: Record<string, IntegrityReview> = {};
      for (const review of data || []) {
        reviewMap[review.submission_id] = review;
      }
      setIntegrityReviews(reviewMap);
    },
    [userId],
  );

  const loadModerationCases = useCallback(async (loadedSubmissions: AssignmentDetailSubmission[]) => {
    if (loadedSubmissions.length === 0) {
      setModerationCases({});
      return;
    }

    const { data } = await supabase
      .from("moderation_cases")
      .select("*")
      .in(
        "submission_id",
        loadedSubmissions.map((submission) => submission.id),
      );

    const caseMap: Record<string, ModerationCase> = {};
    for (const moderationCase of data || []) {
      caseMap[moderationCase.submission_id] = moderationCase;
    }
    setModerationCases(caseMap);
  }, []);

  const reloadSubmissions = useCallback(async () => {
    if (!id) return;

    if (isDemo) {
      const demoSubmissions =
        role === "student"
          ? DEMO_STUDENT_ASSIGNMENT_SUBMISSIONS[id] ?? []
          : DEMO_ASSIGNMENT_SUBMISSIONS[id] ?? [];
      const gradeSource =
        role === "student" ? DEMO_STUDENT_ASSIGNMENT_GRADES : DEMO_ASSIGNMENT_GRADES;
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
            },
          ];
        })
        .filter((entry): entry is [string, Grade] => entry !== null);

      const demoGrades = Object.fromEntries(
        demoGradeEntries,
      );

      setSubmissions(demoSubmissions);
      setGrades(demoGrades);
      setIntegrityReviews({});
      setModerationCases({});
      setPlagiarismFlags(role === "student" ? [] : DEMO_ASSIGNMENT_INTEGRITY_FLAGS[id] ?? []);
      setPlagiarismSummary(role === "student" ? "" : DEMO_ASSIGNMENT_INTEGRITY_SUMMARIES[id] ?? "");
      return;
    }

    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("assignment_id", id)
      .order("submitted_at", { ascending: false });

    const loadedSubmissions: AssignmentDetailSubmission[] = (data || []).map((submission) => ({
      id: submission.id,
      assignment_id: submission.assignment_id,
      student_name: submission.student_name,
      student_email: submission.student_email,
      file_name: submission.file_name,
      file_type: submission.file_type,
      file_url: submission.file_url,
      status: submission.status as SubmissionStatus,
      submitted_at: submission.submitted_at,
      student_id: submission.student_id,
    }));

    setSubmissions(loadedSubmissions);
    await Promise.all([
      loadGrades(loadedSubmissions),
      loadIntegrityReviews(loadedSubmissions),
      loadModerationCases(loadedSubmissions),
    ]);
  }, [id, isDemo, loadGrades, loadIntegrityReviews, loadModerationCases, role]);

  const loadAssignment = useCallback(async () => {
    if (!id || (!hasUser && !isDemo)) return;

    setLoading(true);

    if (isDemo) {
      const demoAssignment =
        role === "student"
          ? DEMO_STUDENT_ASSIGNMENTS.find((assignmentRecord) => assignmentRecord.id === id) ?? null
          : getDemoAssignmentById(id);

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
      return;
    }

    let query = supabase.from("assignments").select("*").eq("id", id);
    if (role === "lecturer" && userId) {
      query = query.eq("lecturer_id", userId);
    }

    const { data } = await query.maybeSingle();

    if (data && role === "student" && !isAssignmentVisibleToStudent(data)) {
      setAssignment(null);
      setSubmissions([]);
      setGrades({});
    } else if (data) {
      setAssignment({
        id: data.id,
        title: data.title,
        description: data.description,
        module_code: data.module_code,
        max_score: data.max_score,
        due_date: data.due_date,
        status: data.status,
        lecturer_id: data.lecturer_id,
        rubric: toWorkflowRubric(data.rubric),
      });
    } else {
      setAssignment(null);
      setSubmissions([]);
      setGrades({});
    }

    setPlagiarismFlags([]);
    setPlagiarismSummary("");
    setLoading(false);
  }, [hasUser, id, isDemo, role, userId]);

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
    loading,
    moderationCases,
    plagiarismFlags,
    plagiarismSummary,
    reloadSubmissions,
    setModerationCases,
    setPlagiarismFlags,
    setPlagiarismSummary,
    submissions,
  };
};
