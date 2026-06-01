import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { normalizeAssessmentWorkflowStatus } from "@/lib/assessmentWorkflow";
import { isAssignmentVisibleToStudent } from "@/lib/assignmentVisibility";
import { safeParseGradeBreakdown } from "@/lib/schemas/aiResponses";
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
  role: string | null | undefined;
  userId?: string | null;
  hasUser: boolean;
}

export const useAssignmentDetailData = ({
  id,
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
  const [loadError, setLoadError] = useState<string | null>(null);

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
      const gradeRow = grade as typeof grade & {
        grade_source?: string | null;
        source_metadata?: Record<string, unknown> | null;
      };
      gradeMap[grade.submission_id] = {
        id: grade.id,
        submission_id: grade.submission_id,
        ai_score: grade.ai_score,
        ai_feedback: grade.ai_feedback,
        ai_breakdown: toAssignmentDetailBreakdown(grade.ai_breakdown),
        assignment_type: grade.assignment_type,
        grade_source: gradeRow.grade_source ?? null,
        source_metadata: gradeRow.source_metadata ?? null,
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
    setLoadError(null);

    try {
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
        status: normalizeAssessmentWorkflowStatus(submission.status) as SubmissionStatus,
        submitted_at: submission.submitted_at,
        student_id: submission.student_id,
      }));

      setSubmissions(loadedSubmissions);
      await Promise.all([
        loadGrades(loadedSubmissions),
        loadIntegrityReviews(loadedSubmissions),
        loadModerationCases(loadedSubmissions),
      ]);
    } catch (error) {
      setSubmissions([]);
      setGrades({});
      setIntegrityReviews({});
      setModerationCases({});
      setLoadError("Assignment workflow data could not be loaded right now.");
    }
  }, [id, loadGrades, loadIntegrityReviews, loadModerationCases, role]);

  const loadAssignment = useCallback(async () => {
    if (!id || !hasUser) return;

    setLoading(true);
    setLoadError(null);

    try {
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
    } catch (error) {
      setAssignment(null);
      setSubmissions([]);
      setGrades({});
      setLoadError("Assignment workflow data could not be loaded right now.");
    }

    setPlagiarismFlags([]);
    setPlagiarismSummary("");
    setLoading(false);
  }, [hasUser, id, role, userId]);

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
