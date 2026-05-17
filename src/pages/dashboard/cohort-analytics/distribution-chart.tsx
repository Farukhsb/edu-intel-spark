import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

import type { GradeBand } from "./types";

export const GradeDistributionChart = ({ gradeDistChart }: { gradeDistChart: GradeBand[] }) => (
  <ResponsiveContainer width="100%" height={260}>
    <BarChart data={gradeDistChart}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
      <XAxis dataKey="band" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
      <Tooltip
        contentStyle={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "8px",
        }}
      />
      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
        {gradeDistChart.map((entry, index) => (
          <Cell key={index} fill={entry.fill} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);
