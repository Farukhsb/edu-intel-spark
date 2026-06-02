import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, RefreshCw, ShieldAlert, Target, Users, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { DashboardEmptyState, DashboardErrorState, DashboardLoadingState, DashboardLiveBanner, DashboardPageIntro } from "@/components/dashboard/PageStates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { safeFormatDate } from "@/lib/date";
import { log } from "@/lib/logger";
import { fetchRiskIntelligenceDataset } from "@/lib/data/admin/riskIntelligence";

type RiskBand = "low" | "medium" | "high";

type RiskPredictionDisplayRow = {
  id: string;
  studentLabel: string;
  predictionDate: string;
  modelVersion: string;
  riskScore: number;
  riskBand: RiskBand;
  reasonCodes: string[];
  explanation: string | null;
  feedbackCount: number;
  latestFeedback: string | null;
};

type ComputeRiskBatchResponse = {
  data: {
    snapshotDate: string;
    featureVersion: string;
    modelVersion: string;
    institutionId: string;
    studentCount: number;
    snapshotCount: number;
    predictionCount: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
  };
};

const bandStyles: Record<RiskBand, string> = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  high: "border-rose-500/30 bg-rose-500/10 text-rose-700",
};

const formatScore = (value: number) => `${Math.round(value * 100)}%`;

const humanizeReason = (value: string) => value.replace(/_/g, " ");

const RiskIntelligence = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [predictions, setPredictions] = useState<RiskPredictionDisplayRow[]>([]);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [latestModelVersion, setLatestModelVersion] = useState<string | null>(null);
  const [isRunningBatch, setIsRunningBatch] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoadError(null);
        const { feedback, profiles, predictions: rawPredictions, snapshots } = await fetchRiskIntelligenceDataset();

        const studentLabelById = new Map(
          profiles.map((profile) => [profile.id, profile.full_name || profile.email || "Unknown student"]),
        );
        const feedbackByPredictionId = new Map<string, typeof feedback>();
        feedback.forEach((entry) => {
          const current = feedbackByPredictionId.get(entry.prediction_id) ?? [];
          current.push(entry);
          feedbackByPredictionId.set(entry.prediction_id, current);
        });

        const displayRows = rawPredictions
          .slice()
          .sort((left, right) => {
            const scoreDelta = Number(right.risk_score) - Number(left.risk_score);
            if (scoreDelta !== 0) return scoreDelta;
            return new Date(right.prediction_date).getTime() - new Date(left.prediction_date).getTime();
          })
          .map((prediction) => {
            const relatedFeedback = feedbackByPredictionId.get(prediction.id) ?? [];
            const latestFeedback = relatedFeedback[0];

            return {
              id: prediction.id,
              studentLabel: studentLabelById.get(prediction.student_id) || "Unknown student",
              predictionDate: prediction.prediction_date,
              modelVersion: prediction.model_version,
              riskScore: Number(prediction.risk_score),
              riskBand: prediction.risk_band as RiskBand,
              reasonCodes: prediction.reason_codes || [],
              explanation: prediction.explanation,
              feedbackCount: relatedFeedback.length,
              latestFeedback: latestFeedback
                ? `${latestFeedback.feedback_type}${latestFeedback.notes ? `: ${latestFeedback.notes}` : ""}`
                : null,
            };
          });

        setPredictions(displayRows);
        setSnapshotCount(snapshots.length);
        setFeedbackCount(feedback.length);
        setSnapshotDate(displayRows[0]?.predictionDate ?? snapshots[0]?.snapshot_date ?? null);
        setLatestModelVersion(displayRows[0]?.modelVersion ?? snapshots[0]?.feature_version ?? null);
      } catch (error) {
        log.error("Failed to load risk intelligence dataset", error);
        setLoadError("Risk intelligence data could not be loaded right now.");
        setPredictions([]);
        setSnapshotCount(0);
        setFeedbackCount(0);
        setSnapshotDate(null);
        setLatestModelVersion(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user?.id, reloadKey]);

  const summary = useMemo(() => {
    const highRisk = predictions.filter((prediction) => prediction.riskBand === "high").length;
    const mediumRisk = predictions.filter((prediction) => prediction.riskBand === "medium").length;
    const feedbackCovered = predictions.filter((prediction) => prediction.feedbackCount > 0).length;
    const averageRisk =
      predictions.length > 0
        ? Math.round(
            (predictions.reduce((total, prediction) => total + prediction.riskScore, 0) / predictions.length) * 100,
          )
        : 0;

    return {
      highRisk,
      mediumRisk,
      feedbackCovered,
      averageRisk,
    };
  }, [predictions]);

  const feedbackByType = useMemo(() => {
    const counts: Record<string, number> = {};
    predictions.forEach((prediction) => {
      if (prediction.latestFeedback) {
        const type = prediction.latestFeedback.split(":")[0];
        counts[type] = (counts[type] ?? 0) + 1;
      }
    });
    return counts;
  }, [predictions]);

  const exportSnapshot = () => {
    const lines = [
      "Risk Intelligence Snapshot",
      `Generated: ${new Date().toISOString()}`,
      "",
      "Student,Risk Band,Risk Score,Model Version,Prediction Date,Reasons,Feedback Count,Latest Feedback",
    ];

    predictions.forEach((row) => {
      lines.push(
        `"${row.studentLabel}",${row.riskBand},${row.riskScore.toFixed(3)},${row.modelVersion},"${row.predictionDate}","${row.reasonCodes.join(
          "; ",
        )}",${row.feedbackCount},"${row.latestFeedback ?? ""}"`,
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `risk_intelligence_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const runBatchNow = async () => {
    setIsRunningBatch(true);
    try {
      const { data, error } = await supabase.functions.invoke<ComputeRiskBatchResponse>("compute-risk-batch", {
        body: { featureVersion: "v1" },
      });

      if (error) {
        throw error;
      }

      const summary = data?.data;
      toast.success(
        summary
          ? `Scored ${summary.predictionCount} student${summary.predictionCount === 1 ? "" : "s"} in ${summary.modelVersion}.`
          : "Risk batch completed.",
      );
      setReloadKey((current) => current + 1);
    } catch (error) {
      log.error("Failed to run risk batch", error);
      toast.error("Could not run the batch risk score job.");
    } finally {
      setIsRunningBatch(false);
    }
  };

  if (loading) {
    return <DashboardLoadingState />;
  }

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
      <DashboardLiveBanner label="Dedicated risk workspace. This page stays separate from the main admin dashboard so prediction review never competes with audit or system monitoring." />

      <DashboardPageIntro
        eyebrow="Admin risk intelligence"
        title="Student risk predictions"
        description="A single-page workspace for batch risk scores, model explanations, and lecturer feedback. Keep the prediction workflow here so it stays focused and easy to scan."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setReloadKey((current) => current + 1)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportSnapshot} disabled={predictions.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={runBatchNow} disabled={isRunningBatch}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRunningBatch ? "animate-spin" : ""}`} />
              {isRunningBatch ? "Running batch..." : "Run batch now"}
            </Button>
            <Button size="sm" onClick={() => navigate("/dashboard?view=users")}>
              <Users className="mr-2 h-4 w-4" />
              Open user management
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Predictions</p>
              <p className="text-3xl font-bold font-display tracking-tight">{predictions.length}</p>
              <p className="text-xs text-muted-foreground">Latest batch rows visible to this admin session.</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
              <Target className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">High risk</p>
              <p className="text-3xl font-bold font-display tracking-tight">{summary.highRisk}</p>
              <p className="text-xs text-muted-foreground">Students with the highest intervention priority.</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/15 bg-rose-500/10 text-rose-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Model version</p>
              <p className="text-3xl font-bold font-display tracking-tight">{latestModelVersion || "Pending"}</p>
              <p className="text-xs text-muted-foreground">
                {snapshotDate ? `Latest batch on ${safeFormatDate(snapshotDate, "MMM d, yyyy", "Not available")}` : "Waiting for the first batch run."}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-500/15 bg-sky-500/10 text-sky-600">
              <BarChart3 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Feedback coverage</p>
              <p className="text-3xl font-bold font-display tracking-tight">{predictions.length === 0 ? "0%" : `${Math.round((summary.feedbackCovered / predictions.length) * 100)}%`}</p>
              <p className="text-xs text-muted-foreground">{feedbackCount} feedback events across the current batch.</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/15 bg-emerald-500/10 text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base">Batch predictions</CardTitle>
            <CardDescription>Sorted by risk score. This stays in one place so the review path is easy to scan.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {predictions.length === 0 ? (
              <DashboardEmptyState
                title="No risk predictions yet"
                description="Once the batch scoring job runs, students will appear here with risk scores, explanations, and feedback status."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Reasons</TableHead>
                      <TableHead>Feedback</TableHead>
                      <TableHead>Batch</TableHead>
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
                        <TableCell>
                          <Badge variant="outline" className={bandStyles[row.riskBand]}>
                            {row.riskBand}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">{formatScore(row.riskScore)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.reasonCodes.length > 0 ? row.reasonCodes.map(humanizeReason).join(", ") : "No reason codes yet"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.feedbackCount > 0 ? row.latestFeedback : "No feedback yet"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {safeFormatDate(row.predictionDate, "MMM d, yyyy", "Not available")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base">Batch health</CardTitle>
              <CardDescription>The page remains separate from system monitoring, but it still tracks its own batch posture.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Snapshots captured</p>
                <p className="mt-2 text-2xl font-bold font-display">{snapshotCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">Historical feature snapshots ready for model training and backtesting.</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average risk score</p>
                <p className="mt-2 text-2xl font-bold font-display">{`${summary.averageRisk}%`}</p>
                <p className="mt-1 text-sm text-muted-foreground">Useful for spotting when the batch drifts upward across the cohort.</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Model feedback</p>
                <p className="mt-2 text-2xl font-bold font-display">{feedbackCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {summary.feedbackCovered > 0
                    ? `${summary.feedbackCovered} predictions have at least one feedback entry.`
                    : "No lecturer feedback has been added yet."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base">Model operating rules</CardTitle>
              <CardDescription>Keep the system explainable, auditable, and human-led.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              <div className="rounded-xl border border-border/70 p-4">
                <p className="text-sm font-medium">1. Batch only</p>
                <p className="mt-1 text-sm text-muted-foreground">Scores should be written by a scheduled job, not generated live on page load.</p>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <p className="text-sm font-medium">2. Explain every score</p>
                <p className="mt-1 text-sm text-muted-foreground">Reason codes and short explanations keep the review process auditable.</p>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <p className="text-sm font-medium">3. Human follow-up</p>
                <p className="mt-1 text-sm text-muted-foreground">Lecturers should review, comment, and act. The score supports judgment; it does not replace it.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base">Latest feedback trail</CardTitle>
            <CardDescription>Recent reviewer responses on the risk predictions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {feedbackCount === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <p className="text-sm font-medium">No feedback has been recorded yet</p>
                <p className="mt-1 text-sm text-muted-foreground">When lecturers mark useful alerts or false alarms, the feedback trail appears here.</p>
              </div>
            ) : (
              predictions
                .filter((prediction) => prediction.latestFeedback)
                .slice(0, 5)
                .map((prediction) => (
                  <div key={prediction.id} className="rounded-xl border border-border/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{prediction.studentLabel}</p>
                        <p className="text-xs text-muted-foreground">{safeFormatDate(prediction.predictionDate, "MMM d, yyyy", "Not available")}</p>
                      </div>
                      <Badge variant="outline" className={bandStyles[prediction.riskBand]}>
                        {prediction.riskBand}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{prediction.latestFeedback}</p>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base">Feedback mix</CardTitle>
            <CardDescription>What reviewers are saying about the current batch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {Object.keys(feedbackByType).length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <p className="text-sm font-medium">No feedback summary yet</p>
                <p className="mt-1 text-sm text-muted-foreground">The mix will populate once the first batch of reviewer responses arrives.</p>
              </div>
            ) : (
              Object.entries(feedbackByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
                  <p className="text-sm font-medium">{humanizeReason(type)}</p>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))
            )}
            <div className="rounded-xl border border-border/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin follow-up route</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use the existing user management view when a prediction requires a wider account review or intervention workflow.
              </p>
              <Button variant="link" className="mt-2 px-0" onClick={() => navigate("/dashboard?view=users")}>
                Open user management <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RiskIntelligence;
