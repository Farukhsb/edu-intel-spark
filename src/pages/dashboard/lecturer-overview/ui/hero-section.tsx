import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { LecturerOverviewStats } from "../types";

export const LecturerOverviewHeroSection = ({
  profile,
  heroSummary,
  stats,
}: {
  profile: { full_name?: string | null } | null | undefined;
  heroSummary: string;
  stats: LecturerOverviewStats;
}) => {
  return (
    <section className="rounded-2xl border border-border/60 bg-background/70 px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Teaching overview</p>
          <h2 className="text-lg font-bold font-display">
            Welcome back, {profile?.full_name?.split(" ")[0] || "Lecturer"}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{heroSummary}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline" className="border-primary/20 bg-background text-xs">
              {stats.assignmentCount} active assignment{stats.assignmentCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline" className="border-primary/20 bg-background text-xs">
              {stats.activeStudents} active student{stats.activeStudents === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
      </div>
    </section>
  );
};
