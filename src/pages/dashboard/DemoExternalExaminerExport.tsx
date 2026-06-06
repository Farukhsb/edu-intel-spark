import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileText, Shield, Users } from "lucide-react";
import { DashboardDemoBanner } from "@/components/dashboard/PageStates";
import { buildDetailedExternalExaminerCsv, buildExternalExaminerCsv } from "@/lib/externalExaminerExport";
import { redactStudentIdentity as buildRedactedStudentIdentity } from "@/lib/exportPrivacy";
import { toast } from "sonner";
import {
  DEMO_EXTERNAL_EXAMINER_ASSIGNMENTS,
  DEMO_EXTERNAL_EXAMINER_EXPORT_DATA,
} from "@/pages/dashboard/external-examiner-export/demoData";

const getExportSummary = (rows: typeof DEMO_EXTERNAL_EXAMINER_EXPORT_DATA) => {
  const scores = rows.map((row) => row.finalScore).filter((score): score is number => score != null);
  const averageScore = scores.length > 0 ? Math.round(scores.reduce((left, right) => left + right, 0) / scores.length) : 0;
  const passRate = scores.length > 0 ? Math.round((scores.filter((score) => score >= 40).length / scores.length) * 100) : 0;
  const moderatedCount = rows.filter((row) => row.lecturerScore != null).length;
  const releasedCount = rows.filter((row) => row.status === "released").length;

  return {
    averageScore,
    passRate,
    moderatedCount,
    releasedCount,
    moderationCoverage: rows.length > 0 ? Math.round((moderatedCount / rows.length) * 100) : 0,
  };
};

const DemoExternalExaminerExport = () => {
  const [exporting, setExporting] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("all");
  const [includeOptions, setIncludeOptions] = useState({
    scores: true,
    feedback: true,
    moderation: true,
    aiBreakdown: false,
    studentIdentity: true,
    redactStudentIdentity: true,
  });

  const filteredData = selectedAssignment === "all"
    ? DEMO_EXTERNAL_EXAMINER_EXPORT_DATA
    : DEMO_EXTERNAL_EXAMINER_EXPORT_DATA.filter((row) =>
        row.assignmentTitle === DEMO_EXTERNAL_EXAMINER_ASSIGNMENTS.find((assignment) => assignment.id === selectedAssignment)?.title,
      );
  const previewRows = filteredData.map((row, index) =>
    includeOptions.redactStudentIdentity && includeOptions.studentIdentity
      ? {
          ...row,
          ...buildRedactedStudentIdentity(index),
        }
      : row,
  );
  const exportSummary = getExportSummary(filteredData);

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: "csv" | "detailed") => {
    setExporting(true);
    try {
      const csv = buildExternalExaminerCsv(filteredData, includeOptions);
      if (format === "detailed") {
        downloadCSV(
          buildDetailedExternalExaminerCsv(filteredData, includeOptions),
          `external_examiner_report_detailed_${new Date().toISOString().slice(0, 10)}.csv`,
        );
      } else {
        downloadCSV(csv, `external_examiner_export_${new Date().toISOString().slice(0, 10)}.csv`);
      }
      toast.success("Export downloaded successfully");
    } catch {
      toast.error("Failed to generate export. Please try again.");
    }
    setExporting(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardDemoBanner label="Viewing demo export data" />

      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Average final score</p>
            <p className="mt-2 text-2xl font-semibold">{exportSummary.averageScore}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pass rate</p>
            <p className="mt-2 text-2xl font-semibold">{exportSummary.passRate}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Moderation coverage</p>
            <p className="mt-2 text-2xl font-semibold">{exportSummary.moderationCoverage}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Released to students</p>
            <p className="mt-2 text-2xl font-semibold">{exportSummary.releasedCount}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-medium">Governed export scope</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Only moderated, approved, and released submissions are included in the examiner export.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">External review intent</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use this view to inspect final outcomes, moderation evidence, and score consistency before downloading the full report.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Current selection</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedAssignment === "all"
                ? "All assignments"
                : DEMO_EXTERNAL_EXAMINER_ASSIGNMENTS.find((assignment) => assignment.id === selectedAssignment)?.title || "Filtered assignment"} | {filteredData.length} records ready for export
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Export Configuration</CardTitle>
            <CardDescription>Configure what data to include</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">Filter by Assignment</label>
              <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                <SelectTrigger><SelectValue placeholder="All assignments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignments</SelectItem>
                  {DEMO_EXTERNAL_EXAMINER_ASSIGNMENTS.map((assignment) => (
                    <SelectItem key={assignment.id} value={assignment.id}>
                      {assignment.title} ({assignment.moduleCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Include in Export</label>
              {[
                { key: "scores" as const, label: "Scores (AI, Lecturer, Final)", icon: FileText },
                { key: "feedback" as const, label: "Feedback & Comments", icon: FileText },
                { key: "moderation" as const, label: "Moderation Evidence", icon: Shield },
                { key: "studentIdentity" as const, label: "Student Identity", icon: Users },
                { key: "redactStudentIdentity" as const, label: "Redact Student Identity", icon: Shield },
              ].map((option) => (
                <div key={option.key} className="flex items-center gap-2">
                  <Checkbox
                    id={option.key}
                    checked={includeOptions[option.key]}
                    onCheckedChange={(checked) => setIncludeOptions((current) => ({ ...current, [option.key]: !!checked }))}
                  />
                  <label htmlFor={option.key} className="cursor-pointer text-sm">{option.label}</label>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <Button onClick={() => handleExport("csv")} disabled={exporting || filteredData.length === 0} className="w-full">
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <Button onClick={() => handleExport("detailed")} variant="outline" disabled={exporting || filteredData.length === 0} className="w-full">
                <Download className="mr-2 h-4 w-4" /> Detailed Report (with Summary)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Export Preview</CardTitle>
                <CardDescription>{filteredData.length} records ready for export</CardDescription>
              </div>
              <Badge variant="default">{filteredData.length} records</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Student</th>
                    <th className="pb-2 font-medium">Assignment</th>
                    <th className="pb-2 font-medium">Module</th>
                    <th className="pb-2 text-right font-medium">AI</th>
                    <th className="pb-2 text-right font-medium">Lecturer</th>
                    <th className="pb-2 text-right font-medium">Final</th>
                    <th className="pb-2 font-medium">Source</th>
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.slice(0, 20).map((row, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-2">{previewRows[index].studentName}</td>
                      <td className="max-w-[150px] truncate py-2">{row.assignmentTitle}</td>
                      <td className="py-2">{row.moduleCode}</td>
                      <td className="py-2 text-right">{row.aiScore ?? "Not recorded"}</td>
                      <td className="py-2 text-right">{row.lecturerScore ?? "Not recorded"}</td>
                      <td className="py-2 text-right font-medium">{row.finalScore ?? "Not recorded"}</td>
                      <td className="py-2">
                        <Badge variant={row.gradeSource === "lecturer_uploaded" ? "outline" : row.gradeSource === "lecturer_reviewed" ? "default" : "secondary"} className="text-xs">
                          {row.gradeSource ?? "Not recorded"}
                        </Badge>
                      </td>
                      <td className="py-2"><Badge variant="outline" className="text-xs">{row.classification}</Badge></td>
                      <td className="py-2"><Badge variant={row.status === "released" ? "default" : "secondary"} className="text-xs">{row.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredData.length > 20 && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Showing 20 of {filteredData.length} records. Export for full data.
                </p>
              )}
              {filteredData.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No governed export-ready records match this selection yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DemoExternalExaminerExport;
