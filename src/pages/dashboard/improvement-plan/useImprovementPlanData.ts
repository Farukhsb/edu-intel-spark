import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  buildPlanModules,
  buildResourceRecommendations,
  getOverallTaskSummary,
  type ImprovementPlanAssignmentLike,
  type PlanModule,
  type Resource,
} from "@/lib/improvementPlan";
import { log } from "@/lib/logger";
import { fetchStudentGradeProjection } from "@/lib/studentGradeProjection";

export const useImprovementPlanData = ({
  userId,
}: {
  userId: string | undefined;
}) => {
  const [plan, setPlan] = useState<PlanModule[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestPlanRef = useRef<PlanModule[]>([]);

  const fetchPlan = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [projectionRes, { data: progressRows }] = await Promise.all([
        fetchStudentGradeProjection(userId),
        supabase
          .from("improvement_plan_progress")
          .select("task_key, completed")
          .eq("student_id", userId),
      ]);

      if (projectionRes.error) {
        throw projectionRes.error;
      }

      if (!projectionRes.data || projectionRes.data.length === 0) {
        setPlan([]);
        setResources([]);
        latestPlanRef.current = [];
        setLoading(false);
        return;
      }

      const assignmentMap: Record<string, ImprovementPlanAssignmentLike> = {};
      projectionRes.data.forEach((row) => {
        if (!assignmentMap[row.assignment_id]) {
          assignmentMap[row.assignment_id] = {
            id: row.assignment_id,
            title: row.assignment_title ?? "Assignment title unavailable",
            module_code: row.module_code,
            max_score: row.max_score,
          };
        }
      });

      const taskOverrides = Object.fromEntries(
        (progressRows || []).map((row) => [row.task_key, row.completed]),
      ) as Record<string, boolean>;
      const nextPlan = buildPlanModules({
        submissions: projectionRes.data.map((row) => ({
          id: row.submission_id,
          assignment_id: row.assignment_id,
          submitted_at: row.submitted_at,
        })),
        grades: projectionRes.data.map((row) => ({
          submission_id: row.submission_id,
          final_score: row.final_score,
          ai_score: row.ai_score,
          ai_feedback: row.ai_feedback,
          ai_breakdown: row.ai_breakdown,
        })),
        assignmentMap,
        taskOverrides,
      });
      const nextResources = buildResourceRecommendations(nextPlan);

      setPlan(nextPlan);
      setResources(nextResources);
      latestPlanRef.current = nextPlan;
    } catch (error) {
      log.error("Failed to fetch improvement plan", error, {
        studentId: userId,
      });
      setError("Your improvement plan could not be loaded right now.");
      toast.error("Could not load your improvement plan.");
    }

    setLoading(false);
  };

  useEffect(() => {
    void fetchPlan();
  }, [userId]);

  useEffect(() => {
    latestPlanRef.current = plan;
  }, [plan]);

  const toggleTask = async (moduleName: string, taskId: string) => {
    const previousPlan = latestPlanRef.current;
    let nextCompleted = false;
    const nextPlan = previousPlan.map((module) =>
      module.module === moduleName
        ? {
            ...module,
            tasks: module.tasks.map((task) => {
              if (task.id !== taskId) return task;
              nextCompleted = !task.done;
              return { ...task, done: nextCompleted };
            }),
          }
        : module,
    );

    setPlan(nextPlan);
    latestPlanRef.current = nextPlan;

    if (!userId) {
      return;
    }

    const { error } = await supabase.from("improvement_plan_progress").upsert(
      {
        student_id: userId,
        task_key: taskId,
        completed: nextCompleted,
        completed_at: nextCompleted ? new Date().toISOString() : null,
      },
      { onConflict: "student_id,task_key" },
    );

    if (error) {
      log.error("Failed to save improvement task progress", error, {
        studentId: userId,
        taskId,
      });
      setPlan(previousPlan);
      latestPlanRef.current = previousPlan;
      toast.error("Could not save task progress.");
    }
  };

  const overallTasks = useMemo(() => getOverallTaskSummary(plan), [plan]);

  return {
    plan,
    resources,
    loading,
    error,
    overallTasks,
    toggleTask,
    refreshPlan: fetchPlan,
  };
};
