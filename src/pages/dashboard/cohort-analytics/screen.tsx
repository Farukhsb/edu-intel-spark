import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Shield,
  TrendingDown,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DashboardEmptyState } from "@/components/dashboard/PageStates";
import {
  formatStatusLabel,
  severityVariant,
  statusVariant,
  useCohortAnalyticsController,
} from "./useCohortAnalyticsController";

type CohortAnalyticsScreenProps = ReturnType<typeof useCohortAnalyticsController>;

export const CohortAnalyticsScreen = ({
  modules,
  moduleFilter,
  setModuleFilter,
  gradeDistChart,
  filteredModules,
  visibleRecommendations,
  reportingReadiness,
  actingId,
  handleReview,
  handleDismiss,
  handleCreateIntervention,
}: CohortAnalyticsScreenProps) => (
  <div className="space-y-6 animate-fade-in">
    <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="text-base">Reporting Readiness</CardTitle>
        <CardDescription>
          A compact reading of which cohort-level signal is most likely to need intervention or explanation next.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-background/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current posture</p>
          <p className="mt-2 text-sm font-semibold">{reportingReadiness.postureLabel}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Based on the current recommendation severity mix and weakest assignment performance in this cohort view.
          </p>
        </div>
        <div className="rounded-lg border bg-background/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely challenge</p>
          <p className="mt-2 text-sm font-semibold">{reportingReadiness.likelyChallenge}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This is the cohort signal most likely to require either direct action or a clear quality-review explanation.
          </p>
        </div>
        <div className="rounded-lg border bg-background/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next action</p>
          <p className="mt-2 text-sm font-semibold">{reportingReadiness.bestNextAction}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use this to decide whether to move into student-risk follow-up, integrity review, or assignment remediation first.
          </p>
        </div>
      </CardContent>
    </Card>

    {modules.length > 0 && (
      <div className="flex items-center gap-4">
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Filter by assignment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignments</SelectItem>
            {modules.map((module) => (
              <SelectItem key={module.id} value={module.id}>
                {module.moduleCode ? `${module.moduleCode} - ` : ""}
                {module.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )}

    <Tabs defaultValue="distribution">
      <TabsList>
        <TabsTrigger value="distribution">Grade Distribution</TabsTrigger>
        <TabsTrigger value="modules">Assignment Comparison</TabsTrigger>
        <TabsTrigger value="recommendations">AI Recommendations</TabsTrigger>
      </TabsList>

      <TabsContent value="distribution" className="mt-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grade Distribution</CardTitle>
            <CardDescription>
              {moduleFilter === "all" ? "Cohort classification breakdown" : "Distribution for the selected assignment"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {gradeDistChart.every((item) => item.count === 0) ? (
              <DashboardEmptyState
                title="No graded submissions yet"
                description="Grade distribution will appear after assignments are graded."
              />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={gradeDistChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="band" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {gradeDistChart.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="modules" className="mt-4">
        {filteredModules.length === 0 ? (
          <DashboardEmptyState
            title="No assignments found"
            description="Assignment comparison appears after assignments and grading data are available."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredModules.map((module) => (
              <Card key={module.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">
                        {module.moduleCode ? `${module.moduleCode} - ` : ""}
                        {module.title}
                      </p>
                      <p className="mt-1 text-3xl font-bold font-display">
                        {module.gradedCount > 0 ? `${module.avgScore}%` : "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">Average Grade</p>
                    </div>
                    {module.submissions > 0 && (
                      <Badge
                        variant={
                          module.passRate >= 80 ? "default" : module.passRate >= 70 ? "secondary" : "destructive"
                        }
                      >
                        {module.passRate}% pass
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>{module.submissions} submissions</span>
                    <span>{module.gradedCount} graded</span>
                    <span>{module.failRate}% fail rate</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="recommendations" className="mt-4 space-y-4">
        {visibleRecommendations.length === 0 ? (
          <DashboardEmptyState
            title="No recommendations yet"
            description="Explainable recommendations will appear here once enough analytics data is available."
          />
        ) : (
          visibleRecommendations.map((recommendation) => (
            <Card key={recommendation.id} className="border-l-4 border-l-primary">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-3">
                    <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-sm">{recommendation.title}</h3>
                        <Badge variant={severityVariant(recommendation.severity)} className="text-xs">
                          {recommendation.severity}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {recommendation.type}
                        </Badge>
                        <Badge variant={statusVariant(recommendation.status)} className="text-xs">
                          {formatStatusLabel(recommendation.status)}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground">{recommendation.summary}</p>
                      <p className="text-sm">{recommendation.explanation}</p>

                      <div className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {recommendation.evidence.metrics.map((metric) => (
                            <Badge key={`${recommendation.id}-${metric.label}`} variant="outline" className="text-xs">
                              {metric.label}: {metric.value}
                            </Badge>
                          ))}
                        </div>
                        {recommendation.evidence.affectedStudentNames &&
                          recommendation.evidence.affectedStudentNames.length > 0 && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Affected students: {recommendation.evidence.affectedStudentNames.join(", ")}
                            </p>
                          )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Suggested Actions
                        </p>
                        {recommendation.recommendedActions.map((action) => (
                          <div key={`${recommendation.id}-${action}`} className="flex items-start gap-2 text-sm">
                            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            <span>{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 lg:w-[240px] lg:justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingId === recommendation.id}
                      onClick={() => void handleReview(recommendation)}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Review
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingId === recommendation.id}
                      onClick={() => void handleDismiss(recommendation)}
                    >
                      <Shield className="mr-1.5 h-3.5 w-3.5" />
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      disabled={actingId === recommendation.id}
                      onClick={() => void handleCreateIntervention(recommendation)}
                    >
                      {recommendation.type === "student risk" ? (
                        <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Create Intervention
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>
    </Tabs>
  </div>
);
