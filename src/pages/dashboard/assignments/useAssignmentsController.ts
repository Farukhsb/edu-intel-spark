import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import type { RubricCriterion } from "@/components/RubricBuilder";
import { STARTER_ASSIGNMENT_TEMPLATES } from "@/data/assignmentSets";
import {
  filterAssignments,
  getAssignmentOverviewStats,
  getLecturerAssignmentCatalogReadiness,
  getStudentAssignmentCatalogReadiness,
  normalizeAssignment,
  sortAssignmentsForView,
  type AssignmentCatalogItem,
} from "@/lib/assignmentCatalog";
import { isStudentGradeVisible } from "@/lib/assessmentWorkflow";
import { safeFormatDate } from "@/lib/date";
import { parseAssignmentsSearchState } from "@/lib/schemas/navigation";
import { useAssignmentsData, type AssignmentDataItem } from "@/pages/dashboard/assignments/useAssignmentsData";

import {
  ASSIGNMENT_TARGET_COHORTS,
  ASSIGNMENT_TARGET_DEPARTMENTS,
  type AssignmentFormState,
} from "./types";
import { publishAssignment, saveAssignmentDraft, setAssignmentStatus } from "./workflows";

const buildInitialFormState = (): AssignmentFormState => ({
  dialogOpen: false,
  creating: false,
  editingAssignmentId: null,
  title: "",
  description: "",
  moduleCode: "",
  maxScore: "100",
  dueDate: "",
  rubric: [],
  selectedCohorts: [],
  selectedDepartments: [],
  selectedTemplateId: "none",
});

const summarizeSelection = (
  selected: string[] | null | undefined,
  labelForValue: (value: string) => string,
  emptyLabel: string,
) => {
  const values = selected ?? [];
  if (values.length === 0) return emptyLabel;
  if (values.length <= 2) return values.map(labelForValue).join(", ");
  return `${values.length} selected`;
};

const getStudentAssignmentJourney = (status: string | undefined) => {
  if (!status) {
    return {
      badge: "Not submitted",
      title: "Ready to submit",
      description: "This assignment is open to you, but no submission has been recorded yet.",
    };
  }

  if (status === "released") {
    return {
      badge: "Released",
      title: "Released result available",
      description: "Your released result and explanation are ready to review.",
    };
  }

  if (status === "approved") {
    return {
      badge: "Approved",
      title: "Awaiting release",
      description: "Your submission has been approved and is waiting for final release to students.",
    };
  }

  if (status === "moderation_pending" || status === "moderation_in_progress" || status === "escalated") {
    return {
      badge: "Moderation",
      title: "Under moderation",
      description: "Your submission is still in the moderation workflow before a final result can be released.",
    };
  }

  if (status === "ai_graded" || status === "first_review" || status === "under_review" || status === "moderated") {
    return {
      badge: "Review",
      title: "Awaiting final review",
      description: "Marking is in progress and the released result is not available yet.",
    };
  }

  return {
    badge: "Submitted",
    title: "Submission received",
    description: "Your submission is in the assessment workflow and has not been released yet.",
  };
};

const formatDueDateForInput = (dueDate: string | null) =>
  dueDate
    ? new Date(new Date(dueDate).getTime() - new Date(dueDate).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";

export const useAssignmentsController = ({
  role,
  userId,
  isDemo,
}: {
  role: string | null | undefined;
  userId: string | undefined;
  isDemo: boolean;
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const assignmentSearchState = parseAssignmentsSearchState(searchParams);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AssignmentDataItem["status"]>("all");
  const [formState, setFormState] = useState<AssignmentFormState>(buildInitialFormState);
  const {
    assignments,
    submissionStats,
    studentWorkflow,
    loading,
    refreshAssignments,
  } = useAssignmentsData({
    role,
    userId,
    isDemo,
  });

  useEffect(() => {
    setStatusFilter(assignmentSearchState.statusFilter);
  }, [assignmentSearchState.statusFilter]);

  const resetAssignmentForm = () => {
    setFormState(buildInitialFormState());
  };

  const openCreateDialog = () => {
    resetAssignmentForm();
    setFormState((current) => ({ ...current, dialogOpen: true }));
  };

  const openEditDialog = (assignment: AssignmentDataItem) => {
    setFormState({
      dialogOpen: true,
      creating: false,
      editingAssignmentId: assignment.id,
      title: assignment.title,
      description: assignment.description ?? "",
      moduleCode: assignment.module_code ?? "",
      maxScore: String(assignment.max_score),
      dueDate: formatDueDateForInput(assignment.due_date),
      rubric: assignment.rubric ?? [],
      selectedCohorts: assignment.target_cohorts ?? [],
      selectedDepartments: assignment.target_departments ?? [],
      selectedTemplateId: "none",
    });
  };

  const applyStarterTemplate = (templateId: string) => {
    setFormState((current) => {
      if (templateId === "none") {
        if (!current.editingAssignmentId) {
          return {
            ...current,
            selectedTemplateId: "none",
            title: "",
            description: "",
            moduleCode: "",
            maxScore: "100",
            dueDate: "",
            rubric: [],
            selectedCohorts: [],
            selectedDepartments: [],
          };
        }

        return {
          ...current,
          selectedTemplateId: "none",
        };
      }

      const template = STARTER_ASSIGNMENT_TEMPLATES.find((entry) => entry.id === templateId);
      if (!template) return current;

      return {
        ...current,
        selectedTemplateId: templateId,
        title: template.template.title,
        description: template.template.description ?? "",
        moduleCode: template.template.moduleCode ?? "",
        maxScore: String(template.template.maxScore),
        dueDate: formatDueDateForInput(template.template.dueDate ?? null),
        rubric: template.template.rubric ?? [],
        selectedCohorts: template.template.targetCohorts ?? [],
        selectedDepartments: template.template.targetDepartments ?? [],
      };
    });
  };

  const toggleCohort = (value: string) => {
    setFormState((current) => ({
      ...current,
      selectedCohorts: current.selectedCohorts.includes(value)
        ? current.selectedCohorts.filter((entry) => entry !== value)
        : [...current.selectedCohorts, value],
    }));
  };

  const toggleDepartment = (value: string) => {
    setFormState((current) => ({
      ...current,
      selectedDepartments: current.selectedDepartments.includes(value)
        ? current.selectedDepartments.filter((entry) => entry !== value)
        : [...current.selectedDepartments, value],
    }));
  };

  const updateFormField = <Key extends keyof AssignmentFormState>(field: Key, value: AssignmentFormState[Key]) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSaveAssignment = async () => {
    if (!formState.title.trim() || !userId) {
      toast.error("Title is required");
      return;
    }

    setFormState((current) => ({ ...current, creating: true }));

    try {
      await saveAssignmentDraft({
        assignmentId: formState.editingAssignmentId,
        userId,
        title: formState.title,
        description: formState.description,
        moduleCode: formState.moduleCode,
        maxScore: formState.maxScore,
        dueDate: formState.dueDate,
        rubric: formState.rubric as RubricCriterion[],
        selectedCohorts: formState.selectedCohorts,
        selectedDepartments: formState.selectedDepartments,
      });

      toast.success(formState.editingAssignmentId ? "Assignment updated" : "Assignment created");
      resetAssignmentForm();
      refreshAssignments();
    } catch {
      toast.error(formState.editingAssignmentId ? "Failed to update assignment" : "Failed to create assignment");
      setFormState((current) => ({ ...current, creating: false }));
    }
  };

  const handlePublish = async (assignmentId: string) => {
    if (isDemo) {
      toast.info("Publishing disabled in demo mode");
      return;
    }

    const assignmentToPublish = assignments.find((assignment) => assignment.id === assignmentId);
    if (!assignmentToPublish) return;

    try {
      const publishFeedback = await publishAssignment({
        assignmentId,
        assignment: assignmentToPublish,
        shouldPersistNotifications: Boolean(userId),
      });

      if (publishFeedback.warnings.length > 0) {
        toast.warning(`Assignment published. ${publishFeedback.warnings.join("; ")}.`);
      } else {
        toast.success("Assignment published - students can now submit");
      }

      refreshAssignments();
    } catch {
      toast.error("Failed to publish");
    }
  };

  const handleSetAssignmentStatus = async (
    assignmentId: string,
    nextStatus: AssignmentDataItem["status"],
    successMessage: string,
    failureMessage: string,
  ) => {
    if (isDemo) {
      toast.info("Assignment status changes are disabled in demo mode");
      return;
    }

    try {
      await setAssignmentStatus(assignmentId, nextStatus);
      toast.success(successMessage);
      refreshAssignments();
    } catch {
      toast.error(failureMessage);
    }
  };

  const isPendingReviewView = assignmentSearchState.view === "needs-review";

  const sortedAssignments = useMemo(() => {
    const filteredAssignments = filterAssignments({
      assignments: assignments as AssignmentCatalogItem[],
      searchQuery,
      statusFilter,
      role,
      isPendingReviewView,
      submissionStats,
    }) as AssignmentDataItem[];

    return sortAssignmentsForView({
      assignments: filteredAssignments as AssignmentCatalogItem[],
      isPendingReviewView,
      submissionStats,
    }) as AssignmentDataItem[];
  }, [assignments, isPendingReviewView, role, searchQuery, statusFilter, submissionStats]);

  const overviewStats = useMemo(
    () => getAssignmentOverviewStats(assignments as AssignmentCatalogItem[]),
    [assignments],
  );

  const catalogReadiness = useMemo(
    () =>
      role === "lecturer"
        ? getLecturerAssignmentCatalogReadiness({
            assignments: assignments as AssignmentCatalogItem[],
            submissionStats,
          })
        : getStudentAssignmentCatalogReadiness({
            assignments: assignments as AssignmentCatalogItem[],
            studentWorkflow,
          }),
    [assignments, role, studentWorkflow, submissionStats],
  );

  const openAssignmentSearch = (nextStatus: "all" | AssignmentDataItem["status"]) => {
    setStatusFilter(nextStatus);
    const next = new URLSearchParams(searchParams);
    if (nextStatus === "all") next.delete("status");
    else next.set("status", nextStatus);
    setSearchParams(next);
  };

  const clearPendingReviewView = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("view");
    setSearchParams(next);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 || statusFilter !== "all" || isPendingReviewView;

  return {
    loading,
    role,
    isDemo,
    assignments,
    sortedAssignments,
    submissionStats,
    studentWorkflow,
    overviewStats,
    catalogReadiness,
    isPendingReviewView,
    hasActiveFilters,
    searchQuery,
    statusFilter,
    formState,
    summarizeSelection,
    getStudentAssignmentJourney,
    isStudentGradeVisible,
    normalizeAssignment,
    safeFormatDate,
    openCreateDialog,
    openEditDialog,
    applyStarterTemplate,
    toggleCohort,
    toggleDepartment,
    updateFormField,
    handleSaveAssignment,
    handlePublish,
    handleSetAssignmentStatus,
    openAssignmentSearch,
    clearPendingReviewView,
    resetAssignmentForm,
    resetFilters,
    setSearchQuery,
    setFormDialogOpen: (open: boolean) => updateFormField("dialogOpen", open),
    targetCohorts: ASSIGNMENT_TARGET_COHORTS,
    departments: ASSIGNMENT_TARGET_DEPARTMENTS,
  };
};
