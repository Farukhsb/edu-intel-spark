import type { RubricCriterion } from "@/components/RubricBuilder";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  buildAssignmentPublishedNotifications,
  type AssignmentCatalogItem,
  type StudentNotificationProfile,
} from "@/lib/assignmentCatalog";
import { queueCommunicationMessage } from "@/lib/communications";
import { summarizeAssignmentPublishWorkflow, type AssignmentPublishWorkflowSummary } from "@/lib/assignmentPublishWorkflow";
import { log } from "@/lib/logger";
import type { AssignmentDataItem } from "@/pages/dashboard/assignments/useAssignmentsData";

const asJson = (value: unknown): Json => value as Json;

const loadAssignmentTargetIds = async (
  assignmentId: string,
): Promise<{ cohortIds: string[]; departmentIds: string[]; targetingLookupFailed: boolean }> => {
  const { data: assignmentTargets, error: assignmentTargetsError } = await supabase
    .from("assignment_cohorts")
    .select("cohort_id")
    .eq("assignment_id", assignmentId);
  const { data: assignmentDepartmentTargets, error: assignmentDepartmentTargetsError } = await supabase
    .from("assignment_departments")
    .select("department_id")
    .eq("assignment_id", assignmentId);

  if (assignmentTargetsError) {
    log.warn("Assignment publish target cohort lookup failed", {
      assignmentId,
    });
  }

  if (assignmentDepartmentTargetsError) {
    log.warn("Assignment publish target department lookup failed", {
      assignmentId,
    });
  }

  return {
    cohortIds: Array.from(
      new Set((assignmentTargets || []).map((target) => target.cohort_id).filter(Boolean)),
    ),
    departmentIds: Array.from(
      new Set((assignmentDepartmentTargets || []).map((target) => target.department_id).filter(Boolean)),
    ),
    targetingLookupFailed: Boolean(assignmentTargetsError || assignmentDepartmentTargetsError),
  };
};

const upsertAssignmentCohorts = async (assignmentId: string, cohortIds: string[]) => {
  const { error: deleteError } = await supabase
    .from("assignment_cohorts")
    .delete()
    .eq("assignment_id", assignmentId);

  if (deleteError) throw deleteError;

  if (cohortIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("assignment_cohorts")
    .insert(
      cohortIds.map((cohortId) => ({
        assignment_id: assignmentId,
        cohort_id: cohortId,
      })),
    );

  if (insertError) throw insertError;
};

const upsertAssignmentDepartments = async (assignmentId: string, departmentIds: string[]) => {
  const { error: deleteError } = await supabase
    .from("assignment_departments")
    .delete()
    .eq("assignment_id", assignmentId);

  if (deleteError) throw deleteError;

  if (departmentIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("assignment_departments")
    .insert(
      departmentIds.map((departmentId) => ({
        assignment_id: assignmentId,
        department_id: departmentId,
      })),
    );

  if (insertError) throw insertError;
};

export const saveAssignmentDraft = async ({
  assignmentId,
  userId,
  title,
  description,
  moduleCode,
  maxScore,
  dueDate,
  rubric,
  selectedCohorts,
  selectedDepartments,
}: {
  assignmentId: string | null;
  userId: string;
  title: string;
  description: string;
  moduleCode: string;
  maxScore: string;
  dueDate: string;
  rubric: RubricCriterion[];
  selectedCohorts: string[];
  selectedDepartments: string[];
}) => {
  if (assignmentId) {
    const { error } = await supabase
      .from("assignments")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        module_code: moduleCode.trim() || null,
        max_score: Number(maxScore) || 100,
        due_date: dueDate || null,
        rubric: rubric.length > 0 ? asJson(rubric) : null,
      })
      .eq("id", assignmentId);

    if (error) throw error;

    await upsertAssignmentCohorts(assignmentId, selectedCohorts);
    await upsertAssignmentDepartments(assignmentId, selectedDepartments);
    return;
  }

  const { data: assignmentRow, error } = await supabase
    .from("assignments")
    .insert([{
      title: title.trim(),
      description: description.trim() || null,
      module_code: moduleCode.trim() || null,
      max_score: Number(maxScore) || 100,
      due_date: dueDate || null,
      lecturer_id: userId,
      status: "draft" as const,
      rubric: rubric.length > 0 ? asJson(rubric) : null,
    }])
    .select("id")
    .single();

  if (error || !assignmentRow) throw error ?? new Error("Assignment creation failed");

  await Promise.all([
    upsertAssignmentCohorts(assignmentRow.id, selectedCohorts),
    upsertAssignmentDepartments(assignmentRow.id, selectedDepartments),
  ]);
};

export const publishAssignment = async ({
  assignmentId,
  assignment,
  shouldPersistNotifications,
}: {
  assignmentId: string;
  assignment: AssignmentDataItem;
  shouldPersistNotifications: boolean;
}) => {
  const { error } = await supabase.from("assignments").update({ status: "published" as const }).eq("id", assignmentId);
  if (error) throw error;

  const publishWorkflowSummary: AssignmentPublishWorkflowSummary = {
    targetingStatus: "ready",
    recipientStatus: "skipped",
    bellStatus: "skipped",
    emailStatus: "skipped",
  };

  if (!shouldPersistNotifications) {
    return summarizeAssignmentPublishWorkflow(publishWorkflowSummary);
  }

  const { cohortIds, departmentIds, targetingLookupFailed } = await loadAssignmentTargetIds(assignmentId);
  if (targetingLookupFailed) {
    publishWorkflowSummary.targetingStatus = "lookup_failed";
  }

  if (cohortIds.length === 0 && departmentIds.length === 0) {
    publishWorkflowSummary.targetingStatus = "missing";
    log.warn("Assignment publish notifications skipped because no targeting is stored", {
      assignmentId,
    });

    return summarizeAssignmentPublishWorkflow(publishWorkflowSummary);
  }

  try {
    let studentProfilesQuery = supabase
      .from("profiles")
      .select("id, full_name, email, role, cohort_id, department_id")
      .eq("role", "student");

    if (cohortIds.length > 0) {
      studentProfilesQuery = studentProfilesQuery.in("cohort_id", cohortIds);
    }

    if (departmentIds.length > 0) {
      studentProfilesQuery = studentProfilesQuery.in("department_id", departmentIds);
    }

    const { data: studentProfiles, error: studentProfilesError } = await studentProfilesQuery;

    if (studentProfilesError) {
      publishWorkflowSummary.recipientStatus = "failed";
      log.warn("Assignment publish bell notification load failed", {
        assignmentId,
      });
      return summarizeAssignmentPublishWorkflow(publishWorkflowSummary);
    }

    const notifications = buildAssignmentPublishedNotifications({
      assignmentId,
      assignmentTitle: assignment.title,
      students: (studentProfiles || []) as StudentNotificationProfile[],
    });

    if (notifications.length === 0) {
      publishWorkflowSummary.recipientStatus = "no_recipients";
      return summarizeAssignmentPublishWorkflow(publishWorkflowSummary);
    }

    const notificationResults = await Promise.allSettled(
      notifications.map((notification) => queueCommunicationMessage(notification)),
    );
    const persistedCount = notificationResults.filter(
      (result) => result.status === "fulfilled" && Boolean(result.value),
    ).length;

    publishWorkflowSummary.recipientStatus = "loaded";

    if (persistedCount === 0) {
      publishWorkflowSummary.bellStatus = "failed";
      log.warn("Assignment publish bell notifications did not persist", {
        assignmentId,
      });
      return summarizeAssignmentPublishWorkflow(publishWorkflowSummary);
    }

    publishWorkflowSummary.bellStatus = persistedCount === notifications.length ? "sent" : "failed";

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("gradeai:communications-updated"));
    }

    if (persistedCount !== notifications.length) {
      log.warn("Assignment publish bell notifications partially persisted", {
        assignmentId,
      });
    }
  } catch {
    publishWorkflowSummary.recipientStatus = "failed";
    log.warn("Assignment publish bell notifications failed", {
      assignmentId,
    });
  }

  return summarizeAssignmentPublishWorkflow(publishWorkflowSummary);
};

export const setAssignmentStatus = async (
  assignmentId: string,
  nextStatus: AssignmentDataItem["status"],
) => {
  const { error } = await supabase
    .from("assignments")
    .update({ status: nextStatus })
    .eq("id", assignmentId);

  if (error) throw error;
};
