import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssessmentTrendEntry, GradeDistributionEntry } from "@/lib/performanceAnalytics";

export const AssessmentTrendsCard = ({ assessmentTrends }: { assessmentTrends: AssessmentTrendEntry[] }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Average Grades Over Time</CardTitle>
      <CardDescription>Assessment performance across your assignments</CardDescription>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={assessmentTrends}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
          <Legend />
          <Line type="monotone" dataKey="avgGrade" name="Avg Grade %" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

export const GradeDistributionCard = ({ gradeDist }: { gradeDist: GradeDistributionEntry[] }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Grade Distribution</CardTitle>
      <CardDescription>Current cohort breakdown by UK classification</CardDescription>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={gradeDist} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis type="category" dataKey="band" tick={{ fontSize: 10 }} width={100} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
            formatter={(value: ValueType | undefined, _name: NameType | undefined) => {
              const count = typeof value === "number" ? value : Number(value ?? 0);
              return [`${count} students`, "Count"];
            }}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]}>
            {gradeDist.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);
