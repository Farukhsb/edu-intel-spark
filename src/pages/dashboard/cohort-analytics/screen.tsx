import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLiveBanner } from "@/components/dashboard/PageStates";
import { cohortDashboardViewComponents, type CohortDashboardView } from "./views";
import { useCohortAnalyticsController } from "./useCohortAnalyticsController";

type CohortAnalyticsScreenProps = ReturnType<typeof useCohortAnalyticsController>;

const COHORT_VIEWS: Array<{
  value: CohortDashboardView;
  label: string;
  description: string;
}> = [
  {
    value: "tutor",
    label: "Personal tutor",
    description: "Student support, interventions, and early risk follow-up.",
  },
  {
    value: "course-leader",
    label: "Course leader",
    description: "Module comparison, grading spread, and cohort pacing.",
  },
  {
    value: "hod",
    label: "Head of Department",
    description: "Programme oversight, readiness, and governance signals.",
  },
];

const isCohortDashboardView = (value: string | null): value is CohortDashboardView =>
  value === "tutor" || value === "course-leader" || value === "hod";

export const CohortAnalyticsScreen = (props: CohortAnalyticsScreenProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  const ltiContextId = searchParams.get("ltiContextId");
  const ltiResourceLinkId = searchParams.get("ltiResourceLinkId");
  const activeView: CohortDashboardView = isCohortDashboardView(viewParam) ? viewParam : "tutor";

  useEffect(() => {
    if (viewParam === activeView) return;
    const next = new URLSearchParams(searchParams);
    next.set("view", activeView);
    setSearchParams(next, { replace: true });
  }, [activeView, searchParams, setSearchParams, viewParam]);

  const viewProps = {
    modules: props.modules,
    moduleFilter: props.moduleFilter,
    setModuleFilter: props.setModuleFilter,
    gradeDistChart: props.gradeDistChart,
    filteredModules: props.filteredModules,
    visibleRecommendations: props.visibleRecommendations,
    reportingReadiness: props.reportingReadiness,
    topAtRiskStudents: props.topAtRiskStudents,
    actingId: props.actingId,
    handleReview: props.handleReview,
    handleDismiss: props.handleDismiss,
    handleCreateIntervention: props.handleCreateIntervention,
    handleCopyWorkflowLink: props.handleCopyWorkflowLink,
  };

  const ActiveViewComponent = cohortDashboardViewComponents[activeView];

  return (
    <div className="space-y-6 animate-fade-in">
      {(ltiContextId || ltiResourceLinkId) ? <DashboardLiveBanner label="Launched from your LMS." /> : null}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-base">Cohort Dashboard</CardTitle>
          <CardDescription>
            A cohort-level workspace split for personal tutors, course leaders, and Heads of Department.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={activeView}
            onValueChange={(value) => {
              if (!isCohortDashboardView(value)) return;
              const next = new URLSearchParams(searchParams);
              next.set("view", value);
              setSearchParams(next, { replace: true });
            }}
          >
            <TabsList className="grid h-auto w-full grid-cols-3">
              {COHORT_VIEWS.map((view) => (
                <TabsTrigger key={view.value} value={view.value} className="flex min-h-12 flex-col items-start gap-0.5 py-3 text-left">
                  <span>{view.label}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">{view.description}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active view</p>
              <p className="text-sm font-semibold">
                {COHORT_VIEWS.find((view) => view.value === activeView)?.label ?? "Personal tutor"}
              </p>
              <p className="text-sm text-muted-foreground">
                {COHORT_VIEWS.find((view) => view.value === activeView)?.description}
              </p>
            </div>

            <div className="w-full md:w-[320px]">
              <Select value={props.moduleFilter} onValueChange={props.setModuleFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by assignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignments</SelectItem>
                  {props.modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.moduleCode ? `${module.moduleCode} - ` : ""}
                      {module.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <ActiveViewComponent {...viewProps} />
    </div>
  );
};

export default CohortAnalyticsScreen;
