import { AlertTriangle, ArrowRight, Clock3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LecturerOverviewReadiness } from "@/lib/lecturerOverviewReadiness";

import type { LecturerOverviewQueueFocus, LecturerOverviewStats, LecturerOverviewWorkflowTarget } from "../types";

const getAttentionNowLabel = (stats: LecturerOverviewStats, readiness: LecturerOverviewReadiness) => {
  if (stats.pendingCount > 0) {
    return `${stats.pendingCount} submission${stats.pendingCount === 1 ? "" : "s"} need review`;
  }

  if (stats.atRisk > 0) {
    return `${stats.atRisk} student${stats.atRisk === 1 ? "" : "s"} need support`;
  }

  return readiness.postureLabel;
};

export const LecturerOverviewActionCardSection = ({
  stats,
  readiness,
  primaryWorkflowTarget,
  queueFocus,
}: {
  stats: LecturerOverviewStats;
  readiness: LecturerOverviewReadiness;
  primaryWorkflowTarget: LecturerOverviewWorkflowTarget | null;
  queueFocus: LecturerOverviewQueueFocus;
}) => {
  const navigate = useNavigate();
  const actionHref =
    stats.pendingCount > 0
      ? (primaryWorkflowTarget?.href ?? "/dashboard/assignments?view=needs-review")
      : stats.atRisk > 0
        ? "/dashboard/performance?risk=high-plus&scoreBand=lt40"
        : "/dashboard/assignments";
  const actionLabel =
    stats.pendingCount > 0
      ? (primaryWorkflowTarget?.label ?? "Open review queue")
      : stats.atRisk > 0
        ? "Open risk insights"
        : "Open assignments";

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background shadow-sm">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-background/80">
                Priority today
              </Badge>
              {stats.pendingCount > 0 ? (
                <Badge variant="outline" className="border-warning/30 bg-warning/5 text-warning">
                  Review queue active
                </Badge>
              ) : stats.atRisk > 0 ? (
                <Badge variant="outline" className="border-destructive/30 bg-destructive/5 text-destructive">
                  Student support needed
                </Badge>
              ) : (
                <Badge variant="outline" className="border-success/30 bg-success/5 text-success">
                  No immediate blocker
                </Badge>
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold font-display">{getAttentionNowLabel(stats, readiness)}</h3>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="shadow-sm" onClick={() => navigate(actionHref)}>
              {actionLabel}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border bg-background/80 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                <Clock3 className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {stats.pendingCount > 0
                    ? "Current pressure point"
                    : stats.atRisk > 0
                      ? "Support focus"
                      : "Teaching focus"}
                </p>
                <p className="text-sm font-semibold">{queueFocus.label}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-background/80 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-warning/10 p-2 text-warning">
                {stats.atRisk > 0 ? <AlertTriangle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {stats.pendingCount > 0
                    ? "Top backlog"
                    : "Next move"}
                </p>
                {stats.pendingCount > 0 ? (
                  <>
                    <p className="text-sm font-semibold">{queueFocus.detail}</p>
                  </>
                ) : (
                  <p className="text-sm font-semibold">{readiness.bestNextAction}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
