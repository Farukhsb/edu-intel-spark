import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { safeFormatDate } from "@/lib/date";

import type { AdminAssignmentRow } from "../types";
import {
  ASSIGNMENT_STATUS_BADGE_STYLES,
  FULL_TABLE_PAGE_SIZE,
  PAGE_SIZE,
  PaginationControls,
  normalizeSearchValue,
  paginateRows,
  toStatusBadgeClass,
} from "./shared";

export const AssignmentOversightSection = ({
  assignments,
  compact,
}: {
  assignments: AdminAssignmentRow[];
  compact?: boolean;
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return assignments;
    return assignments.filter((assignment) =>
      [assignment.title, assignment.moduleCode, assignment.lecturerName, assignment.status]
        .some((value) => String(value || "").toLowerCase().includes(normalizedQuery)),
    );
  }, [assignments, query]);

  const totalPages = compact ? 1 : Math.max(1, Math.ceil(filteredRows.length / FULL_TABLE_PAGE_SIZE));
  const visibleRows = compact ? filteredRows.slice(0, PAGE_SIZE) : paginateRows(filteredRows, page, FULL_TABLE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [assignments, query, compact]);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Assignment oversight</CardTitle>
            <CardDescription>Publishing volume, submission coverage, and grading release progress across the platform.</CardDescription>
          </div>
          {compact ? (
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard?view=assignments")}>
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
              placeholder="Search by assignment, module, lecturer, or status"
              aria-label="Search assignments"
              className="max-w-sm"
            />
          </div>
        ) : null}
        {visibleRows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium">No assignments are visible</p>
            <p className="mt-1 text-sm text-muted-foreground">Assignment records will populate once the admin session can inspect them.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Lecturer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead>Graded</TableHead>
                  <TableHead>Released</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{assignment.title}</p>
                        <p className="text-xs text-muted-foreground">{assignment.moduleCode || "Module not linked"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{assignment.lecturerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${toStatusBadgeClass(assignment.status, ASSIGNMENT_STATUS_BADGE_STYLES)}`}>
                        {assignment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{safeFormatDate(assignment.dueDate, "MMM d, yyyy HH:mm", "No due date")}</TableCell>
                    <TableCell>{assignment.submissionCount}</TableCell>
                    <TableCell>{assignment.gradedCount}</TableCell>
                    <TableCell>{assignment.releasedCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!compact && visibleRows.length > 0 ? (
          <PaginationControls page={page} totalPages={totalPages} itemLabel="Assignments" onPageChange={setPage} />
        ) : null}
      </CardContent>
    </Card>
  );
};
