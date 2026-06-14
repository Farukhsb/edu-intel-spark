import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeFormatDate } from "@/lib/date";
import { formatSubmissionStatus } from "@/lib/moderation";

export type AuditHistorySectionProps = {
  entries: Array<{
    id: string;
    event_type: string;
    created_at: string;
    reason?: string | Record<string, unknown> | null;
  }>;
};

export const AuditHistorySection = ({ entries }: AuditHistorySectionProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Audit History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit entries recorded yet.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{formatSubmissionStatus(entry.event_type)}</Badge>
                <span className="text-xs text-muted-foreground">{safeFormatDate(entry.created_at, "MMM d, yyyy HH:mm")}</span>
              </div>
              {entry.reason && <p className="mt-2 text-sm">{typeof entry.reason === "string" ? entry.reason : String(entry.reason)}</p>}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
