import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
    <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold font-display">
              Welcome back, {profile?.full_name?.split(" ")[0] || "Lecturer"}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">{heroSummary}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline" className="border-primary/20 bg-background/70 text-xs">
                {stats.assignmentCount} active assignment{stats.assignmentCount === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline" className="border-primary/20 bg-background/70 text-xs">
                {stats.activeStudents} active student{stats.activeStudents === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
