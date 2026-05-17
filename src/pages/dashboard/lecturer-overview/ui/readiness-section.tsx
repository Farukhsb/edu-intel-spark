import { Card, CardContent } from "@/components/ui/card";
import type { LecturerOverviewReadiness } from "@/lib/lecturerOverviewReadiness";

export const LecturerOverviewReadinessSection = ({
  readiness,
}: {
  readiness: LecturerOverviewReadiness;
}) => (
  <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
    <CardContent className="grid gap-4 p-6 md:grid-cols-3">
      <div className="rounded-lg border bg-background/70 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reporting Readiness</p>
        <p className="mt-2 text-sm font-semibold">{readiness.postureLabel}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Based on your current review queue, at-risk students, and live assignment activity.
        </p>
      </div>
      <div className="rounded-lg border bg-background/70 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely challenge</p>
        <p className="mt-2 text-sm font-semibold">{readiness.likelyChallenge}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This is the workflow pressure point most likely to affect your next teaching action.
        </p>
      </div>
      <div className="rounded-lg border bg-background/70 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next action</p>
        <p className="mt-2 text-sm font-semibold">{readiness.bestNextAction}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use it to decide whether to clear the queue first or shift attention to student support.
        </p>
      </div>
    </CardContent>
  </Card>
);
