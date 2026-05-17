import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { distributionInterpretation } from "../useLecturerOverviewController";
import type { LecturerOverviewDistributionBand } from "../types";

export const LecturerOverviewGradeDistributionSection = ({
  gradeDistribution,
  totalScored,
}: {
  gradeDistribution: LecturerOverviewDistributionBand[];
  totalScored: number;
}) => (
  <Card className="shadow-sm">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">Grade Distribution</CardTitle>
      <CardDescription>{totalScored} graded submission{totalScored === 1 ? "" : "s"}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {totalScored === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">No grades yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Distribution insights will appear after submissions have been graded.
          </p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={gradeDistribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {gradeDistribution.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            {distributionInterpretation(gradeDistribution)}
          </div>
        </>
      )}
    </CardContent>
  </Card>
);
