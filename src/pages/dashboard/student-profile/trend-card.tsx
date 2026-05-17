import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { StudentInsightData } from "@/lib/studentProfile";

export const StudentGradesTrendCard = ({
  student,
  trendDirection,
}: {
  student: StudentInsightData;
  trendDirection: "up" | "down" | "steady";
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Recent Grades Trend</CardTitle>
      <CardDescription>Latest assessment performance over time</CardDescription>
    </CardHeader>
    <CardContent>
      {student.chart.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No graded work yet for this student.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={student.chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="assessment" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Line
              type="monotone"
              dataKey="grade"
              stroke={trendDirection === "down" ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
              strokeWidth={2.5}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>
);
