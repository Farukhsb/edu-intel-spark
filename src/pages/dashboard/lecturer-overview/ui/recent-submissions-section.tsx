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
        <CardTitle className="text-base">Review next</CardTitle>
        <CardDescription>Open the next submission in the queue.</CardDescription>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm font-medium">No submissions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish an assignment or check its due date. Student work will appear here once it is submitted.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recent.map((submission) => {
              return (
                <div
                  key={submission.id}
                  className="flex flex-col gap-2 rounded-xl border px-4 py-3 transition-colors hover:bg-muted/30 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{submission.student_name}</p>
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
                    ) : null}
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
