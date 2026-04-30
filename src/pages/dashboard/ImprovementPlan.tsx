import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { PlanModule } from "@/lib/improvementPlan";
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

      {isDemo && (
        <DashboardDemoBanner label="Viewing demo improvement plan data" />
      )}

      <DashboardPageIntro
        eyebrow="Personalised study support"
        title="Improvement Plan"
        description="Focus first on the weakest criteria from your released work, track what you have already completed, and keep the next submission priorities visible."
      />

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
