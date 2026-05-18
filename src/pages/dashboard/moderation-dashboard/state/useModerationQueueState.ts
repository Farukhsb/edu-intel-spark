import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { log } from "@/lib/logger";
import { getLatestModeratorReview } from "@/lib/moderation";
import {
  canBulkApproveModeration,
  canBulkAssignModerator,
  fetchModerationCaseViews,
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
import { toast } from "sonner";

import {
  buildDemoModeratorDrafts,
  DEMO_LECTURERS,
  DEMO_MODERATION_CASES,
} from "../demoData";

type Profile = Tables<"profiles">;

type UseModerationQueueStateArgs = {
  isDemo: boolean;
  userId: string | undefined;
};

export const useModerationQueueState = ({
  isDemo,
  userId,
}: UseModerationQueueStateArgs) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cases, setCases] = useState<ModerationCaseView[]>([]);
  const [lecturers, setLecturers] = useState<Profile[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<ModerationQueueFilter>("all");
  const [queueSearch, setQueueSearch] = useState("");
  const [queueSort, setQueueSort] = useState<ModerationQueueSort>("priority");
  const [assignmentFocusId, setAssignmentFocusId] = useState<string | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [bulkModeratorId, setBulkModeratorId] = useState("unassigned");
  const [noteDraft, setNoteDraft] = useState("");
  const [scoreDraft, setScoreDraft] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [moderatorDrafts, setModeratorDrafts] = useState<Record<string, string>>({});

  const selectedCase = useMemo(
    () => cases.find((item) => item.moderationCase.id === selectedCaseId) ?? null,
    [cases, selectedCaseId],
  );

  const fetchCases = async () => {
    if (isDemo) {
      setLoadError(null);
      setLecturers(DEMO_LECTURERS);
      setCases(DEMO_MODERATION_CASES);
      setModeratorDrafts(buildDemoModeratorDrafts(DEMO_MODERATION_CASES));
      setLoading(false);
      return;
    }

    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const { cases: caseViews, lecturers: lecturerRows } = await fetchModerationCaseViews(supabase, userId);
      setLecturers(lecturerRows as Profile[]);
      setCases(caseViews);
      setModeratorDrafts(buildDemoModeratorDrafts(caseViews));
    } catch (error) {
      log.error("Failed to load moderation cases", error);
      setLoadError("Moderation cases could not be loaded right now.");
      toast.error("Moderation cases could not be loaded right now. Refresh the page or try again in a moment.");
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchCases();
  }, [isDemo, userId]);

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

  return {
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
    loadError,
    loading,
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
};
