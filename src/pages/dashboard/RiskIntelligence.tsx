import { useEffect, useState } from "react";
import { Download, RefreshCw, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { DashboardEmptyState, DashboardErrorState, DashboardLoadingState, DashboardLiveBanner, DashboardPageIntro } from "@/components/dashboard/PageStates";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { buildRiskIntelligenceDemoDataset } from "@/lib/data/admin/riskIntelligenceDemo";
import { fetchRiskIntelligenceDataset } from "@/lib/data/admin/riskIntelligence";
import { triggerRiskModelTraining } from "@/lib/data/admin";
import {
  buildRiskIntelligenceDisplayRows,
  downloadRiskIntelligenceCsv,
  summarizeRiskPredictions,
  type RiskPredictionDisplayRow,
  type RiskIntelligenceDataset,
  type RiskBand,
} from "@/lib/data/admin/riskIntelligenceView";
import { safeFormatDate } from "@/lib/date";
import { log } from "@/lib/logger";

const bandStyles: Record<RiskBand, string> = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  high: "border-rose-500/30 bg-rose-500/10 text-rose-700",
};

const formatScore = (value: number) => `${Math.round(value * 100)}%`;
const formatComponentScore = (value: number | null) => (value == null ? "Pending" : `${Math.round(value)}%`);
const humanizeReason = (value: string) => value.replace(/_/g, " ");

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const RiskIntelligence = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isLocalhost =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [demoMode, setDemoMode] = useState(isLocalhost);
  const [predictions, setPredictions] = useState<RiskPredictionDisplayRow[]>([]);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [latestModelVersion, setLatestModelVersion] = useState<string | null>(null);
  const [latestFeatureVersion, setLatestFeatureVersion] = useState<string | null>(null);
  const [training, setTraining] = useState(false);

  const loadDataset = async (dataset: RiskIntelligenceDataset) => {
    const { displayRows, snapshotCount: nextSnapshotCount, feedbackCount: nextFeedbackCount, snapshotDate: nextSnapshotDate, latestModelVersion: nextLatestModelVersion } = buildRiskIntelligenceDisplayRows(dataset);
    setPredictions(displayRows);
    setSnapshotCount(nextSnapshotCount);
    setFeedbackCount(nextFeedbackCount);
    setSnapshotDate(nextSnapshotDate);
    setLatestModelVersion(nextLatestModelVersion);
    setLatestFeatureVersion(displayRows[0]?.featureVersion ?? dataset.snapshots[0]?.feature_version ?? null);
  };

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoadError(null);
        if (demoMode) {
          loadDataset(buildRiskIntelligenceDemoDataset());
        } else {
          await loadDataset(await fetchRiskIntelligenceDataset());
        }
      } catch (error) {
        log.error("Failed to load risk intelligence dataset", error);
        if (isLocalhost) {
          setDemoMode(true);
          loadDataset(buildRiskIntelligenceDemoDataset());
        } else {
          setLoadError("Risk intelligence data could not be loaded right now.");
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [demoMode, isLocalhost, reloadKey, user?.id]);

  const summary = summarizeRiskPredictions(predictions);
  const componentSummary = predictions.reduce(
    (acc, row) => {
      if (row.componentScores.academic != null) acc.academic.push(row.componentScores.academic);
      if (row.componentScores.engagement != null) acc.engagement.push(row.componentScores.engagement);
      if (row.componentScores.nonSubmission != null) acc.nonSubmission.push(row.componentScores.nonSubmission);
      return acc;
    },
    { academic: [] as number[], engagement: [] as number[], nonSubmission: [] as number[] },
  );
  const averageComponent = (values: number[]) =>
    values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

  const latestUpdateLabel = snapshotDate ? `Last updated ${safeFormatDate(snapshotDate, "MMM d, yyyy", "Not available")}` : "Waiting for the first refresh.";
  const topStudents = predictions.slice(0, 3);

  if (loading) return <DashboardLoadingState />;

  if (loadError) {
    return (
      <DashboardErrorState
        title="Risk intelligence is unavailable"
        description={loadError}
        action={
          <Button onClick={() => setReloadKey((current) => current + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardLiveBanner
        label={
          demoMode
            ? "Demo data is loaded for local testing."
            : `Live risk overview. ${latestUpdateLabel}`
        }
      />

      <DashboardPageIntro
        eyebrow="Student risk"
        title="Risk overview"
        description="A simple view of which students need attention, and why."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setReloadKey((current) => current + 1)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDemoMode((current) => !current);
                setReloadKey((current) => current + 1);
              }}
            >
              {demoMode ? "Show live data" : "Load demo data"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadRiskIntelligenceCsv(predictions)} disabled={predictions.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            {!demoMode ? (
              <Button
                variant="outline"
                size="sm"
                disabled={training}
                onClick={async () => {
                  try {
                    setTraining(true);
                    const result = await triggerRiskModelTraining();
                    toast.success(
                      `Model retrained: ${result.data.version} (${Math.round(result.data.testAccuracy * 100)}% validation accuracy)`,
                    );
                    setReloadKey((current) => current + 1);
                  } catch (error) {
                    log.error("Failed to retrain risk model", error, {
                      demoMode,
                      currentPredictionCount: predictions.length,
                      currentSnapshotCount: snapshotCount,
                    });
                    toast.error(error instanceof Error ? error.message : "Model retraining failed");
                  } finally {
                    setTraining(false);
                  }
                }}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${training ? "animate-spin" : ""}`} />
                Retrain model
              </Button>
            ) : null}
            <Button size="sm" onClick={() => navigate("/dashboard?view=users")}>
              <Users className="mr-2 h-4 w-4" />
              Open user management
            </Button>
          </>
        }
      />

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base">Risk summary</CardTitle>
          <CardDescription>{latestUpdateLabel}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Predictions ready</p>
            <p className="mt-2 text-2xl font-bold font-display">{predictions.length}</p>
          </div>
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Snapshots</p>
            <p className="mt-2 text-2xl font-bold font-display">{snapshotCount}</p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-rose-700">High risk</p>
            <p className="mt-2 text-2xl font-bold font-display text-rose-700">{summary.highRisk}</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Medium risk</p>
            <p className="mt-2 text-2xl font-bold font-display text-amber-700">{summary.mediumRisk}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Feedback coverage</p>
            <p className="mt-2 text-2xl font-bold font-display text-emerald-700">
              {predictions.length === 0 ? "0%" : `${Math.round((summary.feedbackCovered / predictions.length) * 100)}%`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base">Composite risk breakdown</CardTitle>
          <CardDescription>Average signal mix behind the current predictions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Academic</p>
            <p className="mt-2 text-2xl font-bold font-display">{formatComponentScore(averageComponent(componentSummary.academic))}</p>
            <p className="mt-1 text-sm text-muted-foreground">Grades and trajectory signal.</p>
          </div>
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Engagement</p>
            <p className="mt-2 text-2xl font-bold font-display">{formatComponentScore(averageComponent(componentSummary.engagement))}</p>
            <p className="mt-1 text-sm text-muted-foreground">LMS activity and recency signal.</p>
          </div>
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Non-submission</p>
            <p className="mt-2 text-2xl font-bold font-display">{formatComponentScore(averageComponent(componentSummary.nonSubmission))}</p>
            <p className="mt-1 text-sm text-muted-foreground">Coverage and late submission signal.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base">Who needs attention</CardTitle>
          <CardDescription>The highest-risk students are shown first.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {topStudents.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed p-6 text-center">
              <p className="text-sm font-medium">No top-risk students yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Load demo data or refresh to see students here.</p>
            </div>
          ) : (
            topStudents.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-border/70">
                      <AvatarFallback className="bg-muted text-sm font-semibold">{getInitials(row.studentLabel)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{row.studentLabel}</p>
                      <p className="text-xs text-muted-foreground">{safeFormatDate(row.predictionDate, "MMM d, yyyy", "Not available")}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={bandStyles[row.riskBand]}>
                    {row.riskBand}
                  </Badge>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Risk score</span>
                    <span className="font-semibold">{formatScore(row.riskScore)}</span>
                  </div>
                  <Progress value={row.riskScore * 100} className="h-2" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{row.explanation || "No explanation supplied yet."}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base">Predictions</CardTitle>
          <CardDescription>Simple list of the current risk predictions for quick scanning.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {predictions.length === 0 ? (
            <DashboardEmptyState
              title="No risk predictions yet"
              description="Load demo data or refresh to see predictions here."
              action={
                <Button variant="outline" onClick={() => setDemoMode(true)}>
                  Load demo data
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Breakdown</TableHead>
                    <TableHead>Reasons</TableHead>
                    <TableHead>Feedback</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {predictions.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{row.studentLabel}</p>
                          <p className="text-xs text-muted-foreground">{row.explanation || "No explanation supplied yet."}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{formatScore(row.riskScore)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={bandStyles[row.riskBand]}>
                          {row.riskBand}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Academic {formatComponentScore(row.componentScores.academic)}</p>
                          <p>Engagement {formatComponentScore(row.componentScores.engagement)}</p>
                          <p>Non-submission {formatComponentScore(row.componentScores.nonSubmission)}</p>
                          <p className="text-[11px]">
                            {row.componentSignals.engagementEventCount != null
                              ? `${row.componentSignals.engagementEventCount} engagement events`
                              : "No engagement signal"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.reasonCodes.length > 0 ? row.reasonCodes.map(humanizeReason).join(", ") : "No reason codes yet"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.feedbackCount > 0 ? row.latestFeedback : "No feedback yet"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base">Page health</CardTitle>
          <CardDescription>The page stays separate from system monitoring, but it still shows a quick health check.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average risk score</p>
            <p className="mt-2 text-2xl font-bold font-display">{`${summary.averageRisk}%`}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Model version</p>
            <p className="mt-2 text-2xl font-bold font-display">{latestModelVersion || "Pending"}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Feature version</p>
            <p className="mt-2 text-2xl font-bold font-display">{latestFeatureVersion || "Pending"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RiskIntelligence;
