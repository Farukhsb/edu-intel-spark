import { Suspense, lazy } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminInstitutionSummary } from "../types";

const BulkStudentUpload = lazy(() =>
  import("@/components/BulkStudentUpload").then((module) => ({
    default: module.BulkStudentUpload,
  })),
);

export const DashboardHeader = ({
  institution,
  refreshing,
  onRefresh,
  showBulkUpload,
}: {
  institution: AdminInstitutionSummary | null;
  refreshing: boolean;
  onRefresh: () => void;
  showBulkUpload: boolean;
}) => (
  <Card className="border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.16),hsl(var(--primary)/0.05)_42%,transparent)] shadow-sm">
    <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/25 bg-background/70">
            Admin Workspace
          </Badge>
          {institution ? (
            <Badge variant="secondary" className="bg-background/80 text-foreground">
              {institution.name}
            </Badge>
          ) : null}
          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Platform Oversight</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-display tracking-tight md:text-3xl">GradeAI Admin Dashboard</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Monitor platform health, academic workflow progress, integrity risk, moderation load, and protected role activity
            without borrowing the lecturer workflow.
          </p>
          {institution ? (
            <p className="text-xs text-muted-foreground">
              Tenant scope: <span className="font-medium text-foreground">{institution.slug}</span> · {institution.status}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {showBulkUpload ? (
          <Suspense
            fallback={
              <Button variant="outline" disabled>
                Bulk Student Upload
              </Button>
            }
          >
            <BulkStudentUpload />
          </Suspense>
        ) : null}
        <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh snapshot
        </Button>
      </div>
    </CardContent>
  </Card>
);
