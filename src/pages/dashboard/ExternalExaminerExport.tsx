import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileText, Loader2, Shield, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/date";
import { log } from "@/lib/logger";
import type {
  ExternalExaminerAssignmentRow,
  ExternalExaminerExportRow,
  ExternalExaminerGradeRow,
  ExternalExaminerProfileRow,
  ExternalExaminerSubmissionRow,
} from "@/types/academic";

const ASSIGNMENT_FIELDS = "id, title, module_code";
const SUBMISSION_FIELDS = "id, assignment_id, student_id, student_name, student_email, status, submitted_at";
const GRADE_FIELDS = "submission_id, ai_score, lecturer_score, final_score, ai_feedback, lecturer_feedback, final_feedback, reviewed_at, reviewed_by";
const PROFILE_FIELDS = "id, full_name, email";

const EXPORTABLE_STATUSES = new Set(["moderated", "approved", "released"]);

const DEMO_EXTERNAL_EXAMINER_ASSIGNMENTS = [
  {
    id: "demo-assignment-policy-brief",
    title: "Strategic Policy Brief: Housing Affordability Interventions",
    moduleCode: "PPL502",
  },
  {
    id: "demo-assignment-ethics-review",
    title: "Research Ethics Review Memo",
    moduleCode: "SOC411",
  },
];

const DEMO_EXTERNAL_EXAMINER_EXPORT_DATA: ExternalExaminerExportRow[] = [
  {
    studentName: "Amina Hassan",
    studentEmail: "amina.hassan@demo.gradeai.test",
    assignmentTitle: "Strategic Policy Brief: Housing Affordability Interventions",
    moduleCode: "PPL502",
    aiScore: 68,
    lecturerScore: 70,
    finalScore: 69,
    aiFeedback:
      "The brief identifies the main affordability pressures clearly and uses current evidence effectively. Policy options are compared with reasonable balance, but the implementation risks need stronger quantification.",
    lecturerFeedback:
      "A well-structured brief with credible analysis. The strongest section is the evaluation of rent stabilisation trade-offs; the recommendation section should be more explicit about cost and political feasibility.",
    finalFeedback:
      "A strong policy brief that demonstrates sound judgement and use of evidence. To move into a clearer distinction range, tighten the implementation plan and support the final recommendation with sharper fiscal reasoning.",
    status: "released",
    submittedAt: "2026-04-11",
    reviewedAt: "2026-04-18",
    reviewedBy: "Dr Priya Malhotra",
    classification: "1st",
  },
  {
    studentName: "Daniel Reed",
    studentEmail: "daniel.reed@demo.gradeai.test",
    assignmentTitle: "Research Ethics Review Memo",
    moduleCode: "SOC411",
    aiScore: 61,
    lecturerScore: 63,
    finalScore: 62,
    aiFeedback:
      "The memo covers informed consent, confidentiality, and participant risk appropriately. The discussion of data retention is accurate, but the mitigation plan for vulnerable participants is underdeveloped.",
    lecturerFeedback:
      "Clear and competent overall. The ethical principles are understood, but the memo would benefit from a more critical treatment of power dynamics and withdrawal procedures.",
    finalFeedback:
      "A solid upper-second response with secure coverage of core ethics issues. Further depth in participant safeguarding and procedural detail would strengthen the analysis.",
    status: "approved",
    submittedAt: "2026-04-09",
    reviewedAt: "2026-04-16",
    reviewedBy: "Dr Priya Malhotra",
    classification: "2:1",
  },
];

const getClassification = (score: number | null): string => {
  if (score == null) return "—";
  if (score >= 70) return "1st";
  if (score >= 60) return "2:1";
  if (score >= 50) return "2:2";
  if (score >= 40) return "3rd";
  return "Fail";
};

const getExportSummary = (rows: ExternalExaminerExportRow[]) => {
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

const ExternalExaminerExport = () => {
  const { isDemo } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [assignments, setAssignments] = useState<Array<{ id: string; title: string; moduleCode: string }>>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("all");
  const [exportData, setExportData] = useState<ExternalExaminerExportRow[]>([]);
  const [includeOptions, setIncludeOptions] = useState({
    scores: true,
    feedback: true,
    moderation: true,
    aiBreakdown: false,
    studentIdentity: true,
  });

  useEffect(() => {
    if (isDemo) {
      setAssignments(DEMO_EXTERNAL_EXAMINER_ASSIGNMENTS);
      setExportData(DEMO_EXTERNAL_EXAMINER_EXPORT_DATA);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [{ data: assignmentsRaw }, { data: subsRaw }, { data: gradesRaw }, { data: profilesRaw }] = await Promise.all([
          supabase.from("assignments").select(ASSIGNMENT_FIELDS),
          supabase.from("submissions").select(SUBMISSION_FIELDS),
          supabase.from("grades").select(GRADE_FIELDS),
          supabase.from("profiles").select(PROFILE_FIELDS),
        ]);

        const assignmentRows = (assignmentsRaw ?? []) as ExternalExaminerAssignmentRow[];
        const submissionRows = (subsRaw ?? []) as ExternalExaminerSubmissionRow[];
        const gradeRows = (gradesRaw ?? []) as ExternalExaminerGradeRow[];
        const profileRows = (profilesRaw ?? []) as ExternalExaminerProfileRow[];

        setAssignments(
          assignmentRows.map((row) => ({
            id: row.id,
            title: row.title,
            moduleCode: row.module_code || "—",
          })),
        );

        const userMap = Object.fromEntries(
          profileRows.map((row) => [row.id, row.full_name || row.email || "Unknown"]),
        ) as Record<string, string>;

        const gradeMap = Object.fromEntries(
          gradeRows.map((row) => [row.submission_id, row]),
        ) as Record<string, ExternalExaminerGradeRow>;

        const assignmentMap = Object.fromEntries(
          assignmentRows.map((row) => [row.id, row]),
        ) as Record<string, ExternalExaminerAssignmentRow>;

        const data: ExternalExaminerExportRow[] = submissionRows
          .filter((submission) => EXPORTABLE_STATUSES.has(submission.status || ""))
          .map((row) => {
            const grade = gradeMap[row.id];
            const assignment = row.assignment_id ? assignmentMap[row.assignment_id] : undefined;
            const finalScore = grade?.final_score ?? grade?.lecturer_score ?? grade?.ai_score ?? null;

            return {
              studentName: row.student_name || userMap[row.student_id || ""] || "Unknown",
              studentEmail: row.student_email || "—",
              assignmentTitle: assignment?.title || "—",
              moduleCode: assignment?.module_code || "—",
              aiScore: grade?.ai_score ?? null,
              lecturerScore: grade?.lecturer_score ?? null,
              finalScore,
              aiFeedback: grade?.ai_feedback || "",
              lecturerFeedback: grade?.lecturer_feedback || "",
              finalFeedback: grade?.final_feedback || "",
              status: row.status || "—",
              submittedAt: safeFormatDate(row.submitted_at, "yyyy-MM-dd", "—"),
              reviewedAt: safeFormatDate(grade?.reviewed_at, "yyyy-MM-dd", "—"),
              reviewedBy: grade?.reviewed_by ? userMap[grade.reviewed_by] || grade.reviewed_by : "—",
              classification: getClassification(finalScore),
            };
          });

        setExportData(data);
      } catch (err) {
        log.error("Failed to generate external examiner export", err);
      }
      setLoading(false);
    };

    fetchData();
  }, [isDemo]);

  const filteredData = selectedAssignment === "all"
    ? exportData
    : exportData.filter((row) => row.assignmentTitle === assignments.find((assignment) => assignment.id === selectedAssignment)?.title);
  const exportSummary = getExportSummary(filteredData);

  const handleExport = (format: "csv" | "detailed") => {
    setExporting(true);
    try {
      const headers: string[] = [];
      if (includeOptions.studentIdentity) headers.push("Student Name", "Student Email");
      headers.push("Assignment", "Module Code");
      if (includeOptions.scores) headers.push("AI Score", "Lecturer Score", "Final Score", "Classification");
      if (includeOptions.feedback) headers.push("AI Feedback", "Lecturer Feedback", "Final Feedback");
      if (includeOptions.moderation) headers.push("Status", "Submitted", "Reviewed", "Reviewed By");

      const rows = filteredData.map((row) => {
        const csvRow: string[] = [];
        if (includeOptions.studentIdentity) csvRow.push(`"${row.studentName}"`, `"${row.studentEmail}"`);
        csvRow.push(`"${row.assignmentTitle}"`, `"${row.moduleCode}"`);
        if (includeOptions.scores) {
          csvRow.push(String(row.aiScore ?? ""), String(row.lecturerScore ?? ""), String(row.finalScore ?? ""), row.classification);
        }
        if (includeOptions.feedback) {
          csvRow.push(
            `"${row.aiFeedback.replace(/"/g, "\"\"")}"`,
            `"${row.lecturerFeedback.replace(/"/g, "\"\"")}"`,
            `"${row.finalFeedback.replace(/"/g, "\"\"")}"`,
          );
        }
        if (includeOptions.moderation) csvRow.push(row.status, row.submittedAt, row.reviewedAt, `"${row.reviewedBy}"`);
        return csvRow.join(",");
      });

      const csv = [headers.join(","), ...rows].join("\n");

      if (format === "detailed") {
        const scores = filteredData.map((row) => row.finalScore).filter((score): score is number => score != null);
        const avg = scores.length > 0 ? Math.round(scores.reduce((left, right) => left + right, 0) / scores.length) : 0;
        const passRate = scores.length > 0 ? Math.round((scores.filter((score) => score >= 40).length / scores.length) * 100) : 0;
        const moderated = filteredData.filter((row) => row.lecturerScore != null).length;

        const summary = [
          "",
          "",
          "EXTERNAL EXAMINER SUMMARY",
          `Report Generated: ${new Date().toISOString().slice(0, 10)}`,
          `Total Submissions: ${filteredData.length}`,
          `Average Score: ${avg}%`,
          `Pass Rate: ${passRate}%`,
          `Moderation Coverage: ${filteredData.length > 0 ? Math.round((moderated / filteredData.length) * 100) : 0}% (${moderated}/${filteredData.length})`,
          "",
          "GRADE DISTRIBUTION",
          `1st (>=70%): ${filteredData.filter((row) => row.classification === "1st").length}`,
          `2:1 (60-69%): ${filteredData.filter((row) => row.classification === "2:1").length}`,
          `2:2 (50-59%): ${filteredData.filter((row) => row.classification === "2:2").length}`,
          `3rd (40-49%): ${filteredData.filter((row) => row.classification === "3rd").length}`,
          `Fail (<40%): ${filteredData.filter((row) => row.classification === "Fail").length}`,
        ];

        downloadCSV(
          `${csv}\n${summary.join("\n")}`,
          `external_examiner_report_detailed_${new Date().toISOString().slice(0, 10)}.csv`,
        );
      } else {
        downloadCSV(csv, `external_examiner_export_${new Date().toISOString().slice(0, 10)}.csv`);
      }

      toast.success("Export downloaded successfully");
    } catch {
      toast.error("Failed to generate export");
    }
    setExporting(false);
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
            <span className="text-sm text-muted-foreground">Viewing demo export data</span>
          </CardContent>
        </Card>
      )}

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
              Only `moderated`, `approved`, and `released` submissions are included in the examiner export.
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
                : assignments.find((assignment) => assignment.id === selectedAssignment)?.title || "Filtered assignment"} | {filteredData.length} records ready
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
                  {assignments.map((assignment) => (
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
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.slice(0, 20).map((row, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-2">{row.studentName}</td>
                      <td className="max-w-[150px] truncate py-2">{row.assignmentTitle}</td>
                      <td className="py-2">{row.moduleCode}</td>
                      <td className="py-2 text-right">{row.aiScore ?? "—"}</td>
                      <td className="py-2 text-right">{row.lecturerScore ?? "—"}</td>
                      <td className="py-2 text-right font-medium">{row.finalScore ?? "—"}</td>
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
                <p className="py-8 text-center text-sm text-muted-foreground">No graded submissions to export yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExternalExaminerExport;
