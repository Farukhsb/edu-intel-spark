import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { log } from "@/lib/logger";
import { getLatestModeratorReview } from "@/lib/moderation";
import { fetchModerationCaseViews, type ModerationCaseView } from "@/lib/moderationWorkflow";
import { toast } from "sonner";

import { buildDemoModeratorDrafts } from "../demoData";
import {
  getAssignmentFocusTitle,
  getBulkApprovableFilteredCases,
  getBulkAssignableFilteredCases,
  getFilteredCases,
  getOwnerAssignmentSummaries,
  getQueueFilterOptions,
  getQueueStats,
  getSelectedBulkApprovalCases,
  getSelectedBulkApprovalSummaries,
  getSelectedBulkCases,
  getSelectedCase,
  pruneSelectedCaseIds,
} from "./useModerationQueueState.helpers";
import type { ModerationQueueFilter, ModerationQueueSort } from "@/lib/moderationWorkflow";

type Profile = Tables<"profiles">;

type UseModerationQueueStateArgs = {
  userId: string | undefined;
};

export const useModerationQueueState = ({ userId }: UseModerationQueueStateArgs) => {
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

  const selectedCase = useMemo(() => getSelectedCase(cases, selectedCaseId), [cases, selectedCaseId]);

  const fetchCases = async () => {
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
  }, [userId]);

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
    setSelectedCaseIds((current) => pruneSelectedCaseIds(current, cases));
  }, [cases]);

  const queueStats = useMemo(() => getQueueStats(cases), [cases]);

  const ownerAssignmentSummaries = useMemo(() => getOwnerAssignmentSummaries(cases, userId), [cases, userId]);

  const assignmentFocusTitle = useMemo(
    () => getAssignmentFocusTitle(assignmentFocusId, ownerAssignmentSummaries, cases),
    [assignmentFocusId, cases, ownerAssignmentSummaries],
  );

  const queueFilterOptions = useMemo(() => getQueueFilterOptions({ cases, userId }), [cases, userId]);

  const filteredCases = useMemo(
    () =>
      getFilteredCases({
        cases,
        assignmentFocusId,
        queueFilter,
        queueSearch,
        queueSort,
        userId,
      }),
    [assignmentFocusId, cases, queueFilter, queueSearch, queueSort, userId],
  );

  const bulkAssignableFilteredCases = useMemo(
    () => getBulkAssignableFilteredCases(filteredCases, userId),
    [filteredCases, userId],
  );

  const bulkApprovableFilteredCases = useMemo(
    () => getBulkApprovableFilteredCases(filteredCases, userId),
    [filteredCases, userId],
  );

  const selectedBulkCases = useMemo(
    () => getSelectedBulkCases(cases, selectedCaseIds),
    [cases, selectedCaseIds],
  );

  const selectedBulkApprovalCases = useMemo(
    () => getSelectedBulkApprovalCases(selectedBulkCases, userId),
    [selectedBulkCases, userId],
  );

  const selectedBulkApprovalSummaries = useMemo(
    () => getSelectedBulkApprovalSummaries(selectedBulkApprovalCases),
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
