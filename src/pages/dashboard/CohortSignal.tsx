import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useCohortSignalController } from "./cohortsignal/useCohortSignalController";
import { CohortSignalHeatmapView } from "@/pages/cohortsignal/HeatmapView";

const CohortSignal = () => {
  const { profile } = useAuth();
  const {
    state: { loading, error, students, bandReport, failureReport },
    actions: { logIntervention, reload },
  } = useCohortSignalController();
  const readOnly = profile?.role === "admin";
  const authorized = profile?.role === "admin" || profile?.role === "lecturer";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl">Loading CohortSignal</CardTitle>
            <p className="text-sm text-muted-foreground">Fetching the current lecturer cohort, grades, and interventions.</p>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader className="space-y-2 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
            <CardTitle className="text-2xl">CohortSignal unavailable</CardTitle>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button onClick={reload}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader className="space-y-2 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
            <CardTitle className="text-2xl">CohortSignal access required</CardTitle>
            <p className="text-sm text-muted-foreground">This view is limited to lecturer and admin accounts.</p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <CohortSignalHeatmapView
      title="CohortSignal | Live cohort heatmap"
      description="Live lecturer cohort heatmap with model-backed failure prediction, filters, and intervention logging."
      path="/dashboard/cohortsignal"
      robots="noindex,follow"
      bannerLabel={readOnly ? "Live admin oversight" : "Live lecturer system"}
      bannerIcon={<ShieldAlert className="h-3.5 w-3.5" />}
      introText={
        readOnly
          ? "A live oversight workflow powered by lecturer submissions, grades, and intervention records already in the system."
          : "A live student support workflow powered by lecturer submissions, grades, and intervention records already in the system."
      }
      modelQualityDescription="Deterministic holdout and 5-fold cross-validation metrics from the live cohort."
      students={students}
      bandReport={bandReport}
      failureReport={failureReport}
      isDemo={false}
      readOnly={readOnly}
      onLogIntervention={readOnly ? undefined : logIntervention}
    />
  );
};

export default CohortSignal;
