import { Download, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CriterionBars } from "@/components/dashboard/CriterionBars";

type GradeBreakdownComponent = {
  name: string;
  weight: number;
  score: number;
  maxScore: number;
};

type SelectedGrade = {
  fileUrl: string | null;
  feedback: string | null;
  breakdown: Array<{
    criterion: string;
    score: number;
    max_score: number;
    feedback?: string;
    comment?: string;
  }> | null;
};

type BreakdownProps = {
  assessment: string;
  totalGrade: number;
  band: string;
  components: GradeBreakdownComponent[];
  improvementAreas: { area: string; nextBand: string; pointsNeeded: number; tips: string[] }[];
  readinessBestNextAction: string;
  primaryStrengthName: string | null;
  selectedGrade: SelectedGrade;
  selectedDownloadError: string | null;
  onDownloadSubmission: () => void;
};

export const GradeBreakdown = ({
  assessment,
  totalGrade,
  band,
  components,
  improvementAreas,
  readinessBestNextAction,
  primaryStrengthName,
  selectedGrade,
  selectedDownloadError,
  onDownloadSubmission,
}: BreakdownProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Grade Breakdown</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">{assessment}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-4xl font-bold font-display">{totalGrade}%</span>
          <Badge>{band}</Badge>
          <Badge variant="outline">Released grade</Badge>
          {selectedGrade.fileUrl ? (
            <Button variant="outline" size="sm" className="ml-auto" onClick={onDownloadSubmission}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download submission
            </Button>
          ) : null}
        </div>

        {selectedDownloadError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {selectedDownloadError}
          </div>
        ) : null}

        <CriterionBars
          items={components.map((component) => {
            const rawBreakdownItem = selectedGrade.breakdown?.find((item) => item.criterion === component.name);

            return {
              criterion: component.name,
              score: rawBreakdownItem ? rawBreakdownItem.score : component.score,
              maxScore: rawBreakdownItem ? rawBreakdownItem.max_score : 100,
              weightPercent: component.weight,
              detail:
                rawBreakdownItem?.feedback ??
                rawBreakdownItem?.comment ??
                "No criterion-level commentary was provided for this part of the rubric.",
            };
          })}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border bg-background p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Strongest Areas</p>
            <div className="mt-2 space-y-1">
              {[...components]
                .sort((left, right) => right.score - left.score)
                .slice(0, 2)
                .map((item) => (
                  <p key={item.name} className="text-sm">
                    {item.name} <span className="text-muted-foreground">({item.score}%)</span>
                  </p>
                ))}
            </div>
          </div>
          <div className="rounded-xl border bg-background p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Focus Areas</p>
            <div className="mt-2 space-y-1">
              {[...components]
                .sort((left, right) => left.score - right.score)
                .slice(0, 2)
                .map((item) => (
                  <p key={item.name} className="text-sm">
                    {item.name} <span className="text-muted-foreground">({item.score}%)</span>
                  </p>
                ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Best Improvement Route</p>
          </div>
          {improvementAreas[0] ? (
            <>
              <p className="mt-3 text-sm font-medium">{improvementAreas[0].area}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                +{improvementAreas[0].pointsNeeded} points to move toward {improvementAreas[0].nextBand}
              </p>
              <p className="mt-3 text-sm">{readinessBestNextAction}</p>
              <div className="mt-3 space-y-2">
                {improvementAreas[0].tips.slice(0, 3).map((tip) => (
                  <div key={tip} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {tip}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm">
              {primaryStrengthName
                ? `${primaryStrengthName} is currently your clearest strength. Keep it steady while you improve consistency across the rest of the rubric.`
                : "No single weak criterion stands out, so focus on improving consistency across the whole rubric."}
            </p>
          )}
        </div>

        {selectedGrade.feedback ? (
          <div className="rounded-xl border bg-background p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lecturer Feedback</p>
            <p className="mt-2 text-sm text-muted-foreground">{selectedGrade.feedback}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
