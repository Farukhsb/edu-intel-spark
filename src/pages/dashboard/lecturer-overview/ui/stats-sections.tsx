import { AlertTriangle, BarChart3, CheckCircle, Clock, FileText, Target, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";

import type { LecturerOverviewStats, LecturerOverviewWorkflowTarget } from "../types";

export const LecturerOverviewPrimaryStatsSection = ({
  stats,
  primaryWorkflowTarget,
}: {
  stats: LecturerOverviewStats;
  primaryWorkflowTarget: LecturerOverviewWorkflowTarget | null;
}) => {
  const navigate = useNavigate();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        {
          icon: Users,
          value: stats.activeStudents,
          label: "Active Students",
          hint: "Students with submission activity",
          accent: "border-primary/20",
          iconWrap: "bg-primary/10 text-primary",
        },
        {
          icon: Clock,
          value: stats.pendingCount,
          label: "Awaiting Review",
          hint: "Needs lecturer attention",
          accent: stats.pendingCount > 0 ? "border-warning/30" : "border-border",
          iconWrap: stats.pendingCount > 0 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground",
        },
        {
          icon: BarChart3,
          value: stats.avgScore != null ? `${stats.avgScore}%` : "-",
          label: "Average Grade",
          hint: "Across graded submissions",
          accent: "border-border",
          iconWrap: "bg-muted text-muted-foreground",
        },
        {
          icon: AlertTriangle,
          value: stats.atRisk,
          label: "At-Risk Students",
          hint: "Students who may need support",
          accent: stats.atRisk > 0 ? "border-destructive/30" : "border-border",
          iconWrap: stats.atRisk > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
        },
      ].map((item, index) => {
        const isReviewCard = item.label === "Awaiting Review";
        const isRiskCard = item.label === "At-Risk Students";
        const clickable = isReviewCard || isRiskCard;

        return (
          <Card
            key={index}
            className={`border ${item.accent} shadow-sm ${clickable ? "cursor-pointer transition-colors hover:bg-muted/30" : ""}`}
            onClick={
              isReviewCard
                ? () => navigate(primaryWorkflowTarget?.href ?? "/dashboard/assignments?view=needs-review")
                : isRiskCard
                  ? () => navigate("/dashboard/performance?risk=high-plus&scoreBand=lt40")
                  : undefined
            }
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-3xl font-bold font-display">{item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.iconWrap}`}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export const LecturerOverviewSecondaryStatsSection = ({
  stats,
}: {
  stats: LecturerOverviewStats;
}) => (
  <div className="grid gap-4 md:grid-cols-3">
    {[
      {
        icon: FileText,
        value: stats.totalSubmissions,
        label: "Total Submissions",
        iconColor: "text-primary",
      },
      {
        icon: CheckCircle,
        value: stats.gradedCount,
        label: "Graded Submissions",
        iconColor: "text-success",
      },
      {
        icon: Target,
        value: stats.onTarget,
        label: "Students On Target",
        iconColor: "text-success",
      },
    ].map((item, index) => (
      <Card key={index} className="shadow-sm">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/70">
            <item.icon className={`h-5 w-5 ${item.iconColor}`} />
          </div>
          <div>
            <p className="text-xl font-bold font-display">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);
