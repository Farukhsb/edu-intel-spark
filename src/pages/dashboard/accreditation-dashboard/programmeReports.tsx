import { useEffect, useState } from "react";
import { BookOpen, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState, DashboardLoadingState } from "@/components/dashboard/PageStates";
import { fetchProgrammeReportDataset } from "@/lib/data/academic";
import { log } from "@/lib/logger";
import { deriveProgrammeReports, type ProgrammeReport } from "@/lib/accreditationMetrics";
import { DEMO_PROGRAMME_REPORTS } from "./demoData";

const exportProgrammeReport = (programmes: ProgrammeReport[]) => {
  const lines = ["Programme-Level Report - GradeAI", `Generated: ${new Date().toISOString().slice(0, 10)}`, ""];
  lines.push("Module,Submissions,Graded,Avg Score,Pass Rate,1st,2:1,2:2,3rd,Fail");
  programmes.forEach((programme) =>
    lines.push(
      `${programme.code},${programme.submissions},${programme.graded},${programme.avg}%,${programme.passRate}%,${programme.firstClass}%,${programme.twoOne}%,${programme.twoTwo}%,${programme.third}%,${programme.fail}%`,
    ),
  );

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `programme_report_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const ProgrammeReports = ({ isDemo }: { isDemo: boolean }) => {
  const [loading, setLoading] = useState(!isDemo);
  const [programmes, setProgrammes] = useState<ProgrammeReport[]>([]);

  useEffect(() => {
    if (isDemo) {
      setProgrammes(DEMO_PROGRAMME_REPORTS);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const { assignments, submissions, grades } = await fetchProgrammeReportDataset();

        setProgrammes(
          deriveProgrammeReports({
            assignments,
            submissions,
            grades,
          }),
        );
      } catch (error) {
        log.error("Failed to load programme report data", error);
        setProgrammes([]);
      }
      setLoading(false);
    };

    void fetchData();
  }, [isDemo]);

  if (loading) return <DashboardLoadingState />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Programme-Level Reports</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportProgrammeReport(programmes)}>
            <Download className="mr-2 h-3.5 w-3.5" /> Export
          </Button>
        </div>
        <CardDescription>Grade distributions and pass rates per module with UK classification breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {programmes.map((programme, index) => (
            <div key={`${programme.code}-${index}`} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{programme.code}</span>
                  <p className="text-xs text-muted-foreground">
                    {programme.submissions} submissions · {programme.graded} graded
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold">{programme.avg}%</span>
                  <p className="text-xs text-muted-foreground">avg score</p>
                </div>
              </div>
              <div className="flex gap-1 h-6 rounded-full overflow-hidden">
                {programme.firstClass > 0 && <div className="bg-success" style={{ width: `${programme.firstClass}%` }} title={`1st: ${programme.firstClass}%`} />}
                {programme.twoOne > 0 && <div className="bg-primary" style={{ width: `${programme.twoOne}%` }} title={`2:1: ${programme.twoOne}%`} />}
                {programme.twoTwo > 0 && <div className="bg-warning" style={{ width: `${programme.twoTwo}%` }} title={`2:2: ${programme.twoTwo}%`} />}
                {programme.third > 0 && <div className="bg-orange-400" style={{ width: `${programme.third}%` }} title={`3rd: ${programme.third}%`} />}
                {programme.fail > 0 && <div className="bg-destructive" style={{ width: `${programme.fail}%` }} title={`Fail: ${programme.fail}%`} />}
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> 1st: {programme.firstClass}%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> 2:1: {programme.twoOne}%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" /> 2:2: {programme.twoTwo}%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" /> 3rd: {programme.third}%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> Fail: {programme.fail}%</span>
                <span className="ml-auto">Pass rate: <strong>{programme.passRate}%</strong></span>
              </div>
            </div>
          ))}
          {programmes.length === 0 && (
            <DashboardEmptyState
              title="No programme data available yet"
              description="Create assignments with module codes to generate reports."
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};
