import { ArrowRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { LecturerOverviewPipelineStage } from "../types";

export const LecturerOverviewWorkflowPipelineSection = ({
  pipeline,
}: {
  pipeline: LecturerOverviewPipelineStage[];
}) => (
  <Card className="shadow-sm">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">Workflow pipeline</CardTitle>
      <CardDescription>Track submissions from intake to release.</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        {pipeline.map((stage, index) => (
          <div key={stage.label} className="flex items-center gap-3">
            <div className="min-w-0 flex-1 rounded-xl border bg-muted/20 p-4" data-testid={`pipeline-stage-${stage.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stage.label}</p>
              <p className="mt-2 text-3xl font-bold font-display" data-testid={`pipeline-count-${stage.label.toLowerCase().replace(/\s+/g, "-")}`}>
                {stage.count}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{stage.detail}</p>
            </div>
            {index < pipeline.length - 1 ? (
              <div className="hidden text-muted-foreground/60 lg:block">
                <ArrowRight className="h-4 w-4" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);
