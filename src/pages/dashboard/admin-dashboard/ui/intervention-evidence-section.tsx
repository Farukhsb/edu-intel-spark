import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Download, Filter, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DashboardEmptyState,
  DashboardLiveBanner,
  DashboardLoadingState,
} from "@/components/dashboard/PageStates";
import { safeFormatDate } from "@/lib/date";
import { log } from "@/lib/logger";
import {
  buildInterventionEvidenceReport,
  fetchAdminInterventionEvidenceDataset,
  type AdminInterventionEvidenceDataset,
  type AdminInterventionEvidenceRow,
  type AdminInterventionEvidenceSummary,
} from "@/lib/data/admin";
import { toast } from "sonner";

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const downloadCsv = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const summaryCards = (summary: AdminInterventionEvidenceSummary) => [
  { label: "Interventions", value: summary.interventionCount },
  { label: "Evidence events", value: summary.eventCount },
  { label: "Students reached", value: summary.uniqueStudents },
  { label: "Lecturers involved", value: summary.uniqueLecturers },
  { label: "Open follow-ups", value: summary.openCount },
  { label: "Overdue follow-ups", value: summary.overdueCount },
];

const ReportTable = ({ rows }: { rows: AdminInterventionEvidenceRow[] }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Evidence rows</CardTitle>
      <CardDescription>Each row shows a contact event with its linked intervention and outcome</CardDescription>
    </CardHeader>
    <CardContent className="p-0">
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No evidence rows match the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contacted</TableHead>
                <TableHead>Cohort</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Lecturer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 50).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">
                    <div>
                      <p>{safeFormatDate(row.contactedAt, "MMM d, yyyy")}</p>
                      <p className="text-xs">{safeFormatDate(row.contactedAt, "HH:mm")}</p>
                    </div>
                  </TableCell>
                  <TableCell>{row.cohortLabel}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{row.studentLabel}</p>
                      <p className="text-xs text-muted-foreground">{row.studentEmail || "No email recorded"}</p>
                    </div>
                  </TableCell>
                  <TableCell>{row.lecturerLabel}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant="outline">{row.contactTargetType}</Badge>
                      <p className="text-xs text-muted-foreground">
                        {row.contactTargetName} via {row.contactMethod}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.outcome === "resolved" ? "default" : row.outcome === "escalated" ? "destructive" : "secondary"}>
                      {row.outcome}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[26rem] space-y-1">
                      <p>{row.summary}</p>
                      {row.nextStep ? <p className="text-xs text-muted-foreground">Next step: {row.nextStep}</p> : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length > 50 ? (
            <p className="px-6 py-4 text-center text-xs text-muted-foreground">
              Showing 50 of {rows.length} evidence rows. Export to capture the full report.
            </p>
          ) : null}
        </div>
      )}
    </CardContent>
  </Card>
);

export const InterventionEvidenceSection = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<AdminInterventionEvidenceDataset | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState<string>("all");
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date(Date.now() - 29 * 86400000)));
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const nextDataset = await fetchAdminInterventionEvidenceDataset();
        setDataset(nextDataset);
        setLoadError(null);
      } catch (error) {
        log.error("Failed to load intervention evidence report", error);
        setLoadError("Intervention evidence data could not be loaded right now.");
        setDataset(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const cohorts = useMemo(() => {
    const values = new Set<string>();
    dataset?.profiles.forEach((profile: AdminInterventionEvidenceDataset["profiles"][number]) => {
      if (profile.cohort_id) {
        values.add(profile.cohort_id);
      }
    });
    return [...values].sort();
  }, [dataset]);

  const report = useMemo(
    () =>
      dataset
        ? buildInterventionEvidenceReport(dataset, {
            cohortId: selectedCohortId as "all" | string,
            startDate: startDate || null,
            endDate: endDate || null,
          })
        : null,
    [dataset, endDate, selectedCohortId, startDate],
  );

  const handleExport = () => {
    if (!report) return;
    setExporting(true);
    try {
      downloadCsv(report.csv, `app_intervention_evidence_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("APP evidence export downloaded");
    } catch {
      toast.error("Failed to generate APP evidence export");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (loadError) {
    return (
      <DashboardEmptyState
        title="Intervention evidence report unavailable"
        description={loadError}
      />
    );
  }

  if (!dataset || !report) {
    return (
      <DashboardEmptyState
        title="No intervention evidence yet"
        description="This report will populate once interventions and contact events have been logged."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardLiveBanner label="Viewing live intervention evidence records assembled from the connected institution dataset." />

      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="grid gap-4 p-5 md:grid-cols-3 xl:grid-cols-6">
          {summaryCards(report.summary).map((item) => (
            <div key={item.label}>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="text-sm font-medium">APP evidence export</p>
            <p className="text-sm text-muted-foreground">
              Use this report to evidence who was contacted, when the contact happened, who recorded it, and what the outcome was.
            </p>
            <p className="text-xs text-muted-foreground">
              The report can be filtered by cohort and date range before downloading a CSV for quality assurance, OfS review, or internal audit.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="evidence-cohort">Cohort</Label>
              <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
                <SelectTrigger id="evidence-cohort">
                  <SelectValue placeholder="All cohorts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cohorts</SelectItem>
                  {cohorts.map((cohortId) => (
                    <SelectItem key={cohortId} value={cohortId}>
                      {cohortId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Export</Label>
              <Button className="w-full" onClick={handleExport} disabled={exporting || report.rows.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence-start">Start date</Label>
              <Input id="evidence-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence-end">End date</Label>
              <Input id="evidence-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-medium">Cohort filter</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedCohortId === "all" ? "All cohorts are included." : `Only ${selectedCohortId} is included.`}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Date window</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {safeFormatDate(startDate, "MMM d, yyyy", "Start not set")} to {safeFormatDate(endDate, "MMM d, yyyy", "End not set")}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Export scope</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {report.rows.length} evidence rows match the current report filters.
            </p>
          </div>
        </CardContent>
      </Card>

      <ReportTable rows={report.rows} />
    </div>
  );
};
