import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Filter,
  MinusCircle,
  TrendingDown,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CohortSignalStudent } from "@/pages/cohortsignal-demo/demoData";

import { formatMark, hasInterventionLogged } from "./index";
import type { HeatmapRiskBandMeta } from "./index";

type TilesProps = {
  students: CohortSignalStudent[];
  riskBandMeta: HeatmapRiskBandMeta;
  onSelectStudent: (studentId: string) => void;
};

export const CohortSignalTilesSection = ({ students, riskBandMeta, onSelectStudent }: TilesProps) => {
  return (
    <section aria-labelledby="heatmap-grid" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="heatmap-grid" className="text-xl font-semibold tracking-tight">
            Student tiles
          </h2>
          <p className="text-sm text-muted-foreground">
            Color is paired with labels and icons, so the status is still readable without the heatmap palette.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.values(riskBandMeta).map((meta) => {
            const Icon = meta.icon;
            return (
              <Badge key={meta.label} variant="outline" className="gap-1.5 bg-background/70">
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
              </Badge>
            );
          })}
          <Badge variant="outline" className="gap-1.5 bg-background/70">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Intervention logged marker
          </Badge>
        </div>
      </div>

      {students.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {students.map((student) => {
            const meta = riskBandMeta[student.riskBand];
            const Icon = meta.icon;
            const logged = hasInterventionLogged(student.interventionLoggedAt);

            return (
              <button
                key={student.id}
                type="button"
                data-testid="student-tile"
                data-risk-band={student.riskBand}
                data-student-id={student.id}
                className={cn(
                  "group relative overflow-hidden rounded-3xl border p-4 text-left transition-all duration-200",
                  "hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "min-h-[190px]",
                  meta.className,
                )}
                aria-label={`${student.name}, ${meta.label}, ${formatMark(student.latestMark)} latest mark, ${formatMark(student.averageMark)} average mark${logged ? ", intervention logged" : ""}`}
                onClick={() => onSelectStudent(student.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/40 bg-background/70 text-sm font-semibold tracking-wider text-foreground shadow-sm">
                        {student.initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-none">{student.name}</p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-foreground/75">{meta.label}</p>
                      </div>
                    </div>
                  </div>
                  <Icon className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground/70">{student.module}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-2xl bg-background/70 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Latest</p>
                      <p className="mt-1 font-semibold">{formatMark(student.latestMark)}</p>
                    </div>
                    <div className="rounded-2xl bg-background/70 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Average</p>
                      <p className="mt-1 font-semibold">{formatMark(student.averageMark)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1.5 bg-background/70">
                    <TrendingDown className={cn("h-3.5 w-3.5", student.trend === "declining" ? "text-rose-600" : "text-muted-foreground")} />
                    {student.trend}
                  </Badge>
                  {logged ? (
                    <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-background/80 text-emerald-900">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Intervention logged
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1.5 bg-background/80">
                      <MinusCircle className="h-3.5 w-3.5" />
                      No intervention
                    </Badge>
                  )}
                  {student.predictedToFail ? (
                    <Badge variant="outline" className="gap-1.5 border-rose-500/30 bg-background/80 text-rose-900">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Likely to fail
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1.5 bg-background/80">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pass likely
                    </Badge>
                  )}
                  {student.missingSubmission ? (
                    <Badge variant="outline" className="gap-1.5 bg-background/80">
                      <Clock3 className="h-3.5 w-3.5" />
                      Missing submission
                    </Badge>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed border-primary/20 bg-background/70">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Filter className="h-6 w-6 text-muted-foreground" />
            <p className="text-base font-medium">No students match the selected filters.</p>
            <p className="max-w-md text-sm text-muted-foreground">Clear one or more filters to bring students back into view.</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
};
