import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeFormatDate } from "@/lib/date";
import { formatSubmissionStatus, type ModerationAction } from "@/lib/moderation";

export type ModerationHistorySectionProps = {
  reviews: Array<{
    id: string;
    action: string;
    reviewer_role: string;
    created_at: string;
    notes?: string | null;
  }>;
};

export const ModerationHistorySection = ({ reviews }: ModerationHistorySectionProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Moderation History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No moderation actions recorded yet.</p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{formatSubmissionStatus(review.action as ModerationAction)}</Badge>
                <Badge variant="secondary">{formatSubmissionStatus(review.reviewer_role)}</Badge>
                <span className="text-xs text-muted-foreground">{safeFormatDate(review.created_at, "MMM d, yyyy HH:mm")}</span>
              </div>
              <p className="mt-2 text-sm">{review.notes || "No note recorded."}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
