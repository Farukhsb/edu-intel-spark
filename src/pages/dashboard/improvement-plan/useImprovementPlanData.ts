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

const DEMO_PLAN: PlanModule[] = [
  {
    module: "CS301 - Data Structures",
    currentGrade: 61,
    targetGrade: 70,
    guidanceMode: "future",
    trend: "up",
    trendDelta: 9,
    strengths: ["Code Quality", "Tree Traversal Accuracy"],
    weaknesses: ["Complexity Analysis", "Test Coverage"],
    nextSubmissionFocus: [
      "Show time and space complexity explicitly for each major function.",
      "Add edge-case tests for empty, single-node, and unbalanced trees.",
    ],
    tasks: [
      { id: "demo-ds-1", task: "Complete Big-O analysis worksheet", area: "Complexity Analysis", done: false },
      { id: "demo-ds-2", task: "Write 5 extra edge-case tests", area: "Test Coverage", done: false },
      { id: "demo-ds-3", task: "Review lecturer feedback before next lab", area: "Feedback", done: true },
    ],
    weakCriteria: [
      { criterion: "Complexity Analysis", average: 54, attempts: 3 },
      { criterion: "Test Coverage", average: 58, attempts: 2 },
    ],
    chart: [
      { assessment: "A1", score: 54 },
      { assessment: "Quiz", score: 58 },
      { assessment: "Lab", score: 61 },
      { assessment: "A2", score: 63 },
    ],
  },
  {
    module: "CS205 - Algorithms",
    currentGrade: 66,
    targetGrade: 72,
    guidanceMode: "future",
    trend: "down",
    trendDelta: -6,
    strengths: ["Problem Framing", "Presentation"],
    weaknesses: ["Efficiency", "Dynamic Programming Structure"],
    nextSubmissionFocus: [
      "State the recurrence relation before coding the solution.",
      "Compare brute-force and optimized complexity in the write-up.",
    ],
    tasks: [
      { id: "demo-algo-1", task: "Solve 3 dynamic programming exercises", area: "Dynamic Programming Structure", done: false },
      { id: "demo-algo-2", task: "Create a complexity comparison sheet", area: "Efficiency", done: true },
    ],
    weakCriteria: [
      { criterion: "Dynamic Programming Structure", average: 59, attempts: 3 },
      { criterion: "Efficiency", average: 63, attempts: 2 },
    ],
    chart: [
      { assessment: "A1", score: 71 },
      { assessment: "Midterm", score: 68 },
      { assessment: "A2", score: 66 },
      { assessment: "Lab", score: 65 },
    ],
  },
];

const DEMO_RESOURCES: Resource[] = buildResourceRecommendations(DEMO_PLAN);

export const useImprovementPlanData = ({
  userId,
  isDemo,
}: {
  userId: string | undefined;
  isDemo: boolean;
}) => {
  const [plan, setPlan] = useState<PlanModule[]>(isDemo ? DEMO_PLAN : []);
  const [resources, setResources] = useState<Resource[]>(isDemo ? DEMO_RESOURCES : []);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);
  const latestPlanRef = useRef<PlanModule[]>(isDemo ? DEMO_PLAN : []);

  const fetchPlan = async () => {
    if (isDemo) {
      setError(null);
      setPlan(DEMO_PLAN);
      setResources(DEMO_RESOURCES);
      latestPlanRef.current = DEMO_PLAN;
      setLoading(false);
      return;
    }

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
  }, [userId, isDemo]);

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

    if (isDemo || !userId) {
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
