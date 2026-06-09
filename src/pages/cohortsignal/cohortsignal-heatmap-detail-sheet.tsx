import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CohortSignalStudent } from "@/pages/cohortsignal-demo/demoData";

import { formatMark, hasInterventionLogged } from "./index";

type DetailSheetProps = {
  selectedStudent: CohortSignalStudent | null;
  selectedBandMeta: { label: string; icon: ComponentType<{ className?: string }> } | null;
  readOnly: boolean;
  isLoggingIntervention: boolean;
  onClose: (open: boolean) => void;
  onLogIntervention: () => void;
};

export const CohortSignalDetailSheet = ({
  selectedStudent,
  selectedBandMeta,
  readOnly,
  isLoggingIntervention,
  onClose,
  onLogIntervention,
}: DetailSheetProps) => {
  return (
    <Sheet
      open={Boolean(selectedStudent)}
      onOpenChange={(open) => {
        onClose(open);
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {selectedStudent ? (
          <div className="space-y-6 pt-8">
            <SheetHeader className="space-y-2 text-left">
              <Badge variant="secondary" className="w-fit gap-1.5">
                {selectedBandMeta?.icon ? <selectedBandMeta.icon className="h-3.5 w-3.5" /> : null}
                {selectedBandMeta?.label}
              </Badge>
              <SheetTitle className="text-2xl">{selectedStudent.name}</SheetTitle>
              <SheetDescription>
                {selectedStudent.module} | confidence {selectedStudent.confidence}% | trend {selectedStudent.trend}
              </SheetDescription>
            </SheetHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Latest mark", value: formatMark(selectedStudent.latestMark) },
                { label: "Average mark", value: formatMark(selectedStudent.averageMark) },
                { label: "Risk band", value: selectedBandMeta?.label ?? "Unknown" },
                { label: "Confidence", value: `${selectedStudent.confidence}%` },
                {
                  label: "Failure prediction",
                  value: selectedStudent.predictedToFail ? "Likely to fail" : "Not currently predicted to fail",
                },
                { label: "Failure probability", value: `${selectedStudent.failProbability}%` },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Risk reasons</p>
              <ul className="space-y-2">
                {selectedStudent.riskReasons.map((reason) => (
                  <li key={reason} className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggested action</p>
              <p className="text-sm leading-6">{selectedStudent.suggestedAction}</p>
            </div>

            <div className="space-y-2 rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Intervention status</p>
              <p className="text-sm leading-6">
                {hasInterventionLogged(selectedStudent.interventionLoggedAt)
                  ? `Intervention logged on ${new Date(selectedStudent.interventionLoggedAt ?? "").toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}.`
                  : "No intervention has been logged for this student yet."}
              </p>
            </div>

            {readOnly ? (
              <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                Admin oversight is read-only. Lecturers can log interventions from their dashboard view.
              </div>
            ) : (
              <Button onClick={onLogIntervention} className="w-full" disabled={isLoggingIntervention || hasInterventionLogged(selectedStudent.interventionLoggedAt)}>
                {isLoggingIntervention
                  ? "Logging intervention..."
                  : hasInterventionLogged(selectedStudent.interventionLoggedAt)
                    ? "Intervention already logged"
                    : "Log Intervention"}
              </Button>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};
