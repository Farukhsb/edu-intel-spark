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

interface ExportData {
  studentName: string;
  studentEmail: string;
  assignmentTitle: string;
  moduleCode: string;
  aiScore: number | null;
  lecturerScore: number | null;
  finalScore: number | null;
  aiFeedback: string;
  lecturerFeedback: string;
  finalFeedback: string;
  status: string;
  submittedAt: string;
  reviewedAt: string;
  reviewedBy: string;
  classification: string;
}

const getClassification = (score: number | null): string => {
  if (score == null) return "—";
  if (score >= 70) return "1st";
  if (score >= 60) return "2:1";
  if (score >= 50) return "2:2";
  if (score >= 40) return "3rd";
  return "Fail";
};

const ExternalExaminerExport = () => {
  const { isDemo } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [assignments, setAssignments] = useState<{ id: string; title: string; moduleCode: string }[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("all");
  const [exportData, setExportData] = useState<ExportData[]>([]);
  const [includeOptions, setIncludeOptions] = useState({
    scores: true,
    feedback: true,
    moderation: true,
    aiBreakdown: false,
    studentIdentity: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: assignmentsRaw }, { data: subsRaw }, { data: gradesRaw }, { data: profilesRaw }] = await Promise.all([
          supabase.from("assignments").select("*"),
          supabase.from("submissions").select("*"),
          supabase.from("grades").select("*"),
          supabase.from("profiles").select("*"),
        ]);

        const assignmentList = (assignmentsRaw || []).map(d => ({
          id: d.id,
          title: d.title,
          moduleCode: d.module_code || "—",
        }));
        setAssignments(assignmentList);

        const userMap: Record<string, string> = {};
        (profilesRaw || []).forEach(d => { userMap[d.id] = d.full_name || d.email || "Unknown"; });

        const gradeMap: Record<string, any> = {};
        (gradesRaw || []).forEach(d => { gradeMap[d.submission_id] = d; });

        const assignmentMap: Record<string, any> = {};
        (assignmentsRaw || []).forEach(d => { assignmentMap[d.id] = d; });

        const data: ExportData[] = (subsRaw || []).map(d => {
          const grade = gradeMap[d.id] || {};
          const assignment = assignmentMap[d.assignment_id] || {};
          const finalScore = grade.final_score ?? grade.lecturer_score ?? grade.ai_score ?? null;

          return {
            studentName: d.student_name || userMap[d.student_id || ""] || "Unknown",
            studentEmail: d.student_email || "—",
            assignmentTitle: assignment.title || "—",
            moduleCode: assignment.module_code || "—",
            aiScore: grade.ai_score ?? null,
            lecturerScore: grade.lecturer_score ?? null,
            finalScore,
            aiFeedback: grade.ai_feedback || "",
            lecturerFeedback: grade.lecturer_feedback || "",
            finalFeedback: grade.final_feedback || "",
            status: d.status || "—",
            submittedAt: d.submitted_at ? new Date(d.submitted_at).toISOString().slice(0, 10) : "—",
            reviewedAt: grade.reviewed_at ? new Date(grade.reviewed_at).toISOString().slice(0, 10) : "—",
            reviewedBy: grade.reviewed_by ? (userMap[grade.reviewed_by] || grade.reviewed_by) : "—",
            classification: getClassification(finalScore),
          };
        });

        setExportData(data);
      } catch (err) { console.error(err); }
      setLoading(false);
    };

    fetchData();
  }, []);

  const filteredData = selectedAssignment === "all"
    ? exportData
    : exportData.filter(d => d.assignmentTitle === assignments.find(a => a.id === selectedAssignment)?.title);

  const handleExport = (format: "csv" | "detailed") => {
    setExporting(true);
    try {
      const headers: string[] = [];
      if (includeOptions.studentIdentity) headers.push("Student Name", "Student Email");
      headers.push("Assignment", "Module Code");
      if (includeOptions.scores) headers.push("AI Score", "Lecturer Score", "Final Score", "Classification");
      if (includeOptions.feedback) headers.push("AI Feedback", "Lecturer Feedback", "Final Feedback");
      if (includeOptions.moderation) headers.push("Status", "Submitted", "Reviewed", "Reviewed By");

      const rows = filteredData.map(d => {
        const row: string[] = [];
        if (includeOptions.studentIdentity) row.push(`"${d.studentName}"`, `"${d.studentEmail}"`);
        row.push(`"${d.assignmentTitle}"`, `"${d.moduleCode}"`);
        if (includeOptions.scores) row.push(String(d.aiScore ?? ""), String(d.lecturerScore ?? ""), String(d.finalScore ?? ""), d.classification);
        if (includeOptions.feedback) row.push(`"${d.aiFeedback.replace(/"/g, '""')}"`, `"${d.lecturerFeedback.replace(/"/g, '""')}"`, `"${d.finalFeedback.replace(/"/g, '""')}"`);
        if (includeOptions.moderation) row.push(d.status, d.submittedAt, d.reviewedAt, `"${d.reviewedBy}"`);
        return row.join(",");
      });

      const csv = [headers.join(","), ...rows].join("\n");

      if (format === "detailed") {
        // Add summary section
        const scores = filteredData.map(d => d.finalScore).filter((s): s is number => s != null);
        const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const passRate = scores.length > 0 ? Math.round((scores.filter(s => s >= 40).length / scores.length) * 100) : 0;
        const moderated = filteredData.filter(d => d.lecturerScore != null).length;

        const summary = [
          "", "",
          "EXTERNAL EXAMINER SUMMARY",
          `Report Generated: ${new Date().toISOString().slice(0, 10)}`,
          `Total Submissions: ${filteredData.length}`,
          `Average Score: ${avg}%`,
          `Pass Rate: ${passRate}%`,
          `Moderation Coverage: ${filteredData.length > 0 ? Math.round((moderated / filteredData.length) * 100) : 0}% (${moderated}/${filteredData.length})`,
          "",
          "GRADE DISTRIBUTION",
          `1st (≥70%): ${filteredData.filter(d => d.classification === "1st").length}`,
          `2:1 (60-69%): ${filteredData.filter(d => d.classification === "2:1").length}`,
          `2:2 (50-59%): ${filteredData.filter(d => d.classification === "2:2").length}`,
          `3rd (40-49%): ${filteredData.filter(d => d.classification === "3rd").length}`,
          `Fail (<40%): ${filteredData.filter(d => d.classification === "Fail").length}`,
        ];

        const fullCsv = csv + "\n" + summary.join("\n");
        downloadCSV(fullCsv, `external_examiner_report_detailed_${new Date().toISOString().slice(0, 10)}.csv`);
      } else {
        downloadCSV(csv, `external_examiner_export_${new Date().toISOString().slice(0, 10)}.csv`);
      }

      toast.success("Export downloaded successfully");
    } catch (err) {
      toast.error("Failed to generate export");
    }
    setExporting(false);
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Export Configuration</CardTitle>
            <CardDescription>Configure what data to include</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="text-sm font-medium mb-2 block">Filter by Assignment</label>
              <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                <SelectTrigger><SelectValue placeholder="All assignments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignments</SelectItem>
                  {assignments.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.title} ({a.moduleCode})</SelectItem>
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
              ].map(opt => (
                <div key={opt.key} className="flex items-center gap-2">
                  <Checkbox
                    id={opt.key}
                    checked={includeOptions[opt.key]}
                    onCheckedChange={(checked) => setIncludeOptions(prev => ({ ...prev, [opt.key]: !!checked }))}
                  />
                  <label htmlFor={opt.key} className="text-sm cursor-pointer">{opt.label}</label>
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

        {/* Preview */}
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
                    <th className="pb-2 font-medium text-right">AI</th>
                    <th className="pb-2 font-medium text-right">Lecturer</th>
                    <th className="pb-2 font-medium text-right">Final</th>
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.slice(0, 20).map((d, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">{d.studentName}</td>
                      <td className="py-2 max-w-[150px] truncate">{d.assignmentTitle}</td>
                      <td className="py-2">{d.moduleCode}</td>
                      <td className="py-2 text-right">{d.aiScore ?? "—"}</td>
                      <td className="py-2 text-right">{d.lecturerScore ?? "—"}</td>
                      <td className="py-2 text-right font-medium">{d.finalScore ?? "—"}</td>
                      <td className="py-2"><Badge variant="outline" className="text-xs">{d.classification}</Badge></td>
                      <td className="py-2"><Badge variant={d.status === "released" ? "default" : "secondary"} className="text-xs">{d.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredData.length > 20 && (
                <p className="text-xs text-muted-foreground text-center mt-3">Showing 20 of {filteredData.length} records. Export for full data.</p>
              )}
              {filteredData.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No graded submissions to export yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExternalExaminerExport;
