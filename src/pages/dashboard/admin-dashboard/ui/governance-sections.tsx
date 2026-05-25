import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { safeFormatDate } from "@/lib/date";

import type {
  AdminDataAccessLogRow,
  AdminGovernanceStatus,
  AdminIntegrityOverview,
  AdminModerationAuditRow,
  AdminPolicyExceptionRow,
} from "../types";

const GovernanceStateNotice = ({
  status,
  emptyTitle,
  emptyDetail,
  unavailableDetail,
}: {
  status: AdminGovernanceStatus;
  emptyTitle: string;
  emptyDetail: string;
  unavailableDetail: string;
}) => {
  if (status === "available") {
    return null;
  }

  return (
    <div className="rounded-xl border border-dashed border-border/70 p-6 text-sm">
      <p className="font-medium">{status === "empty" ? emptyTitle : "Currently unavailable"}</p>
      <p className="mt-2 leading-6 text-muted-foreground">
        {status === "empty" ? emptyDetail : unavailableDetail}
      </p>
    </div>
  );
};

export const DataAccessLogSection = ({
  rows,
  status,
}: {
  rows: AdminDataAccessLogRow[];
  status: AdminGovernanceStatus;
}) => (
  <Card className="border-border/70 shadow-sm">
    <CardHeader className="border-b border-border/60 pb-4">
      <CardTitle className="text-base">Data access log</CardTitle>
      <CardDescription>
        Using available admin and workflow audit events. Access-specific outcome fields are shown only where the current audit source records them.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 p-6">
      <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
        Read-only governance view. This page does not expose grading, feedback editing, or release controls.
      </div>
      <GovernanceStateNotice
        status={status}
        emptyTitle="No audit events are visible"
        emptyDetail="No admin or workflow audit rows matched the current read-only dataset."
        unavailableDetail="The current admin session cannot read audit sources for this governance page right now."
      />
      {status === "available" ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">{safeFormatDate(row.timestamp, "MMM d, yyyy HH:mm", "Not available")}</TableCell>
                  <TableCell className="font-medium">{row.actor}</TableCell>
                  <TableCell className="text-muted-foreground">{row.actorRole}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          row.source === "admin"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : row.source === "academic-access"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                              : "border-slate-500/30 bg-slate-500/10 text-slate-700"
                        }
                      >
                        {row.source === "admin" ? "Admin" : row.source === "academic-access" ? "Academic access" : "Workflow"}
                      </Badge>
                      <span>{row.action}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{row.resourceType}</p>
                      <p className="text-xs text-muted-foreground">{row.resourceLabel}</p>
                    </div>
                  </TableCell>
                  <TableCell>{row.outcome}</TableCell>
                  <TableCell className="text-muted-foreground">{row.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </CardContent>
  </Card>
);

export const AcademicIntegrityOverviewSection = ({
  overview,
}: {
  overview: AdminIntegrityOverview;
}) => (
  <Card className="border-border/70 shadow-sm">
    <CardHeader className="border-b border-border/60 pb-4">
      <CardTitle className="text-base">Academic integrity overview</CardTitle>
      <CardDescription>
        Institution-level integrity review signals from real review and submission data. Missing fields are shown as Not yet recorded.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-6 p-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total integrity reviews</p>
          <p className="mt-2 text-2xl font-bold font-display">{overview.totalReviews}</p>
        </div>
        <div className="rounded-xl border border-border/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Flagged reviews</p>
          <p className="mt-2 text-2xl font-bold font-display">{overview.flaggedReviews}</p>
        </div>
        <div className="rounded-xl border border-border/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">High-risk cases</p>
          <p className="mt-2 text-2xl font-bold font-display">{overview.highRiskCases}</p>
        </div>
        <div className="rounded-xl border border-border/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average similarity score</p>
          <p className="mt-2 text-2xl font-bold font-display">{overview.averageSimilarityScore ?? "Not yet recorded"}</p>
        </div>
      </div>
      <GovernanceStateNotice
        status={overview.status}
        emptyTitle="No integrity reviews are visible"
        emptyDetail="No academic integrity reviews matched the current admin read-only dataset."
        unavailableDetail="The current admin session cannot read academic integrity reviews right now."
      />
      {overview.status === "available" ? (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-border/70 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Assignments with most integrity concerns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.assignmentsWithMostConcerns.map((row) => (
                <div key={row.assignmentId} className="rounded-xl border border-border/70 p-4">
                  <p className="font-medium">{row.assignmentTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.flaggedReviews} flagged of {row.totalReviews} reviews
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    High-risk cases: {row.highRiskCases}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Recent integrity events</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reviewed</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Similarity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.recentEvents.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-muted-foreground">{safeFormatDate(row.reviewedAt, "MMM d, yyyy HH:mm", "Not available")}</TableCell>
                        <TableCell>{row.assignmentTitle}</TableCell>
                        <TableCell>{row.studentLabel}</TableCell>
                        <TableCell>{row.decision}</TableCell>
                        <TableCell>{row.riskScore ?? "Not yet recorded"}</TableCell>
                        <TableCell>{row.similarityScore ?? "Not yet recorded"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </CardContent>
  </Card>
);

export const ModerationAuditSection = ({
  rows,
  status,
}: {
  rows: AdminModerationAuditRow[];
  status: AdminGovernanceStatus;
}) => (
  <Card className="border-border/70 shadow-sm">
    <CardHeader className="border-b border-border/60 pb-4">
      <CardTitle className="text-base">Moderation audit</CardTitle>
      <CardDescription>
        Read-only moderation case history with visible assignment, student-safe labels, decisions, and audit summaries.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 p-6">
      <GovernanceStateNotice
        status={status}
        emptyTitle="No moderation cases are visible"
        emptyDetail="No moderation records matched the current admin read-only dataset."
        unavailableDetail="The current admin session cannot read moderation data for this governance page right now."
      />
      {status === "available" ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assignment</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Moderator</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>History</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.assignmentTitle}</TableCell>
                  <TableCell>{row.studentLabel}</TableCell>
                  <TableCell>{row.assignedModerator}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>
                    <div>
                      <p>{row.decision}</p>
                      <p className="text-xs text-muted-foreground">{row.noteSummary}</p>
                    </div>
                  </TableCell>
                  <TableCell>{row.historySummary}</TableCell>
                  <TableCell className="text-muted-foreground">{safeFormatDate(row.updatedAt, "MMM d, yyyy HH:mm", "Not available")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </CardContent>
  </Card>
);

export const PolicyExceptionsSection = ({
  rows,
  status,
}: {
  rows: AdminPolicyExceptionRow[];
  status: AdminGovernanceStatus;
}) => (
  <Card className="border-border/70 shadow-sm">
    <CardHeader className="border-b border-border/60 pb-4">
      <CardTitle className="text-base">Policy exceptions</CardTitle>
      <CardDescription>
        Detectable governance exceptions from real moderation, submission, and integrity signals. Checks that are not yet supported remain unrecorded.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 p-6">
      <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
        Not yet recorded: submission text-extraction completeness is not available to this admin view yet, so that exception check is not currently included.
      </div>
      <GovernanceStateNotice
        status={status}
        emptyTitle="No policy exceptions are visible"
        emptyDetail="No detectable exceptions were found in the current read-only governance dataset."
        unavailableDetail="Some policy exception checks depend on integrity data that is not readable to this admin session right now."
      />
      {status === "available" ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-border/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{row.type}</p>
                  <p className="text-sm text-muted-foreground">{row.assignmentTitle} | {row.studentLabel}</p>
                </div>
                <Badge variant="outline" className={row.severity === "high" ? "border-amber-500/30 bg-amber-500/10 text-amber-700" : "border-slate-500/30 bg-slate-500/10 text-slate-700"}>
                  {row.severity === "high" ? "High severity" : "Medium severity"}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{row.details}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Status: {row.status} | Detected {safeFormatDate(row.detectedAt, "MMM d, yyyy HH:mm", "Not available")}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </CardContent>
  </Card>
);
