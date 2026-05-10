import { AlertTriangle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { LecturerOverviewStats, LecturerOverviewWorkflowTarget } from "../types";

export const LecturerOverviewAttentionNeededSection = ({
  stats,
  primaryWorkflowTarget,
}: {
  stats: LecturerOverviewStats;
  primaryWorkflowTarget: LecturerOverviewWorkflowTarget | null;
}) => {
  const navigate = useNavigate();

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Attention Needed</CardTitle>
        <CardDescription>Use these signals to prioritise your next actions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-warning/10 p-2 text-warning">
              <Clock className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{stats.pendingCount} submission{stats.pendingCount === 1 ? "" : "s"} awaiting review</p>
              <p className="text-xs text-muted-foreground">
                Prioritise pending work to keep feedback turnaround fast and consistent.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-destructive/10 p-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{stats.atRisk} student{stats.atRisk === 1 ? "" : "s"} may need support</p>
              <p className="text-xs text-muted-foreground">
                Review patterns early so interventions can happen before performance drops further.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => navigate(primaryWorkflowTarget?.href ?? "/dashboard/assignments?view=needs-review")}
          >
            {primaryWorkflowTarget?.label ?? "Review queue"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/dashboard/performance?risk=high-plus&scoreBand=lt40")}
          >
            Needs attention
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
