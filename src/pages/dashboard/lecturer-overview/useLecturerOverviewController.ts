import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { getAssignmentWorkflowTarget } from "@/lib/assignmentWorkflowNavigation";
import { isGradedWorkflowStatus, isReviewQueueStatus } from "@/lib/assessmentWorkflow";
import { safeToLocaleDate } from "@/lib/date";
import { exportLecturerOverviewPdf } from "@/lib/exportLecturerOverviewPdf";
import { getLecturerOverviewReadiness } from "@/lib/lecturerOverviewReadiness";
import { supabase } from "@/integrations/supabase/client";
import { log } from "@/lib/logger";

import type {
  LecturerOverviewDistributionBand,
  LecturerOverviewPipelineStage,
  LecturerOverviewRecentSubmission,
  LecturerOverviewStats,
  LecturerOverviewWorkflowTarget,
} from "./types";

const ASSIGNMENT_FIELDS = "id, title, max_score";
const SUBMISSION_FIELDS = "id, assignment_id, student_id, student_name, student_email, file_name, status, submitted_at";
const GRADE_FIELDS = "submission_id, ai_score, final_score";

const EMPTY_STATS: LecturerOverviewStats = {
  totalSubmissions: 0,
  gradedCount: 0,
  pendingCount: 0,
  avgScore: null,
  activeStudents: 0,
  assignmentCount: 0,
  onTarget: 0,
  atRisk: 0,
};

const DEMO_STATS: LecturerOverviewStats = {
  totalSubmissions: 42,
  gradedCount: 35,
  pendingCount: 7,
  avgScore: 64.3,
  activeStudents: 28,
  assignmentCount: 5,
  onTarget: 22,
  atRisk: 6,
};

const DEMO_RECENT: LecturerOverviewRecentSubmission[] = [
  {
    id: "d1",
    assignment_id: "demo-assignment-1",
    student_name: "Alice Johnson",
    file_name: "trees.py",
    status: "released",
    submitted_at: new Date(Date.now() - 86400000).toISOString(),
    assignment_title: "Data Structures",
    score: 78,
    max_score: 100,
    workflowHref: "/dashboard/assignments/demo-assignment-1?source=queue&focus=released-results",
    workflowLabel: "Open released results",
  },
  {
    id: "d2",
    assignment_id: "demo-assignment-2",
    student_name: "Bob Smith",
    file_name: "essay.pdf",
    status: "ai_graded",
    submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    assignment_title: "Algorithms",
    score: 55,
    max_score: 100,
    workflowHref: "/dashboard/assignments/demo-assignment-2?source=notification&focus=ai-results",
    workflowLabel: "Open workflow",
  },
  {
    id: "d3",
    assignment_id: "demo-assignment-3",
    student_name: "Carol White",
    file_name: "report.docx",
    status: "submitted",
    submitted_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    assignment_title: "Database Design",
    score: null,
    max_score: 100,
    workflowHref: "/dashboard/assignments/demo-assignment-3?source=notification&focus=submission-review",
    workflowLabel: "Open review queue",
  },
];

const DEMO_DIST: LecturerOverviewDistributionBand[] = [
  { label: "90-100%", count: 4, fill: "hsl(152, 56%, 45%)" },
  { label: "70-89%", count: 12, fill: "hsl(230, 65%, 52%)" },
  { label: "50-69%", count: 14, fill: "hsl(38, 92%, 60%)" },
  { label: "< 50%", count: 5, fill: "hsl(0, 72%, 55%)" },
];

const EMPTY_DIST: LecturerOverviewDistributionBand[] = [
  { label: "90-100%", count: 0, fill: "hsl(152, 56%, 45%)" },
  { label: "70-89%", count: 0, fill: "hsl(230, 65%, 52%)" },
  { label: "50-69%", count: 0, fill: "hsl(38, 92%, 60%)" },
  { label: "< 50%", count: 0, fill: "hsl(0, 72%, 55%)" },
];

const EMPTY_PIPELINE: LecturerOverviewPipelineStage[] = [
  { label: "Submitted", count: 0, detail: "Newly received work waiting to move into marking." },
  { label: "AI Graded", count: 0, detail: "AI output is ready for lecturer review." },
  { label: "Under Review", count: 0, detail: "Lecturer, moderation, or approval work is still in progress." },
  { label: "Released", count: 0, detail: "Student-visible results that have completed the workflow." },
];

const DEMO_PIPELINE: LecturerOverviewPipelineStage[] = [
  { label: "Submitted", count: 0, detail: "Newly received work waiting to move into marking." },
  { label: "AI Graded", count: 1, detail: "AI output is ready for lecturer review." },
  { label: "Under Review", count: 1, detail: "Lecturer, moderation, or approval work is still in progress." },
  { label: "Released", count: 1, detail: "Student-visible results that have completed the workflow." },
];

const buildPipelineStages = (statuses: string[]): LecturerOverviewPipelineStage[] => [
  {
    label: "Submitted",
    count: statuses.filter((status) => ["submitted", "ai_grading"].includes(status)).length,
    detail: "Newly received work waiting to move into marking.",
  },
  {
    label: "AI Graded",
    count: statuses.filter((status) => status === "ai_graded").length,
    detail: "AI output is ready for lecturer review.",
  },
  {
    label: "Under Review",
    count: statuses.filter((status) =>
      [
        "first_review",
        "moderation_pending",
        "moderation_in_progress",
        "moderated",
        "escalated",
        "under_review",
        "approved",
      ].includes(status),
    ).length,
    detail: "Lecturer, moderation, or approval work is still in progress.",
  },
  {
    label: "Released",
    count: statuses.filter((status) => status === "released").length,
    detail: "Student-visible results that have completed the workflow.",
  },
];

export const distributionInterpretation = (dist: { label: string; count: number }[]) => {
  const top = [...dist].sort((a, b) => b.count - a.count)[0];
  if (!top || top.count === 0) return "Grade distribution will appear once submissions have been graded.";
  return `Most graded submissions currently fall in the ${top.label} band.`;
};

export const formatStatusLabel = (status: string) =>
  status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const csvCell = (value: string | number | null | undefined) => {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
};

export const useLecturerOverviewController = () => {
  const { profile, user, isDemo } = useAuth();
  const [stats, setStats] = useState<LecturerOverviewStats>(isDemo ? DEMO_STATS : EMPTY_STATS);
  const [recent, setRecent] = useState<LecturerOverviewRecentSubmission[]>(isDemo ? DEMO_RECENT : []);
  const [gradeDistribution, setGradeDistribution] = useState<LecturerOverviewDistributionBand[]>(isDemo ? DEMO_DIST : EMPTY_DIST);
  const [pipeline, setPipeline] = useState<LecturerOverviewPipelineStage[]>(isDemo ? DEMO_PIPELINE : EMPTY_PIPELINE);
  const [loading, setLoading] = useState(!isDemo);

  const fetchDashboard = async () => {
    if (!user) return;

    try {
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("assignments")
        .select(ASSIGNMENT_FIELDS)
        .eq("lecturer_id", user.id);

      if (assignmentsError) throw assignmentsError;

      const assignments = assignmentsData || [];
      const assignmentIds = assignments.map((assignment) => assignment.id);

      if (assignmentIds.length === 0) {
        setStats({ ...EMPTY_STATS, assignmentCount: 0 });
        setRecent([]);
        setGradeDistribution(EMPTY_DIST);
        setPipeline(EMPTY_PIPELINE);
        setLoading(false);
        return;
      }

      const { data: submissionsData, error: submissionsError } = await supabase
        .from("submissions")
        .select(SUBMISSION_FIELDS)
        .in("assignment_id", assignmentIds);

      if (submissionsError) throw submissionsError;

      const allSubs = (submissionsData || []).sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
      );

      const submissionIds = allSubs.map((submission) => submission.id);
      let allGrades: Array<{ submission_id: string; final_score: number | null; ai_score: number | null }> = [];

      if (submissionIds.length > 0) {
        const { data: gradesData, error: gradesError } = await supabase
          .from("grades")
          .select(GRADE_FIELDS)
          .in("submission_id", submissionIds);

        if (gradesError) throw gradesError;
        allGrades = gradesData || [];
      }

      const assignmentMap: Record<string, { title: string; max_score: number }> = {};
      assignments.forEach((assignment) => {
        assignmentMap[assignment.id] = { title: assignment.title, max_score: assignment.max_score };
      });

      const gradeMap: Record<string, { final_score: number | null; ai_score: number | null }> = {};
      allGrades.forEach((grade) => {
        gradeMap[grade.submission_id] = {
          final_score: grade.final_score,
          ai_score: grade.ai_score,
        };
      });

      const gradedSubs = allSubs.filter((submission) => isGradedWorkflowStatus(submission.status));
      const pendingSubs = allSubs.filter((submission) => isReviewQueueStatus(submission.status));
      const scores = allGrades
        .map((grade) => grade.final_score ?? grade.ai_score)
        .filter((score): score is number => score != null);
      const avgScore =
        scores.length > 0
          ? Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 10) / 10
          : null;

      const studentScores: Record<string, number[]> = {};
      allSubs.forEach((submission) => {
        const key = submission.student_id || submission.student_name || submission.student_email;
        if (!key) return;

        const grade = gradeMap[submission.id];
        const score = grade?.final_score ?? grade?.ai_score;
        if (score != null) {
          if (!studentScores[key]) {
            studentScores[key] = [];
          }
          studentScores[key].push(score);
        }
      });

      let onTarget = 0;
      let atRisk = 0;
      Object.values(studentScores).forEach((studentScoreList) => {
        const studentAverage =
          studentScoreList.reduce((total, score) => total + score, 0) / studentScoreList.length;
        if (studentAverage >= 50) onTarget++;
        else atRisk++;
      });

      const uniqueStudents = new Set(
        allSubs.map((submission) => submission.student_id || submission.student_name || submission.student_email).filter(Boolean),
      );

      setStats({
        totalSubmissions: allSubs.length,
        gradedCount: gradedSubs.length,
        pendingCount: pendingSubs.length,
        avgScore,
        activeStudents: uniqueStudents.size,
        assignmentCount: assignments.length,
        onTarget,
        atRisk,
      });

      const dist: LecturerOverviewDistributionBand[] = [
        { label: "90-100%", count: 0, fill: "hsl(152, 56%, 45%)" },
        { label: "70-89%", count: 0, fill: "hsl(230, 65%, 52%)" },
        { label: "50-69%", count: 0, fill: "hsl(38, 92%, 60%)" },
        { label: "< 50%", count: 0, fill: "hsl(0, 72%, 55%)" },
      ];
      scores.forEach((score) => {
        if (score >= 90) dist[0].count++;
        else if (score >= 70) dist[1].count++;
        else if (score >= 50) dist[2].count++;
        else dist[3].count++;
      });
      setGradeDistribution(dist);
      setPipeline(buildPipelineStages(allSubs.map((submission) => submission.status)));

      const recentSubs: LecturerOverviewRecentSubmission[] = allSubs.slice(0, 6).map((submission) => {
        const assignment = assignmentMap[submission.assignment_id];
        const grade = gradeMap[submission.id];
        const workflowTarget = getAssignmentWorkflowTarget({
          assignmentId: submission.assignment_id,
          status: submission.status,
        });

        return {
          id: submission.id,
          assignment_id: submission.assignment_id,
          student_name: submission.student_name || submission.student_email || "Student",
          file_name: submission.file_name,
          status: submission.status,
          submitted_at: submission.submitted_at,
          assignment_title: assignment?.title || "Unknown",
          score: grade?.final_score ?? grade?.ai_score ?? null,
          max_score: assignment?.max_score || 100,
          workflowHref: workflowTarget.href,
          workflowLabel: workflowTarget.label,
        };
      });
      setRecent(recentSubs);
    } catch (error) {
      log.error("Lecturer overview fetch failed", error, {
        userId: user.id,
      });
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isDemo) return;
    void fetchDashboard();
  }, [isDemo]);

  const totalScored = gradeDistribution.reduce((total, band) => total + band.count, 0);
  const leadPendingAssignmentTitle =
    recent.find((submission) =>
      [
        "submitted",
        "ai_grading",
        "ai_graded",
        "first_review",
        "moderation_pending",
        "moderation_in_progress",
        "escalated",
        "under_review",
      ].includes(submission.status),
    )?.assignment_title ?? null;
  const readiness = getLecturerOverviewReadiness({
    pendingCount: stats.pendingCount,
    atRiskCount: stats.atRisk,
    assignmentCount: stats.assignmentCount,
    leadPendingAssignmentTitle,
  });
  const heroSummary = useMemo(() => {
    if (stats.pendingCount > 0 && stats.atRisk > 0) {
      return `${stats.pendingCount} submissions are awaiting review and ${stats.atRisk} student${stats.atRisk > 1 ? "s" : ""} may need attention.`;
    }
    if (stats.pendingCount > 0) {
      return `${stats.pendingCount} submissions are awaiting review.`;
    }
    if (stats.atRisk > 0) {
      return `${stats.atRisk} student${stats.atRisk > 1 ? "s" : ""} may need additional support.`;
    }
    return "All submissions are up to date and no immediate interventions are currently flagged.";
  }, [stats.pendingCount, stats.atRisk]);

  const primaryWorkflowTarget = useMemo<LecturerOverviewWorkflowTarget | null>(() => {
    const pendingTarget = recent.find((submission) =>
      [
        "submitted",
        "ai_grading",
        "ai_graded",
        "first_review",
        "moderation_pending",
        "moderation_in_progress",
        "escalated",
        "moderated",
        "under_review",
      ].includes(submission.status),
    );

    if (!pendingTarget) return null;

    return {
      href: pendingTarget.workflowHref,
      label:
        pendingTarget.status === "under_review" ? "Open manual review queue" : "Open assignment workflow",
    };
  }, [recent]);

  const exportCsv = () => {
    const rows = [["Student", "Assignment", "Score", "Max Score", "Status", "Submitted"]];
    recent.forEach((submission) =>
      rows.push([
        submission.student_name || "Unknown",
        submission.assignment_title,
        String(submission.score ?? ""),
        String(submission.max_score),
        submission.status,
        safeToLocaleDate(submission.submitted_at),
      ]),
    );
    const csv = rows
      .map((row) => row.map((cell) => csvCell(cell)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "grades_export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    await exportLecturerOverviewPdf({
      profile,
      stats,
      recent,
      formatStatusLabel,
      safeToLocaleDate,
    });
  };

  return {
    profile,
    state: {
      loading,
      stats,
      recent,
      gradeDistribution,
      pipeline,
      totalScored,
      readiness,
      heroSummary,
      primaryWorkflowTarget,
    },
    actions: {
      exportCsv,
      exportPdf,
    },
  };
};
