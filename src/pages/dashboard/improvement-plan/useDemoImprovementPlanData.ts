import { useEffect, useMemo, useRef, useState } from "react";
import { buildResourceRecommendations, getOverallTaskSummary, type PlanModule, type Resource } from "@/lib/improvementPlan";
import { DEMO_PLAN, DEMO_RESOURCES } from "./demoData";

export const useDemoImprovementPlanData = () => {
  const [plan, setPlan] = useState<PlanModule[]>(DEMO_PLAN);
  const [resources, setResources] = useState<Resource[]>(DEMO_RESOURCES);
  const [loading, setLoading] = useState(false);
  const [error] = useState<string | null>(null);
  const latestPlanRef = useRef<PlanModule[]>(DEMO_PLAN);

  const fetchPlan = async () => {
    setPlan(DEMO_PLAN);
    setResources(DEMO_RESOURCES);
    latestPlanRef.current = DEMO_PLAN;
    setLoading(false);
  };

  useEffect(() => {
    void fetchPlan();
  }, []);

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
    setResources(buildResourceRecommendations(nextPlan));
    latestPlanRef.current = nextPlan;
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
