import { AlertTriangle, Bell, Clock3 } from "lucide-react";

import { DashboardSignalBadge } from "@/components/dashboard/PageStates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OperationalAlertCard, OperationalFailureCard } from "@/lib/operationalMonitoring";

export const OperationalFailureSection = ({
  cards,
}: {
  cards: OperationalFailureCard[];
}) => (
  <Card className="border-border/70 shadow-sm">
    <CardHeader className="border-b border-border/60 pb-4">
      <CardTitle className="text-base">Failure dashboard</CardTitle>
      <CardDescription>Observed bottlenecks and failure-oriented workflow signals that deserve operational triage.</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.title} className="rounded-xl border border-border/70 bg-background/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">{card.title}</p>
              <DashboardSignalBadge type={card.signalType} />
            </div>
            <Badge
              variant="outline"
              className={
                card.tone === "healthy"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  : card.tone === "warning"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                    : "border-slate-500/30 bg-slate-500/10 text-slate-700"
              }
            >
              {card.value}
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{card.detail}</p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.action}</p>
        </div>
      ))}
    </CardContent>
  </Card>
);

export const OperationalAlertSection = ({
  cards,
}: {
  cards: OperationalAlertCard[];
}) => (
  <Card className="border-border/70 shadow-sm">
    <CardHeader className="border-b border-border/60 pb-4">
      <CardTitle className="text-base">Operational alerts</CardTitle>
      <CardDescription>Threshold-based signals that indicate when live telemetry needs attention.</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.title} className="rounded-xl border border-border/70 bg-background/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">{card.title}</p>
              <DashboardSignalBadge type={card.signalType} />
            </div>
            <Badge
              variant="outline"
              className={
                card.tone === "healthy"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  : card.tone === "warning"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                    : "border-slate-500/30 bg-slate-500/10 text-slate-700"
              }
            >
              {card.tone === "healthy" ? <Bell className="mr-1 h-3.5 w-3.5" /> : card.tone === "warning" ? <AlertTriangle className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}
              {card.value}
            </Badge>
          </div>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.threshold}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.detail}</p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.action}</p>
        </div>
      ))}
    </CardContent>
  </Card>
);
