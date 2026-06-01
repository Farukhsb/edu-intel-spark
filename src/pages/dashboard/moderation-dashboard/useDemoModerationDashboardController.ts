import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getLatestModeratorReview } from "@/lib/moderation";
import {
  canBulkApproveModeration,
  canBulkAssignModerator,
  getModerationDisagreementSummary,
  getModerationOwnerAssignmentSummaries,
  getModerationQueueStats,
  matchesModerationQueueFilter,
  matchesModerationQueueSearch,
  sortModerationQueueCases,
  type ModerationCaseView,
  type ModerationQueueFilter,
  type ModerationQueueSort,
} from "@/lib/moderationWorkflow";
import { useModerationDashboardScreenProps } from "./screen-props";
import { buildDemoModeratorDrafts, createDemoGradeAuditLog, createDemoModerationReview, DEMO_LECTURERS, DEMO_MODERATION_CASES } from "./demoData";
import type { ModerationProfile } from "./types";

const buildDemoCases = () => DEMO_MODERATION_CASES.map((item) => ({ ...item }));

export const useDemoModerationDashboardController = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<ModerationCaseView[]>(() => buildDemoCases());
  const [lecturers, setLecturers] = useState<ModerationProfile[]>(() => DEMO_LECTURERS);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<ModerationQueueFilter>("all");
  const [queueSearch, setQueueSearch] = useState("");
  const [queueSort, setQueueSort] = useState<ModerationQueueSort>("priority");
  const [assignmentFocusId, setAssignmentFocusId] = useState<string | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [bulkModeratorId, setBulkModeratorId] = useState("demo-moderator");
  const [noteDraft, setNoteDraft] = useState("");
  const [scoreDraft, setScoreDraft] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [moderatorDrafts, setModeratorDrafts] = useState<Record<string, string>>(() =>
    buildDemoModeratorDrafts(DEMO_MODERATION_CASES),
  );
  const [saving] = useState(false);

  const userId = user?.id ?? profile?.id ?? "demo-lecturer";
  const selectedCase = useMemo(
    () => cases.find((item) => item.moderationCase.id === selectedCaseId) ?? null,
    [cases, selectedCaseId],
  );

  const fetchCases = async () => {
    setLecturers(DEMO_LECTURERS);
    setCases(buildDemoCases());
    setModeratorDrafts(buildDemoModeratorDrafts(DEMO_MODERATION_CASES));
    setSelectedCaseId(null);
  };

  useEffect(() => {
    void fetchCases();
  }, []);

  useEffect(() => {
    if (!selectedCase) return;
    const latestModeratorReview = getLatestModeratorReview(selectedCase.reviews);
    setNoteDraft(latestModeratorReview?.notes || "");
    setScoreDraft(
      latestModeratorReview?.proposed_score?.toString() ??
        selectedCase.moderationCase.final_agreed_score?.toString() ??
        selectedCase.moderationCase.first_marker_score?.toString() ??
        "",
    );
    setFeedbackDraft(
      latestModeratorReview?.proposed_feedback ||
        selectedCase.moderationCase.final_agreed_feedback ||
        selectedCase.grade?.lecturer_feedback ||
        "",
    );
  }, [selectedCase]);

  useEffect(() => {
    const knownIds = new Set(cases.map((item) => item.moderationCase.id));
    setSelectedCaseIds((current) => current.filter((id) => knownIds.has(id)));
  }, [cases]);

  const queueStats = useMemo(() => getModerationQueueStats(cases), [cases]);

  const ownerAssignmentSummaries = useMemo(
    () => getModerationOwnerAssignmentSummaries(cases, userId),
    [cases, userId],
  );

  const assignmentFocusTitle = useMemo(
    () =>
      assignmentFocusId
        ? ownerAssignmentSummaries.find((summary) => summary.assignmentId === assignmentFocusId)?.assignmentTitle ||
          cases.find((item) => (item.assignment?.id || item.moderationCase.assignment_id) === assignmentFocusId)
            ?.assignment?.title ||
          "Assignment"
        : null,
    [assignmentFocusId, cases, ownerAssignmentSummaries],
  );

  const queueFilterOptions = useMemo(
    () =>
      [
        { value: "all" as const, label: "All cases" },
        { value: "assigned_to_me" as const, label: "Assigned to me" },
        { value: "awaiting_my_approval" as const, label: "Awaiting my approval" },
        { value: "escalated" as const, label: "Escalated" },
        { value: "ready_for_release" as const, label: "Ready for release" },
      ].map((option) => ({
        ...option,
        count: cases.filter((item) =>
          matchesModerationQueueFilter({
            item,
            filter: option.value,
            userId,
          }),
        ).length,
      })),
    [cases, userId],
  );

  const filteredCases = useMemo(() => {
    const visible = cases.filter(
      (item) =>
        (!assignmentFocusId ||
          (item.assignment?.id || item.moderationCase.assignment_id) === assignmentFocusId) &&
        matchesModerationQueueFilter({
          item,
          filter: queueFilter,
          userId,
        }) &&
        matchesModerationQueueSearch({
          item,
          query: queueSearch,
        }),
    );

    return sortModerationQueueCases(visible, queueSort);
  }, [assignmentFocusId, cases, queueFilter, queueSearch, queueSort, userId]);

  const bulkAssignableFilteredCases = useMemo(
    () =>
      filteredCases.filter((item) =>
        canBulkAssignModerator({
          item,
          userId,
        }),
      ),
    [filteredCases, userId],
  );

  const bulkApprovableFilteredCases = useMemo(
    () =>
      filteredCases.filter((item) =>
        canBulkApproveModeration({
          item,
          userId,
        }),
      ),
    [filteredCases, userId],
  );

  const selectedBulkCases = useMemo(
    () => cases.filter((item) => selectedCaseIds.includes(item.moderationCase.id)),
    [cases, selectedCaseIds],
  );

  const selectedBulkApprovalCases = useMemo(
    () =>
      selectedBulkCases.filter((item) =>
        canBulkApproveModeration({
          item,
          userId,
        }),
      ),
    [selectedBulkCases, userId],
  );

  const selectedBulkApprovalSummaries = useMemo(
    () =>
      selectedBulkApprovalCases.map((item) => {
        const disagreement = getModerationDisagreementSummary({
          moderationCase: item.moderationCase,
          grade: item.grade,
          latestModeratorReview: getLatestModeratorReview(item.reviews),
        });

        return {
          caseId: item.moderationCase.id,
          studentLabel:
            item.submission?.student_name || item.submission?.student_email || "Student record unavailable",
          assignmentTitle: item.assignment?.title || "Assignment",
          disagreementLabel: disagreement.label,
          baselineScore: disagreement.baselineScore,
          moderatorScore: disagreement.moderatorScore,
          feedbackChanged: disagreement.feedbackChanged,
        };
      }),
    [selectedBulkApprovalCases],
  );

  const assignModerator = async (item: ModerationCaseView | null) => {
    if (!item) return;
    const moderatorId = moderatorDrafts[item.moderationCase.id] || "unassigned";
    setCases((current) =>
      current.map((entry) =>
        entry.moderationCase.id === item.moderationCase.id
          ? {
              ...entry,
              moderationCase: {
                ...entry.moderationCase,
                moderator_id: moderatorId,
                status: "moderation_in_progress",
              },
              moderator: DEMO_LECTURERS.find((lecturer) => lecturer.id === moderatorId) || entry.moderator,
              submission: entry.submission ? { ...entry.submission, status: "moderation_in_progress" } : entry.submission,
            }
          : entry,
      ),
    );
  };

  const assignModeratorBulk = async () => {
    if (!bulkModeratorId || bulkModeratorId === "unassigned") return;

    const eligibleCases = selectedBulkCases.filter((item) =>
      canBulkAssignModerator({
        item,
        userId,
      }),
    );
    if (eligibleCases.length === 0) return;

    setCases((current) =>
      current.map((entry) =>
        selectedCaseIds.includes(entry.moderationCase.id) &&
        canBulkAssignModerator({
          item: entry,
          userId,
        })
          ? {
              ...entry,
              moderationCase: {
                ...entry.moderationCase,
                moderator_id: bulkModeratorId,
                status: "moderation_in_progress",
              },
              moderator: DEMO_LECTURERS.find((lecturer) => lecturer.id === bulkModeratorId) || entry.moderator,
              submission: entry.submission ? { ...entry.submission, status: "moderation_in_progress" } : entry.submission,
            }
          : entry,
      ),
    );
    setSelectedCaseIds([]);
  };

  const approveModerationBulk = async () => {
    const eligibleCases = selectedBulkApprovalCases;
    if (eligibleCases.length === 0) return;

    setCases((current) =>
      current.map((entry) =>
        selectedCaseIds.includes(entry.moderationCase.id) &&
        canBulkApproveModeration({
          item: entry,
          userId,
        })
          ? {
              ...entry,
              moderationCase: {
                ...entry.moderationCase,
                approved_at: new Date().toISOString(),
              },
              submission: entry.submission ? { ...entry.submission, status: "approved" } : entry.submission,
              grade: entry.grade
                ? {
                    ...entry.grade,
                    final_score:
                      entry.moderationCase.final_agreed_score ??
                      entry.grade.final_score ??
                      entry.grade.lecturer_score ??
                      entry.grade.ai_score ??
                      null,
                    final_feedback:
                      entry.moderationCase.final_agreed_feedback ??
                      entry.grade.final_feedback ??
                      entry.grade.lecturer_feedback ??
                      entry.grade.ai_feedback ??
                      null,
                  }
                : entry.grade,
            }
          : entry,
      ),
    );
    setSelectedCaseIds([]);
  };

  const saveAction = async (action: "agree" | "adjust" | "return" | "escalate" | "approve") => {
    if (!selectedCase) return;

    const nextSubmissionStatus =
      action === "approve"
        ? "approved"
        : action === "return"
          ? "first_review"
          : action === "escalate"
            ? "escalated"
            : "moderated";

    setCases((current) =>
      current.map((entry) => {
        if (entry.moderationCase.id !== selectedCase.moderationCase.id) return entry;

        const nextReview =
          action === "approve"
            ? entry.reviews
            : [
                createDemoModerationReview({
                  id: `demo-review-${Date.now()}`,
                  moderation_case_id: entry.moderationCase.id,
                  submission_id: entry.moderationCase.submission_id,
                  reviewer_role: entry.moderationCase.lecturer_id === userId ? "lecturer" : "moderator",
                  action,
                  proposed_score:
                    scoreDraft === ""
                      ? entry.moderationCase.final_agreed_score ??
                        entry.grade?.lecturer_score ??
                        entry.grade?.ai_score ??
                        null
                      : Number(scoreDraft),
                  proposed_feedback:
                    feedbackDraft ||
                    entry.moderationCase.final_agreed_feedback ||
                    entry.grade?.lecturer_feedback ||
                    entry.grade?.ai_feedback ||
                    null,
                  notes: noteDraft || null,
                  created_at: new Date().toISOString(),
                }),
                ...entry.reviews,
              ];

        return {
          ...entry,
          moderationCase: {
            ...entry.moderationCase,
            status:
              action === "approve"
                ? entry.moderationCase.status
                : action === "return"
                  ? "first_review"
                  : action === "escalate"
                    ? "escalated"
                    : "moderated",
            final_agreed_score:
              action === "return"
                ? entry.moderationCase.final_agreed_score
                : scoreDraft === ""
                  ? entry.moderationCase.final_agreed_score ??
                    entry.grade?.lecturer_score ??
                    entry.grade?.ai_score ??
                    null
                  : Number(scoreDraft),
            final_agreed_feedback:
              action === "return"
                ? entry.moderationCase.final_agreed_feedback
                : feedbackDraft ||
                  entry.moderationCase.final_agreed_feedback ||
                  entry.grade?.lecturer_feedback ||
                  entry.grade?.ai_feedback ||
                  null,
            moderator_score:
              action === "return"
                ? entry.moderationCase.moderator_score
                : scoreDraft === ""
                  ? entry.moderationCase.moderator_score ??
                    entry.grade?.lecturer_score ??
                    entry.grade?.ai_score ??
                    null
                  : Number(scoreDraft),
            moderated_at:
              action === "agree" || action === "adjust" ? new Date().toISOString() : entry.moderationCase.moderated_at,
            approved_at: action === "approve" ? new Date().toISOString() : entry.moderationCase.approved_at,
          },
          submission: entry.submission ? { ...entry.submission, status: nextSubmissionStatus } : entry.submission,
          grade:
            action === "approve" && entry.grade
              ? {
                  ...entry.grade,
                  final_score:
                    scoreDraft === ""
                      ? entry.grade.final_score ?? entry.grade.lecturer_score ?? entry.grade.ai_score ?? null
                      : Number(scoreDraft),
                  final_feedback:
                    feedbackDraft ||
                    entry.grade.final_feedback ||
                    entry.grade.lecturer_feedback ||
                    entry.grade.ai_feedback ||
                    null,
                }
              : entry.grade,
          reviews: nextReview,
          auditLog: [
            createDemoGradeAuditLog({
              id: `demo-audit-${Date.now()}`,
              event_type: `moderation_${action}`,
              reason: noteDraft || `Demo moderation action recorded: ${action}.`,
              created_at: new Date().toISOString(),
              submission_id: entry.moderationCase.submission_id,
            }),
            ...entry.auditLog,
          ],
        };
      }),
    );
    setSelectedCaseId(null);
  };

  const queueState = {
    assignmentFocusId,
    assignmentFocusTitle,
    bulkApprovableFilteredCases,
    bulkAssignableFilteredCases,
    bulkModeratorId,
    cases,
    feedbackDraft,
    fetchCases,
    filteredCases,
    lecturers,
    loadError: null as string | null,
    loading: false,
    moderatorDrafts,
    noteDraft,
    ownerAssignmentSummaries,
    queueFilter,
    queueFilterOptions,
    queueSearch,
    queueSort,
    queueStats,
    scoreDraft,
    selectedBulkApprovalCases,
    selectedBulkApprovalSummaries,
    selectedBulkCases,
    selectedCase,
    selectedCaseId,
    selectedCaseIds,
    setAssignmentFocusId,
    setBulkModeratorId,
    setCases,
    setFeedbackDraft,
    setModeratorDrafts,
    setNoteDraft,
    setQueueFilter,
    setQueueSearch,
    setQueueSort,
    setScoreDraft,
    setSelectedCaseId,
    setSelectedCaseIds,
  };

  const actions = {
    approveModerationBulk,
    assignModerator,
    assignModeratorBulk,
    saveAction,
    saving,
    toggleSelectAllVisible: (checked: boolean) => {
      const visibleIds = bulkAssignableFilteredCases.map((item) => item.moderationCase.id);
      setSelectedCaseIds((current) => {
        if (checked) return Array.from(new Set([...current, ...visibleIds]));
        return current.filter((id) => !visibleIds.includes(id));
      });
    },
    toggleSelectedCase: (caseId: string, checked: boolean) => {
      setSelectedCaseIds((current) => (checked ? Array.from(new Set([...current, caseId])) : current.filter((id) => id !== caseId)));
    },
  };

  const screenProps = useModerationDashboardScreenProps({
    actions,
    openReleaseWorkflow: (assignmentId: string) =>
      navigate(`/demo/dashboard/assignments/${assignmentId}?source=moderation&focus=release-ready`),
    queueState,
    userId,
  });

  return {
    loadError: null,
    loading: false,
    reload: () => void fetchCases(),
    screenProps,
  };
};
