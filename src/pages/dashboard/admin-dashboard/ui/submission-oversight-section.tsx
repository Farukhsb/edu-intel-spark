import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { safeFormatDate } from "@/lib/date";

import type { AdminSubmissionRow } from "../types";
import {
  FULL_TABLE_PAGE_SIZE,
  PAGE_SIZE,
  PaginationControls,
  SUBMISSION_STATUS_BADGE_STYLES,
  normalizeSearchValue,
  paginateRows,
  toStatusBadgeClass,
} from "./shared";

export const SubmissionOversightSection = ({
  submissions,
  compact,
}: {
  submissions: AdminSubmissionRow[];
  compact?: boolean;
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return submissions;

    return submissions.filter((submission) =>
      [submission.assignmentTitle, submission.studentLabel, submission.status, submission.fileName]
        .some((value) => String(value || "").toLowerCase().includes(normalizedQuery)),
    );
  }, [submissions, query]);

  const totalPages = compact ? 1 : Math.max(1, Math.ceil(filteredRows.length / FULL_TABLE_PAGE_SIZE));
  const visibleRows = compact ? filteredRows.slice(0, PAGE_SIZE) : paginateRows(filteredRows, page, FULL_TABLE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [submissions, query, compact]);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Recent submissions</CardTitle>
            <CardDescription>Observed submission volume, file activity, and workflow status across assignments.</CardDescription>
          </div>
          {compact ? (
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard?view=submissions")}>
              Open full table
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!compact ? (
          <div className="border-b border-border/60 px-6 py-4">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by assignment, student, status, or file"
              aria-label="Search submissions"
              className="max-w-sm"
            />
          </div>
        ) : null}
        {visibleRows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium">No submissions are visible</p>
            <p className="mt-1 text-sm text-muted-foreground">Submission records will appear here once the admin session can inspect them.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>File</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium">{submission.assignmentTitle}</TableCell>
                    <TableCell className="text-muted-foreground">{submission.studentLabel}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${toStatusBadgeClass(submission.status, SUBMISSION_STATUS_BADGE_STYLES)}`}>
                        {submission.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {safeFormatDate(submission.submittedAt, "MMM d, yyyy HH:mm", "Not available")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{submission.fileName || "No file recorded"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!compact && visibleRows.length > 0 ? (
          <PaginationControls page={page} totalPages={totalPages} itemLabel="Submissions" onPageChange={setPage} />
        ) : null}
      </CardContent>
    </Card>
  );
};
