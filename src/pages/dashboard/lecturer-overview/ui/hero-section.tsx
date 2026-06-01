import { Sparkles } from "lucide-react";

import { HybridGradeImportDialog } from "@/components/dashboard/HybridGradeImportDialog";
import { getFirstName } from "@/lib/formatters";
import type { LecturerOverviewAssignment } from "../types";

export const LecturerOverviewHeroSection = ({
  profile,
  heroSummary,
  assignments,
}: {
  profile: { full_name?: string | null } | null | undefined;
  heroSummary: string;
  assignments: LecturerOverviewAssignment[];
}) => {
  return (
    <section className="rounded-2xl border border-border/60 bg-background/70 px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Teaching overview</p>
            <h2 className="text-lg font-bold font-display">
              Welcome back, {getFirstName(profile?.full_name, "Lecturer")}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">{heroSummary}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <HybridGradeImportDialog assignments={assignments} triggerLabel="Import Grades" />
        </div>
      </div>
    </section>
  );
};
