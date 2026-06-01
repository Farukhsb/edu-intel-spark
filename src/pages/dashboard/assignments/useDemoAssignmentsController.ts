import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

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

import { useDemoAssignmentsData } from "./useDemoAssignmentsData";
import type { AssignmentDataItem } from "./useAssignmentsData";
import type { AssignmentFormState } from "./types";

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

export const useDemoAssignmentsController = (role: string | null | undefined) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const assignmentSearchState = parseAssignmentsSearchState(searchParams);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AssignmentDataItem["status"]>("all");
  const [formState, setFormState] = useState<AssignmentFormState>(buildInitialFormState);
  const { assignments, submissionStats, studentWorkflow, loading, refreshAssignments } = useDemoAssignmentsData(role);

  useEffect(() => {
    setStatusFilter(assignmentSearchState.statusFilter);
  }, [assignmentSearchState.statusFilter]);

  const openCreateDialog = () => setFormState((current) => ({ ...current, dialogOpen: true }));
  const openEditDialog = (assignment: AssignmentCatalogItem) => {
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
      if (templateId === "none") return current;
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
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const handleSaveAssignment = async () => {
    refreshAssignments();
  };

  const openAssignmentSearch = (nextStatus: "all" | AssignmentCatalogItem["status"]) => {
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

  const isPendingReviewView = assignmentSearchState.view === "needs-review";
  const sortedAssignments = useMemo(() => {
    const filteredAssignments = filterAssignments({
      assignments: assignments as AssignmentCatalogItem[],
      searchQuery,
      statusFilter,
      role,
      isPendingReviewView,
      submissionStats,
    });
    return sortAssignmentsForView({
      assignments: filteredAssignments,
      isPendingReviewView,
      submissionStats,
    });
  }, [assignments, isPendingReviewView, role, searchQuery, statusFilter, submissionStats]);

  const overviewStats = useMemo(() => getAssignmentOverviewStats(assignments as AssignmentCatalogItem[]), [assignments]);
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

  const hasActiveFilters =
    searchQuery.trim().length > 0 || statusFilter !== "all" || isPendingReviewView;

  return {
    loading,
    role,
    isDemo: true,
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
    handlePublish: async () => undefined,
    handleSetAssignmentStatus: async () => undefined,
    openAssignmentSearch,
    clearPendingReviewView,
    resetAssignmentForm: () => setFormState(buildInitialFormState()),
    resetFilters,
    setSearchQuery,
    setFormDialogOpen: (open: boolean) => updateFormField("dialogOpen", open),
    targetCohorts: [
      { value: "100", label: "Level 100" },
      { value: "200", label: "Level 200" },
      { value: "300", label: "Level 300" },
      { value: "400", label: "Level 400" },
    ] as const,
    departments: [],
  };
};
