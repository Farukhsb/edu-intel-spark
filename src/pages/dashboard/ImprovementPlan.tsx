import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Circle } from "lucide-react";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingState,
} from "@/components/dashboard/PageStates";
import { useAuth } from "@/contexts/AuthContext";
import { safeFormatDate } from "@/lib/date";
import type { CommunicationMessage } from "@/lib/communications";
import { getImprovementPlanReadiness } from "@/lib/improvementPlan";
import {
  ImprovementPlanHero,
  InlineProgressBar,
  ImprovementPlanModuleCard,
  ImprovementPlanResourcesSection,
} from "@/pages/dashboard/improvement-plan/sections";
import { useImprovementPlanData } from "@/pages/dashboard/improvement-plan/useImprovementPlanData";

const ImprovementPlan = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [expandedCompletedModules, setExpandedCompletedModules] = useState<Record<string, boolean>>({});
  const [expandedCompletedCards, setExpandedCompletedCards] = useState<Record<string, boolean>>({});
  const [activeWorkspaceView, setActiveWorkspaceView] = useState<"modules" | "completed" | "open">("modules");
  const notification = (location.state as { notification?: CommunicationMessage } | null)?.notification;
  const { plan, resources, loading, error, overallTasks, toggleTask, refreshPlan } = useImprovementPlanData({
    userId: user?.id,
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
  const activePlan = plan.filter((module) => module.tasks.some((task) => !task.done));
  const modulesWithCompletedTasks = plan.filter((module) => module.tasks.some((task) => task.done));
  const activeModuleNames = new Set(activePlan.map((module) => module.module));
  const activeResources = resources.filter((resource) => activeModuleNames.has(resource.module));
  const firstModuleWithCompletedTasks = modulesWithCompletedTasks[0] ?? null;
  const modulesForCurrentView =
    activeWorkspaceView === "completed"
      ? modulesWithCompletedTasks
      : activeWorkspaceView === "open"
        ? activePlan.filter((module) => module.tasks.some((task) => !task.done))
        : activePlan;
  const viewContent = {
    modules: {
      title: "Module plans",
      description: "Review the active modules that still need attention before your next submission.",
      emptyTitle: "No active module plans",
      emptyDescription: "New module plans will appear here when released results create a fresh improvement signal.",
    },
    completed: {
      title: "Completed steps",
      description: "Review the steps you have already marked as done so you can carry that progress forward.",
      emptyTitle: "No completed steps yet",
      emptyDescription: "Completed steps will appear here after you mark a support step as done.",
    },
    open: {
      title: "Open steps",
      description: "Focus on the support steps that still need attention before your next submission.",
      emptyTitle: "No open steps remain",
      emptyDescription: "You have cleared the current open steps in this workspace.",
    },
  }[activeWorkspaceView];

  const showModules = () => {
    setActiveWorkspaceView("modules");
  };

  const showCompletedTasks = () => {
    setActiveWorkspaceView("completed");
    setExpandedCompletedModules(
      Object.fromEntries(
        modulesWithCompletedTasks.map((module) => [module.module, true]),
      ),
    );
    if (firstModuleWithCompletedTasks) {
      setExpandedCompletedCards((current) => ({
        ...current,
        [firstModuleWithCompletedTasks.module]: true,
      }));
    }
  };

  const showOpenTasks = () => {
    setActiveWorkspaceView("open");
  };

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

  if (error) {
    return (
      <DashboardErrorState
        title="Support plan unavailable"
        description={error}
        action={
          <Button variant="outline" onClick={() => void refreshPlan()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (plan.length === 0) {
    return (
      <DashboardEmptyState
        title="No support plan yet"
        description="Submit and receive graded work to unlock a personalised support journey."
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
              Start with the highest-priority support step below, then complete the first open step before your next submission window.
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
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">First Open Step</p>
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
                  Review support plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ImprovementPlanHero
        module={activePlan[0] ?? null}
        readiness={readiness}
        modulesCount={plan.length}
        completed={overallTasks.completed}
        total={overallTasks.total}
        activeView={activeWorkspaceView}
        onViewModules={showModules}
        onViewCompletedTasks={showCompletedTasks}
      />

      {overallTasks.completed > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">Progress you have already made</p>
              <p className="text-sm text-muted-foreground">
                You have completed {overallTasks.completed} of {overallTasks.total} step{overallTasks.total === 1 ? "" : "s"} so far. Keep that progress visible while you work through what is still open.
              </p>
            </div>
            <div className="min-w-[180px] space-y-2">
              <p className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {overallTasks.completed} of {overallTasks.total} steps complete
              </p>
              <InlineProgressBar value={overallTasks.progress} className="h-2 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed bg-muted/20">
        <CardContent className="flex flex-col gap-3 p-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">Current view:</span>
            <Badge variant="secondary">
              {activeWorkspaceView === "modules"
                ? "Modules"
                : activeWorkspaceView === "completed"
                ? "Completed steps"
                : "Open steps"}
            </Badge>
            <span>
              {activeWorkspaceView === "modules"
                ? "Browse each active module plan."
                : activeWorkspaceView === "completed"
                  ? "Showing modules that contain completed steps."
                  : "Showing modules with open steps that still need attention."}
            </span>
          </div>
          <div className="min-w-[220px] space-y-2" data-testid="workspace-progress-indicator">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Overall progress</span>
              <span>
                {overallTasks.completed} of {overallTasks.total} steps complete
              </span>
            </div>
            <InlineProgressBar value={overallTasks.progress} className="h-2 w-full" />
          </div>
        </CardContent>
      </Card>

      <Card id="improvement-workspace-view">
        <CardHeader>
          <CardTitle className="text-base">{viewContent.title}</CardTitle>
          <CardDescription>{viewContent.description}</CardDescription>
        </CardHeader>
      </Card>

      {modulesForCurrentView.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">{viewContent.emptyTitle}</CardTitle>
            <CardDescription>{viewContent.emptyDescription}</CardDescription>
          </CardHeader>
        </Card>
      ) : modulesForCurrentView.map((module) => {
        const isCompletedSectionExpanded = expandedCompletedModules[module.module] ?? false;
        const isCompletedCardExpanded = expandedCompletedCards[module.module] ?? false;

        return (
          <ImprovementPlanModuleCard
            key={module.module}
            module={module}
            expandedCompletedCard={isCompletedCardExpanded}
            expandedCompletedSection={activeWorkspaceView === "completed" ? true : isCompletedSectionExpanded}
            onToggleCompletedCard={toggleCompletedCard}
            onToggleCompletedSection={toggleCompletedSection}
            onToggleTask={toggleTask}
          />
        );
      })}

      {activeWorkspaceView !== "completed" && modulesForCurrentView.length > 0 ? (
        <ImprovementPlanResourcesSection resources={activeResources} />
      ) : null}
    </div>
  );
};

export default ImprovementPlan;
