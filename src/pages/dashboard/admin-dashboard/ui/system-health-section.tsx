import { AlertTriangle, Clock3, Mail, Settings2, Shield, ShieldCheck } from "lucide-react";

import { DashboardSignalBadge } from "@/components/dashboard/PageStates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OperationalHealthItem } from "@/lib/operationalMonitoring";

export const SystemHealthSection = ({
  items,
}: {
  items: OperationalHealthItem[];
}) => (
  <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-base">System health</CardTitle>
        <CardDescription>Operational signals for the core services the platform depends on.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 p-6 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-border/70 bg-background/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">{item.label}</p>
                <DashboardSignalBadge type={item.signalType} />
              </div>
              <Badge
                variant="outline"
                className={
                  item.tone === "healthy"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                    : item.tone === "warning"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                      : "border-slate-500/30 bg-slate-500/10 text-slate-700"
                }
              >
                {item.tone === "healthy" ? <ShieldCheck className="mr-1 h-3.5 w-3.5" /> : item.tone === "warning" ? <AlertTriangle className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}
                {item.statusLabel}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>

    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-base">Governance controls</CardTitle>
        <CardDescription>Current controls that are monitored at platform level, even where editing remains intentionally restricted.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-6 text-sm">
        <div className="rounded-xl border border-border/70 p-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            <p className="font-medium">AI grading controls</p>
          </div>
          <p className="mt-2 text-muted-foreground">Enabled state and grading thresholds are currently backend-governed. This view makes the control area visible without exposing direct runtime edits.</p>
        </div>
        <div className="rounded-xl border border-border/70 p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <p className="font-medium">Integrity thresholds</p>
          </div>
          <p className="mt-2 text-muted-foreground">Similarity, AI-writing, and baseline-deviation thresholds are treated as monitored academic controls rather than inline admin settings.</p>
        </div>
        <div className="rounded-xl border border-border/70 p-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <p className="font-medium">Notifications and maintenance</p>
          </div>
          <p className="mt-2 text-muted-foreground">Notification delivery and maintenance controls are managed outside this dashboard today. This panel signals the governance area without implying that those switches are available here.</p>
        </div>
      </CardContent>
    </Card>
  </div>
);
