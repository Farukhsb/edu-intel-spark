import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle,
  Clock,
  Download,
  Shield,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardDemoBanner, DashboardEmptyState } from "@/components/dashboard/PageStates";
import { DemoProgrammeReports } from "./demo-programmeReports";
import { EvidencePacksSection } from "./evidence-packs-section";
import { useDemoAccreditationDashboardController } from "./useDemoAccreditationDashboardController";

const MetricBar = ({ value, className = "h-2" }: { value: number; className?: string }) => (
  <div className={`overflow-hidden rounded-full bg-muted ${className}`}>
    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

type AccreditationDashboardScreenProps = ReturnType<typeof useDemoAccreditationDashboardController>;

export const AccreditationDashboardScreen = ({
  activeTab,
  setActiveTab,
  loadError,
  qaaMetrics,
  nssMetrics,
  tefIndicators,
  feedbackTurnaround,
  summary,
  statusIcon,
  tefColor,
  exportQAAReport,
  exportOfsB3EvidencePack,
  exportTefNarrativeSubmission,
  pendingWorkflowTarget,
  openPendingWorkflow,
  openSubmissionOversight,
  openAssignmentOversight,
}: AccreditationDashboardScreenProps) => (
  <div className="space-y-6 animate-fade-in">
    <DashboardDemoBanner label="Viewing demo accreditation data" />

    {qaaMetrics.length === 0 && (
      <DashboardEmptyState
        title={loadError ? "Accreditation data unavailable" : "No accreditation data yet"}
        description={
          loadError
            ? "Accreditation metrics could not be loaded right now. Try again later."
            : "Accreditation metrics will auto-populate once you create assignments, upload submissions, and complete grading."
        }
      />
    )}

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Overall Compliance</p>
              <p className="text-2xl font-bold font-display">{summary.overallCompliance}%</p>
            </div>
            <Award className="h-8 w-8 text-primary" />
          </div>
          <div className="mt-3"><MetricBar value={summary.overallCompliance} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Standards Met</p>
              <p className="text-2xl font-bold font-display text-success">{summary.metCount}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">At Risk</p>
              <p className="text-2xl font-bold font-display text-warning">{summary.atRiskCount}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-warning" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Below Target</p>
              <p className="text-2xl font-bold font-display text-destructive">{summary.belowCount}</p>
            </div>
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Findings</CardTitle>
        <CardDescription>Immediate accreditation and quality signals from current live data</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Weakest compliance area</p>
          <p className="mt-2 text-sm font-semibold">{summary.weakestQaaMetric?.metric || "No compliance data yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.weakestQaaMetric
              ? `${summary.weakestQaaMetric.value}% against a ${summary.weakestQaaMetric.target}% target. This is the first metric you would be asked to explain.`
              : "Populate assignments, submissions, and grading to generate live compliance findings."}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">NSS pressure point</p>
          <p className="mt-2 text-sm font-semibold">
            {nssMetrics.length > 0
              ? nssMetrics.reduce((lowest, metric) => (metric.score < lowest.score ? metric : lowest)).question
              : "No NSS-style signal yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {nssMetrics.length > 0
              ? "Use this to prioritise process changes that students will actually feel."
              : "NSS-style indicators appear automatically once grading activity exists."}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">TEF watch area</p>
          <p className="mt-2 text-sm font-semibold">{summary.weakestTefIndicator?.name || "No TEF indicator yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.weakestTefIndicator
              ? `${summary.weakestTefIndicator.score}% with a ${summary.weakestTefIndicator.rating} rating. This is the weakest evidence line in the current dataset.`
              : "TEF-style indicators become meaningful after more grading and release activity."}
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recommended Actions</CardTitle>
        <CardDescription>Jump from quality signals to the workflows that improve them</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <button type="button" className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40" onClick={openPendingWorkflow}>
          <p className="text-sm font-medium">Reduce feedback backlog</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pendingWorkflowTarget
              ? "Open the assignment carrying the most workflow pressure and clear the backlog where it will move the metrics fastest."
              : "The fastest way to improve turnaround, moderation evidence, and grade release metrics is clearing the pending queue."}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
            {pendingWorkflowTarget?.label ?? "Open pending submissions"} <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>
        <button type="button" className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40" onClick={openSubmissionOversight}>
          <p className="text-sm font-medium">Review student outcome risk</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Open the admin submission oversight view and inspect where pass rates and outcome signals are weakest.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
            Open submission oversight <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>
        <button type="button" className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40" onClick={openAssignmentOversight}>
          <p className="text-sm font-medium">Review assignment evidence</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Open assignment oversight to inspect rubric coverage and the assessment evidence likely to need explanation in a quality review.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
            Open assignment oversight <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>
      </CardContent>
    </Card>

    <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="text-base">Reporting Readiness</CardTitle>
        <CardDescription>A compact view of the evidence line an accreditor is most likely to question first.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-background/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current posture</p>
          <p className="mt-2 text-sm font-semibold">
            {summary.overallCompliance >= 85 ? "Strong reporting position" : summary.overallCompliance >= 70 ? "Watch list position" : "Evidence risk position"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{summary.overallCompliance}% of current QAA-style metrics are meeting target.</p>
        </div>
        <div className="rounded-lg border bg-background/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">First challenge likely</p>
          <p className="mt-2 text-sm font-semibold">{summary.weakestQaaMetric?.metric || "No weak metric yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.weakestQaaMetric
              ? summary.weakestQaaMetric.detail
              : "Once live grading data grows, the weakest compliance line will appear here automatically."}
          </p>
        </div>
        <div className="rounded-lg border bg-background/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next report</p>
          <p className="mt-2 text-sm font-semibold">
            {summary.belowCount > 0 || summary.atRiskCount > 0 ? "QAA compliance export" : "Programme distribution export"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.belowCount > 0 || summary.atRiskCount > 0
              ? "Start with the compliance report to explain where standards are below or at risk."
              : "Use the programme report to evidence distribution stability and module-level outcomes."}
          </p>
        </div>
      </CardContent>
    </Card>

    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <TabsList>
          <TabsTrigger value="qaa">QAA Compliance</TabsTrigger>
          <TabsTrigger value="nss">NSS & Satisfaction</TabsTrigger>
          <TabsTrigger value="tef">TEF Indicators</TabsTrigger>
          <TabsTrigger value="evidence-packs">Exports</TabsTrigger>
          <TabsTrigger value="programme">Programme Reports</TabsTrigger>
        </TabsList>
        <Button variant="outline" size="sm" onClick={exportQAAReport}>
          <Download className="mr-2 h-3.5 w-3.5" /> Export Report
        </Button>
      </div>

      <TabsContent value="qaa" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><CardTitle className="text-base">QAA Quality Standards</CardTitle></div>
            <CardDescription>Assessment criteria transparency, feedback turnaround, and moderation evidence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {qaaMetrics.map((metric) => (
              <div key={metric.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(metric.status) === "met" ? <CheckCircle className="h-4 w-4 text-success" /> : statusIcon(metric.status) === "at-risk" ? <AlertTriangle className="h-4 w-4 text-warning" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="font-medium text-sm">{metric.metric}</span>
                    <Badge variant="outline" className="text-[10px]">{metric.category}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{metric.value}%</span>
                    <Badge variant={metric.status === "met" ? "default" : metric.status === "at-risk" ? "secondary" : "destructive"} className="text-xs">
                      {metric.status === "met" ? "Met" : metric.status === "at-risk" ? "At Risk" : "Below"}
                    </Badge>
                  </div>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${metric.status === "met" ? "bg-success" : metric.status === "at-risk" ? "bg-warning" : "bg-destructive"}`}
                    style={{ width: `${metric.value}%` }}
                  />
                  <div className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${metric.target}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{metric.detail}</span>
                  <span>Target: {metric.target}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><CardTitle className="text-base">Feedback Turnaround Analysis</CardTitle></div>
            <CardDescription>QAA requirement: Students should receive feedback within 15 working days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold font-display">{feedbackTurnaround.avg}</p>
                <p className="text-xs text-muted-foreground">Average days to feedback</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold font-display">{feedbackTurnaround.compliant}/{feedbackTurnaround.total}</p>
                <p className="text-xs text-muted-foreground">Within 15-day target</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold font-display">
                  {feedbackTurnaround.total > 0 ? Math.round((feedbackTurnaround.compliant / feedbackTurnaround.total) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Compliance rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="nss" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><CardTitle className="text-base">National Student Survey (NSS)</CardTitle></div>
            <CardDescription>Student satisfaction metrics and benchmarks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {nssMetrics.map((metric, index) => (
              <div key={`${metric.question}-${index}`} className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex-1">{metric.question}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`font-bold ${metric.score >= metric.benchmark ? "text-success" : "text-destructive"}`}>{metric.score}%</span>
                    <span className="text-muted-foreground">vs {metric.benchmark}%</span>
                    <span className={metric.trend.startsWith("+") ? "text-success" : "text-destructive"}>{metric.trend}</span>
                  </div>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`${metric.score >= metric.benchmark ? "bg-success" : "bg-warning"} h-full rounded-full`} style={{ width: `${metric.score}%` }} />
                  <div className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${metric.benchmark}%` }} />
                </div>
              </div>
            ))}
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Overall NSS Score</p>
              <p className="text-2xl font-bold font-display text-foreground">{summary.nssAverage}%</p>
              <p className="text-xs mt-1">Benchmark average: {summary.nssBenchmarkAverage}%</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tef" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" /><CardTitle className="text-base">Teaching Excellence Framework (TEF)</CardTitle></div>
            <CardDescription>TEF assessment indicators and ratings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tefIndicators.map((indicator, index) => (
              <div key={`${indicator.name}-${index}`} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${tefColor(indicator.rating)}`}>{indicator.rating}</span>
                    <span className="font-medium text-sm">{indicator.name}</span>
                  </div>
                  <span className="text-lg font-bold">{indicator.score}%</span>
                </div>
                <MetricBar value={indicator.score} />
                <p className="text-xs text-muted-foreground">{indicator.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="evidence-packs" className="space-y-4">
        <EvidencePacksSection
          onExportOfsB3EvidencePack={exportOfsB3EvidencePack}
          onExportTefNarrativeSubmission={exportTefNarrativeSubmission}
        />
      </TabsContent>

      <TabsContent value="programme" className="space-y-4">
        {activeTab === "programme" ? <DemoProgrammeReports /> : null}
      </TabsContent>
    </Tabs>
  </div>
);
