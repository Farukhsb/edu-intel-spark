import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCheck, Clock, Shield } from "lucide-react";
import type { ModerationOwnerAssignmentSummary } from "@/lib/moderationWorkflow";

type ModerationQueueSummaryProps = {
  queueStats: {
    pending: number;
    inProgress: number;
    moderated: number;
    escalated: number;
  };
  ownerAssignmentSummaries?: ModerationOwnerAssignmentSummary[];
  onViewAssignmentCases?: (assignmentId: string) => void;
  onFocusAssignmentQueue?: (assignmentId: string, filter: "ready_for_release" | "escalated") => void;
  onOpenReleaseWorkflow?: (assignmentId: string) => void;
};

const summaryItems = [
  { label: "Pending", key: "pending", icon: Clock },
  { label: "In Progress", key: "inProgress", icon: Shield },
  { label: "Moderated", key: "moderated", icon: CheckCheck },
  { label: "Escalated", key: "escalated", icon: AlertTriangle },
] as const;

export const ModerationQueueSummary = ({
  queueStats,
  ownerAssignmentSummaries = [],
  onViewAssignmentCases,
  onFocusAssignmentQueue,
  onOpenReleaseWorkflow,
}: ModerationQueueSummaryProps) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-4">
      {summaryItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <item.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{queueStats[item.key]}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
    {ownerAssignmentSummaries.length > 0 && (
      <Card data-testid="moderation-owner-assignment-summary">
        <CardContent className="space-y-3 p-5">
          <div>
            <p className="text-sm font-medium">Owner release follow-up</p>
            <p className="text-xs text-muted-foreground">
              Assignments with approved moderation outcomes still waiting for release, or escalated disputes still unresolved.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {ownerAssignmentSummaries.map((summary) => (
              <div
                key={summary.assignmentId}
                className="rounded-lg border bg-muted/20 p-3"
                data-testid={`moderation-owner-assignment-${summary.assignmentId}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{summary.assignmentTitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ready for release: {summary.approvedReadyCount} | Escalated disputes: {summary.escalatedCount}
                    </p>
                    {onFocusAssignmentQueue && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {summary.approvedReadyCount > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => onFocusAssignmentQueue(summary.assignmentId, "ready_for_release")}
                            data-testid={`moderation-owner-assignment-ready-${summary.assignmentId}`}
                          >
                            Ready cases
                          </Button>
                        )}
                        {summary.escalatedCount > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => onFocusAssignmentQueue(summary.assignmentId, "escalated")}
                            data-testid={`moderation-owner-assignment-escalated-${summary.assignmentId}`}
                          >
                            Escalated cases
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {onViewAssignmentCases && (
                    <div className="flex flex-col gap-2">
                      {onOpenReleaseWorkflow && summary.approvedReadyCount > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onOpenReleaseWorkflow(summary.assignmentId)}
                          data-testid={`moderation-owner-assignment-release-${summary.assignmentId}`}
                        >
                          Release workflow
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onViewAssignmentCases(summary.assignmentId)}
                        data-testid={`moderation-owner-assignment-open-${summary.assignmentId}`}
                      >
                        View cases
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}
  </div>
);
