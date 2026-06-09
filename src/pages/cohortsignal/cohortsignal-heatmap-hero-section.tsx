import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Filter,
  GraduationCap,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HeroProps = {
  bannerLabel: string;
  bannerIcon?: ReactNode;
  introText: string;
  totalStudents: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  interventionsLoggedThisWeek: number;
};

export const CohortSignalHeroSection = ({
  bannerLabel,
  bannerIcon,
  introText,
  totalStudents,
  highRiskCount,
  mediumRiskCount,
  lowRiskCount,
  interventionsLoggedThisWeek,
}: HeroProps) => {
  return (
    <section className="overflow-hidden rounded-3xl border border-primary/15 bg-card/90 shadow-[0_24px_70px_-35px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.9fr] lg:p-8">
        <div className="space-y-4">
          <Badge variant="secondary" className="w-fit gap-2 px-3 py-1.5">
            {bannerIcon ?? <Sparkles className="h-3.5 w-3.5" />}
            {bannerLabel}
          </Badge>
          <div className="space-y-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">CohortSignal cohort heatmap</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{introText}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5">
              <Filter className="h-3.5 w-3.5" />
              Filters for risk, module, intervention state, trend, and missing submissions
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5">
              <Users className="h-3.5 w-3.5" />
              Keyboard accessible tiles and a right-hand detail panel
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Total students", value: totalStudents, icon: GraduationCap, testId: "summary-total-students" },
            { label: "High risk", value: highRiskCount, icon: ShieldAlert, testId: "summary-high-risk" },
            { label: "Medium risk", value: mediumRiskCount, icon: AlertTriangle, testId: "summary-medium-risk" },
            { label: "Low risk", value: lowRiskCount, icon: CheckCircle2, testId: "summary-low-risk" },
            {
              label: "Interventions logged this week",
              value: interventionsLoggedThisWeek,
              icon: Clock3,
              fullWidth: true,
              testId: "summary-interventions",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.label}
                data-testid={card.testId}
                className={cn(
                  "border-primary/10 bg-background/80 shadow-none backdrop-blur",
                  card.fullWidth ? "sm:col-span-2" : "",
                )}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight">{card.value}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

