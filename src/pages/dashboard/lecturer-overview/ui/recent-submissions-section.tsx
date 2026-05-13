import { Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeToLocaleDate } from "@/lib/date";

import { formatStatusLabel } from "../useLecturerOverviewController";
import type { LecturerOverviewRecentSubmission } from "../types";

export const LecturerOverviewRecentSubmissionsSection = ({
  recent,
}: {
  recent: LecturerOverviewRecentSubmission[];
}) => {
  const navigate = useNavigate();

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Submissions</CardTitle>
        <CardDescription>Latest student work that has entered your assessment workflow</CardDescription>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm font-medium">No submissions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish an assignment or check the due dates on your active briefs. Student submissions will start appearing here as soon as work is uploaded.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((submission) => {
              const needsAttention =
                submission.score == null ||
                [
                  "submitted",
                  "ai_grading",
                  "ai_graded",
                  "first_review",
                  "moderation_pending",
                  "moderation_in_progress",
                  "escalated",
                ].includes(submission.status);

              return (
                <div
                  key={submission.id}
                  className="flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/30 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{submission.student_name}</p>
                      {needsAttention && (
                        <Badge variant="outline" className="border-warning/30 text-[10px] uppercase tracking-wide text-warning">
                          Needs attention
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{submission.assignment_title}</p>
                    <p className="truncate text-xs text-muted-foreground">{submission.file_name}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <Badge variant="outline" className="text-xs">
                      {formatStatusLabel(submission.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{safeToLocaleDate(submission.submitted_at)}</span>
                    {submission.score != null ? (
                      <Badge variant={submission.score >= 70 ? "default" : submission.score >= 50 ? "secondary" : "destructive"}>
                        {submission.score}/{submission.max_score}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Clock className="mr-1 h-3 w-3" /> Pending
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => navigate(submission.workflowHref)}
                    >
                      {submission.workflowLabel}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
