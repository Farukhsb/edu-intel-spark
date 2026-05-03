import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Circle } from "lucide-react";
import {
  DashboardDemoBanner,
  DashboardEmptyState,
  DashboardLoadingState,
  DashboardPageIntro,
} from "@/components/dashboard/PageStates";
import { useAuth } from "@/contexts/AuthContext";
import { safeFormatDate } from "@/lib/date";
import type { CommunicationMessage } from "@/lib/communications";
import { getImprovementPlanReadiness, type PlanModule } from "@/lib/improvementPlan";
import {
  ImprovementPlanModuleCard,
  ImprovementPlanOverview,
  ImprovementPlanResourcesSection,
} from "@/pages/dashboard/improvement-plan/sections";
import { useImprovementPlanData } from "@/pages/dashboard/improvement-plan/useImprovementPlanData";

const ImprovementPlan = () => {
  const location = useLocation();
  const { user, isDemo } = useAuth();
  const [expandedCompletedModules, setExpandedCompletedModules] = useState<Record<string, boolean>>({});
  const [expandedCompletedCards, setExpandedCompletedCards] = useState<Record<string, boolean>>({});
  const notification = (location.state as { notification?: CommunicationMessage } | null)?.notification;
  const { plan, resources, loading, overallTasks, toggleTask } = useImprovementPlanData({
    userId: user?.id,
    isDemo,
  });
  const supportNotification =
    notification?.category === "at-risk-alert" || notification?.category === "intervention-follow-up"
      ? notification
      : null;
  const firstOpenTaskEntry =
    plan
      .flatMap((module) => module.tasks.filter((task) => !task.done).map((task) => ({ module: module.module, task })))
      .at(0) ?? null;
  const firstPriorityResource = resources[0] ?? null;
  const readiness = getImprovementPlanReadiness({
    plan,
    resources,
    overallTasks,
  });

  const toggleCompletedSection = (moduleName: string) => {
    setExpandedCompletedModules((current) => ({
      ...current,
      [moduleName]: !current[moduleName],
    }));
  };

  const toggleCompletedCard = (moduleName: string) => {
    setExpandedCompletedCards((current) => ({
      ...current,
      [moduleName]: !current[moduleName],
    }));
  };

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (plan.length === 0) {
    return (
      <DashboardEmptyState
        title="No improvement plan yet"
        description="Submit and receive graded work to unlock a personalised improvement journey."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {notification && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex gap-3 p-4">
            <Bell className="mt-0.5 h-4 w-4 text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-medium">{notification.subject}</p>
              <p className="text-xs text-muted-foreground">
                {safeFormatDate(notification.createdAt, "MMM d, yyyy HH:mm")}
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notification.body}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {supportNotification && (firstPriorityResource || firstOpenTaskEntry) && (
        <Card data-testid="improvement-plan-notice-focus" className="border-primary/20 bg-background shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {supportNotification.category === "at-risk-alert" ? "At-risk support" : "Follow-up support"}
              </Badge>
              <CardTitle className="text-base">Opened from support notice</CardTitle>
            </div>
            <CardDescription>
              Start with the highest-priority fix below, then complete the first open task before your next submission window.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {firstPriorityResource && (
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Start Here</p>
                <p className="mt-2 text-sm font-semibold">
                  Priority {firstPriorityResource.priority} - {firstPriorityResource.heading}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{firstPriorityResource.estimatedLift} | {firstPriorityResource.duration}</p>
                {firstPriorityResource.actionItems[0] && (
                  <p className="mt-3 text-sm">{firstPriorityResource.actionItems[0]}</p>
                )}
              </div>
            )}
            {firstOpenTaskEntry && (
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">First Open Task</p>
                <p className="mt-2 text-sm font-semibold">{firstOpenTaskEntry.task.task}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {firstOpenTaskEntry.module} | {firstOpenTaskEntry.task.area}
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    document.getElementById("best-next-moves")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Review best next moves
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isDemo && (
        <DashboardDemoBanner label="Viewing demo improvement plan data" />
      )}

      <DashboardPageIntro
        eyebrow="Personalised study support"
        title="Improvement Plan"
        description="Focus first on the weakest criteria from your released work, track what you have already completed, and keep the next submission priorities visible."
      />

      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="grid gap-4 p-6 md:grid-cols-3">
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reporting Readiness</p>
            <p className="mt-2 text-sm font-semibold">{readiness.postureLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Based on your current support tasks, recurring weak criteria, and recommended next moves.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely challenge</p>
            <p className="mt-2 text-sm font-semibold">{readiness.likelyChallenge}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This is the improvement area most likely to matter before your next submission.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next action</p>
            <p className="mt-2 text-sm font-semibold">{readiness.bestNextAction}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use this as your immediate study step instead of trying to fix every weak area at once.
            </p>
          </div>
        </CardContent>
      </Card>

      <ImprovementPlanOverview
        modulesCount={plan.length}
        completed={overallTasks.completed}
        total={overallTasks.total}
        progress={overallTasks.progress}
      />

      {plan.map((module) => {
        const isCompletedSectionExpanded = expandedCompletedModules[module.module] ?? false;
        const isCompletedCardExpanded = expandedCompletedCards[module.module] ?? false;

        return (
          <ImprovementPlanModuleCard
            key={module.module}
            module={module}
            expandedCompletedCard={isCompletedCardExpanded}
            expandedCompletedSection={isCompletedSectionExpanded}
            onToggleCompletedCard={toggleCompletedCard}
            onToggleCompletedSection={toggleCompletedSection}
            onToggleTask={toggleTask}
          />
        );
      })}

      <ImprovementPlanResourcesSection resources={resources} />
    </div>
  );
};

export default ImprovementPlan;
