import { clampPercentage, getGradeTone, normalizeMaxScore } from "@/lib/gradePresentation";
import { cn } from "@/lib/utils";

type CriterionBarItem = {
  criterion: string;
  score: number;
  maxScore: number;
  weightPercent?: number | null;
  detail?: string | null;
  confidenceScore?: number | null;
  reviewRequired?: boolean | null;
  evidenceSnippet?: string | null;
  errorType?: string | null;
};

type CriterionBarsProps = {
  items: CriterionBarItem[];
  compact?: boolean;
};

const getBarToneClass = (percent: number) => {
  const tone = getGradeTone(percent);
  if (tone === "success") return "bg-success";
  if (tone === "primary") return "bg-primary";
  return "bg-destructive";
};

export const CriterionBars = ({ items, compact = false }: CriterionBarsProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {items.map((item, index) => {
        const normalizedMaxScore = normalizeMaxScore(item.maxScore);
        const percent = normalizedMaxScore > 0 ? clampPercentage(item.score, normalizedMaxScore) : 0;
        const scoreLabel = `${item.score}/${normalizedMaxScore}`;

        return (
          <div key={`${item.criterion}-${index}`} className={cn("space-y-2 rounded-xl border bg-background p-3", compact && "p-2.5")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("font-medium", compact && "text-sm")}>{item.criterion}</span>
                  {typeof item.weightPercent === "number" && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {item.weightPercent}% of total mark
                    </span>
                  )}
                </div>
                {item.detail ? <p className={cn("text-xs text-muted-foreground", compact && "leading-5")}>{item.detail}</p> : null}
              </div>

              <div className="text-right">
                <p className={cn("text-sm font-semibold", compact && "text-xs")}>{scoreLabel}</p>
                <p className="text-xs text-muted-foreground">{percent}% achieved</p>
              </div>
            </div>

            <div className={cn("h-2 overflow-hidden rounded-full bg-muted", compact && "h-1.5")}>
              <div className={cn("h-full rounded-full transition-all", getBarToneClass(percent))} style={{ width: `${percent}%` }} />
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {typeof item.confidenceScore === "number" ? (
                <span>Confidence {Math.round(item.confidenceScore * 100)}%</span>
              ) : null}
              {item.reviewRequired ? <span>Lecturer review recommended</span> : null}
              {item.evidenceSnippet ? <span>Evidence: {item.evidenceSnippet}</span> : null}
              {item.errorType && item.errorType !== "none" ? (
                <span>Error type: {String(item.errorType).replace(/_/g, " ")}</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};
