import type { ImprovementPlanReadiness, PlanModule, Resource } from "@/lib/improvementPlanTypes";

export const getOverallTaskSummary = (plan: PlanModule[]) => {
  const allTasks = plan.flatMap((module) => module.tasks);
  const completed = allTasks.filter((task) => task.done).length;

  return {
    total: allTasks.length,
    completed,
    progress: allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0,
  };
};

export const getImprovementPlanReadiness = ({
  plan,
  resources,
  overallTasks,
}: {
  plan: PlanModule[];
  resources: Resource[];
  overallTasks: { total: number; completed: number; progress: number };
}): ImprovementPlanReadiness => {
  const firstOpenTaskEntry =
    plan
      .flatMap((module) => module.tasks.filter((task) => !task.done).map((task) => ({ module: module.module, task })))
      .at(0) ?? null;
  const firstPriorityResource = resources[0] ?? null;

  if (firstPriorityResource && firstOpenTaskEntry) {
    return {
      postureLabel: "You have active improvement work",
      likelyChallenge: `${firstPriorityResource.heading} is still the highest-priority improvement area`,
      bestNextAction: `Complete ${firstOpenTaskEntry.task.task} before the next submission window`,
    };
  }

  if (plan.length > 0 && overallTasks.total > 0 && overallTasks.completed === overallTasks.total) {
    return {
      postureLabel: "You have completed the current tasks",
      likelyChallenge: firstPriorityResource
        ? `${firstPriorityResource.heading} still needs to stay visible in your next piece of work`
        : "Your recent support tasks are complete, but the next submission still needs deliberate follow-through",
      bestNextAction: "Carry the strongest improvement points into your next submission instead of starting from scratch",
    };
  }

  return {
    postureLabel: "No active improvement tasks yet",
    likelyChallenge: "No personalised improvement tasks are active yet",
    bestNextAction: "Receive released feedback first so the platform can build a focused support plan",
  };
};
