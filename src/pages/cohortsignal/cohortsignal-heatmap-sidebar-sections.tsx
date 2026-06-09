import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatPct } from "./index";
import type { HeatmapBandReport, HeatmapFailureReport } from "./index";

type SidebarProps = {
  isDemo: boolean;
  introText: string;
  overviewBullets: string[];
  modelQualityDescription: string;
  bandReport: HeatmapBandReport;
  failureReport: HeatmapFailureReport;
};

export const CohortSignalSidebarSections = ({
  isDemo,
  introText,
  overviewBullets,
  modelQualityDescription,
  bandReport,
  failureReport,
}: SidebarProps) => {
  return (
    <aside className="space-y-4">
      <Card className="border-primary/10 bg-card/90 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">{isDemo ? "What this demo shows" : "What this system shows"}</CardTitle>
          <p className="text-sm text-muted-foreground">{introText}</p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {overviewBullets.map((line) => (
            <p key={line}>• {line}</p>
          ))}
        </CardContent>
      </Card>

      <Card className="border-primary/10 bg-card/90 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Model quality</CardTitle>
          <p className="text-sm text-muted-foreground">{modelQualityDescription}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Risk band holdout", value: formatPct(bandReport.holdoutAccuracy) },
              { label: "Risk band CV", value: formatPct(bandReport.crossValidation.accuracy) },
              { label: "Fail holdout", value: formatPct(failureReport.holdoutAccuracy) },
              { label: "Fail CV", value: formatPct(failureReport.crossValidation.accuracy) },
              { label: "Fail precision", value: formatPct(failureReport.precision) },
              { label: "Fail recall", value: formatPct(failureReport.recall) },
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-lg font-semibold">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-2xl border bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fail confusion matrix</p>
            <div className="grid grid-cols-[1.1fr_repeat(2,minmax(0,1fr))] gap-2 text-sm">
              <div />
              <div className="rounded-xl bg-background/70 px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Predicted pass
              </div>
              <div className="rounded-xl bg-background/70 px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Predicted fail
              </div>
              <div className="rounded-xl bg-background/70 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Actual pass
              </div>
              <div className="rounded-xl bg-background/70 px-3 py-2 text-center font-semibold">
                {failureReport.confusionMatrix.trueNegatives}
              </div>
              <div className="rounded-xl bg-background/70 px-3 py-2 text-center font-semibold">
                {failureReport.confusionMatrix.falsePositives}
              </div>
              <div className="rounded-xl bg-background/70 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Actual fail
              </div>
              <div className="rounded-xl bg-background/70 px-3 py-2 text-center font-semibold">
                {failureReport.confusionMatrix.falseNegatives}
              </div>
              <div className="rounded-xl bg-background/70 px-3 py-2 text-center font-semibold">
                {failureReport.confusionMatrix.truePositives}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
};
