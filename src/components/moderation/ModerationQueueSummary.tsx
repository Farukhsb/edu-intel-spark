import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCheck, Clock, Shield } from "lucide-react";

type ModerationQueueSummaryProps = {
  queueStats: {
    pending: number;
    inProgress: number;
    moderated: number;
    escalated: number;
  };
};

const summaryItems = [
  { label: "Pending", key: "pending", icon: Clock },
  { label: "In Progress", key: "inProgress", icon: Shield },
  { label: "Moderated", key: "moderated", icon: CheckCheck },
  { label: "Escalated", key: "escalated", icon: AlertTriangle },
] as const;

export const ModerationQueueSummary = ({ queueStats }: ModerationQueueSummaryProps) => (
  <div className="grid gap-4 md:grid-cols-4">
    {summaryItems.map((item) => (
      <Card key={item.label}>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <item.icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold font-display">{queueStats[item.key]}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);
