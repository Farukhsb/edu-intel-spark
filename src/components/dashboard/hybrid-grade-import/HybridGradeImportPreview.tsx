import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { GradeImportResponse } from "./types";

export function HybridGradeImportPreview({
  preview,
}: {
  preview: GradeImportResponse;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{preview.summary.rowsProcessed} rows scanned</Badge>
        <Badge variant="outline" className="border-success/30 bg-success/5 text-success">
          {preview.summary.rowsAccepted} accepted
        </Badge>
        <Badge variant="outline" className="border-warning/30 bg-warning/5 text-warning">
          {preview.summary.rowsWithWarnings} with warnings
        </Badge>
        <Badge variant="outline" className="border-destructive/30 bg-destructive/5 text-destructive">
          {preview.summary.rowsRejected} rejected
        </Badge>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Row</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issues</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.map((row) => (
              <TableRow key={row.rowNumber}>
                <TableCell className="align-top font-medium">{row.rowNumber}</TableCell>
                <TableCell className="align-top">
                  <div className="space-y-1">
                    <p className="font-medium">{row.studentName || "Unnamed student"}</p>
                    <p className="text-xs text-muted-foreground">{row.studentEmail || "No email"}</p>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <div className="space-y-1">
                    <p className="font-medium">{row.normalizedScore.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.score}/{row.maxScore}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant={row.accepted ? "outline" : "destructive"}>
                    {row.accepted ? "Accepted" : "Needs review"}
                  </Badge>
                </TableCell>
                <TableCell className="align-top">
                  {row.issues.length > 0 ? (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {row.issues.map((issue) => (
                        <li
                          key={issue.code}
                          className={cn(issue.severity === "error" ? "text-destructive" : "text-warning")}
                        >
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-muted-foreground">No issues</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {preview.committed ? (
        <div className="rounded-xl border border-success/30 bg-success/5 p-4">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-sm font-medium">Import completed</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {preview.summary.rowsAccepted} rows imported and {preview.summary.createdSyntheticSubmissions} synthetic submissions created.
          </p>
        </div>
      ) : null}
    </div>
  );
}
