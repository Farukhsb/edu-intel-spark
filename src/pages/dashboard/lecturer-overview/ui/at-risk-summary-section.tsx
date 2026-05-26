import { AlertTriangle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { LecturerOverviewAtRiskSummary } from "../types";

const riskBadgeVariant = (riskLevel: LecturerOverviewAtRiskSummary["riskLevel"]) => {
  if (riskLevel === "critical") return "destructive" as const;
  if (riskLevel === "high") return "secondary" as const;
  return "outline" as const;
};

export const LecturerOverviewAtRiskSummarySection = ({
  students,
}: {
  students: LecturerOverviewAtRiskSummary[];
}) => {
  const navigate = useNavigate();

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Highest-risk students</CardTitle>
        <CardDescription>Open the most urgent support cases directly from the overview.</CardDescription>
      </CardHeader>
      <CardContent>
        {students.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No high-priority support cases are visible right now.
          </div>
        ) : (
          <div className="space-y-2.5">
            {students.map((student) => (
              <button
                key={student.studentId}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted/30"
                onClick={() => navigate(`/dashboard/student/${encodeURIComponent(student.studentId)}`)}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{student.name}</p>
                    <Badge variant={riskBadgeVariant(student.riskLevel)} className="text-[10px] uppercase">
                      {student.riskLevel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{student.signal}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <span>{student.riskScore}/100</span>
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <ArrowRight className="h-4 w-4" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
