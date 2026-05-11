import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { safeFormatDate } from "@/lib/date";

import type { AdminModerationRow, ModerationSummary } from "../types";
import { humanizeToken, isRecentEnoughToBeOverdue } from "../utils";
import {
  FULL_TABLE_PAGE_SIZE,
  MODERATION_STATUS_BADGE_STYLES,
  PAGE_SIZE,
  PaginationControls,
  formatPercentage,
  normalizeSearchValue,
  paginateRows,
  toStatusBadgeClass,
} from "./shared";

const summarizeModerationRows = (moderationRows: AdminModerationRow[]): ModerationSummary =>
  moderationRows.reduce<ModerationSummary>(
    (summary, item) => {
      if ((item.integrityRiskScore ?? 0) >= 70) summary.highRisk += 1;
      if (item.status === "moderation_pending") summary.awaitingLecturer += 1;
      if (item.moderatorName !== "Unassigned") summary.assignedModerators += 1;
      if (item.status !== "moderated" && item.status !== "resolved" && isRecentEnoughToBeOverdue(item.createdAt)) summary.overdue += 1;
      if (item.disagreement) summary.disagreements += 1;
      return summary;
    },
    { highRisk: 0, awaitingLecturer: 0, assignedModerators: 0, overdue: 0, disagreements: 0 },
  );

export const IntegrityModerationSection = ({
  moderationRows,
  compact,
}: {
  moderationRows: AdminModerationRow[];
  compact?: boolean;
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const summary = useMemo(() => summarizeModerationRows(moderationRows), [moderationRows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return moderationRows;
    return moderationRows.filter((item) =>
      [item.assignmentTitle, item.firstMarkerName, item.moderatorName, item.status, item.triggerSummary]
        .some((value) => String(value || "").toLowerCase().includes(normalizedQuery)),
    );
  }, [moderationRows, query]);

  const totalPages = compact ? 1 : Math.max(1, Math.ceil(filteredRows.length / FULL_TABLE_PAGE_SIZE));
  const visibleRows = compact ? filteredRows.slice(0, PAGE_SIZE) : paginateRows(filteredRows, page, FULL_TABLE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [moderationRows, query, compact]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-border/70 shadow-sm"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">High risk cases</p><p className="mt-2 text-3xl font-bold font-display">{summary.highRisk}</p></CardContent></Card>
        <Card className="border-border/70 shadow-sm"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Awaiting lecturer</p><p className="mt-2 text-3xl font-bold font-display">{summary.awaitingLecturer}</p></CardContent></Card>
        <Card className="border-border/70 shadow-sm"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned moderators</p><p className="mt-2 text-3xl font-bold font-display">{summary.assignedModerators}</p></CardContent></Card>
        <Card className="border-border/70 shadow-sm"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Overdue reviews</p><p className="mt-2 text-3xl font-bold font-display">{summary.overdue}</p></CardContent></Card>
        <Card className="border-border/70 shadow-sm"><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Marker disagreements</p><p className="mt-2 text-3xl font-bold font-display">{summary.disagreements}</p></CardContent></Card>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Integrity and moderation queue</CardTitle>
              <CardDescription>Escalations, high-risk markers, disagreement signals, and moderation throughput in one place.</CardDescription>
            </div>
            {compact ? (
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard?view=system")}>
                Open full queue
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
                placeholder="Search by assignment, marker, moderator, or status"
                aria-label="Search moderation cases"
                className="max-w-sm"
              />
            </div>
          ) : null}
          {visibleRows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium">No moderation cases are visible</p>
              <p className="mt-1 text-sm text-muted-foreground">Moderation and integrity cases will appear here when they exist.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>First marker</TableHead>
                    <TableHead>Moderator</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.assignmentTitle}</p>
                          <p className="text-xs text-muted-foreground">{item.triggerSummary || "No trigger summary recorded."}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className={
                              (item.integrityRiskScore ?? 0) >= 70
                                ? "border-rose-500/30 bg-rose-500/10 text-rose-700"
                                : (item.integrityRiskScore ?? 0) >= 40
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                                  : "border-slate-500/30 bg-slate-500/10 text-slate-700"
                            }
                          >
                            {formatPercentage(item.integrityRiskScore)}
                          </Badge>
                          <p className="text-xs text-muted-foreground">Confidence {formatPercentage(item.confidenceScore != null ? item.confidenceScore * 100 : null)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.firstMarkerName}</TableCell>
                      <TableCell className="text-muted-foreground">{item.moderatorName}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`capitalize ${toStatusBadgeClass(item.status, MODERATION_STATUS_BADGE_STYLES)}`}>
                            {humanizeToken(item.status)}
                          </Badge>
                          {item.disagreement ? (
                            <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-700">
                              Disagreement
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{safeFormatDate(item.updatedAt, "MMM d, yyyy HH:mm", "Not available")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!compact && visibleRows.length > 0 ? (
            <PaginationControls page={page} totalPages={totalPages} itemLabel="Moderation" onPageChange={setPage} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
