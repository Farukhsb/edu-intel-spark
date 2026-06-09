import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Filter,
  GraduationCap,
  Info,
  MinusCircle,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { CohortSignalRiskBand, CohortSignalStudent } from "@/pages/cohortsignal-demo/demoData";

type CrossValidationSummary = {
  folds: number;
  accuracy: number;
  foldAccuracies: number[];
};

type ConfusionMatrix = {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
};

type BandReport = {
  holdoutAccuracy: number;
  crossValidation: CrossValidationSummary;
};

type FailureReport = {
  holdoutAccuracy: number;
  crossValidation: CrossValidationSummary;
  precision: number;
  recall: number;
  confusionMatrix: ConfusionMatrix;
};

type FilterState = {
  riskBand: CohortSignalRiskBand | "all";
  module: string;
  noInterventionLogged: boolean;
  decliningTrend: boolean;
  missingSubmission: boolean;
};

const riskBandMeta: Record<
  CohortSignalRiskBand,
  { label: string; shortLabel: string; className: string; icon: ComponentType<{ className?: string }> }
> = {
  low: {
    label: "Low risk",
    shortLabel: "Low",
    className: "border-emerald-500/25 bg-emerald-500/12 text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
    icon: CheckCircle2,
  },
  medium: {
    label: "Medium risk",
    shortLabel: "Medium",
    className: "border-amber-500/25 bg-amber-500/14 text-amber-950",
    icon: AlertTriangle,
  },
  high: {
    label: "High risk",
    shortLabel: "High",
    className: "border-rose-500/30 bg-rose-500/14 text-rose-950",
    icon: ShieldAlert,
  },
  insufficient: {
    label: "Insufficient data",
    shortLabel: "Insufficient",
    className: "border-slate-400/30 bg-slate-500/12 text-slate-900",
    icon: Info,
  },
};

const riskBandOptions: Array<{ value: FilterState["riskBand"]; label: string }> = [
  { value: "all", label: "All risk bands" },
  { value: "low", label: "Low risk" },
  { value: "medium", label: "Medium risk" },
  { value: "high", label: "High risk" },
  { value: "insufficient", label: "Insufficient data" },
];

const formatMark = (mark: number | null) => (mark == null ? "-" : `${mark}%`);
const formatPct = (value: number) => `${Math.round(value * 100)}%`;

const weekStart = (referenceNow: string) => {
  const date = new Date(referenceNow);
  date.setUTCDate(date.getUTCDate() - 7);
  return date;
};

const hasInterventionLogged = (timestamp: string | null) => timestamp != null;
const isLoggedThisWeek = (timestamp: string | null, referenceNow: string) => {
  if (!timestamp) return false;
  return new Date(timestamp).getTime() >= weekStart(referenceNow).getTime();
};

const countRiskBand = (students: CohortSignalStudent[], riskBand: CohortSignalRiskBand) =>
  students.filter((student) => student.riskBand === riskBand).length;

const getOverviewBullets = (isDemo: boolean) =>
  isDemo
    ? [
        "High, medium, low, and insufficient-data risk bands are surfaced as a heatmap.",
        "The trained demo model also labels students as likely to fail or likely to pass.",
        "Intervention logging updates the marker state and the weekly count in the summary.",
        "The detail panel is keyboard accessible and keeps the risk rationale visible.",
      ]
    : [
        "The live heatmap is built from lecturer assignments, submissions, grades, and intervention records.",
        "The model retrains on the active cohort so predicted failure risk is tied to current data.",
        "Logging an intervention writes to the student_interventions table and updates the marker state.",
        "The detail panel is keyboard accessible and keeps the risk rationale visible.",
      ];

export const CohortSignalHeatmapView = ({
  title,
  description,
  path,
  robots,
  bannerLabel,
  bannerIcon,
  introText,
  modelQualityDescription,
  students: initialStudents,
  bandReport,
  failureReport,
  isDemo,
  readOnly = false,
  onLogIntervention,
}: {
  title: string;
  description: string;
  path: string;
  robots: "index,follow" | "noindex,follow" | "noindex,nofollow";
  bannerLabel: string;
  bannerIcon?: ReactNode;
  introText: string;
  modelQualityDescription: string;
  students: CohortSignalStudent[];
  bandReport: BandReport;
  failureReport: FailureReport;
  isDemo: boolean;
  readOnly?: boolean;
  onLogIntervention?: (student: CohortSignalStudent) => Promise<string | null> | string | null;
}) => {
  usePageMetadata({
    title,
    description,
    path,
    robots,
  });

  const [students, setStudents] = useState<CohortSignalStudent[]>(initialStudents);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isLoggingIntervention, setIsLoggingIntervention] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    riskBand: "all",
    module: "all",
    noInterventionLogged: false,
    decliningTrend: false,
    missingSubmission: false,
  });

  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  const referenceNow = new Date().toISOString();

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, students],
  );

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (filters.riskBand !== "all" && student.riskBand !== filters.riskBand) {
        return false;
      }
      if (filters.module !== "all" && student.module !== filters.module) {
        return false;
      }
      if (filters.noInterventionLogged && hasInterventionLogged(student.interventionLoggedAt)) {
        return false;
      }
      if (filters.decliningTrend && student.trend !== "declining") {
        return false;
      }
      if (filters.missingSubmission && !student.missingSubmission) {
        return false;
      }

      return true;
    });
  }, [filters, students]);

  useEffect(() => {
    if (selectedStudentId && !filteredStudents.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(null);
    }
  }, [filteredStudents, selectedStudentId]);

  const mediumRiskCount = countRiskBand(students, "medium");
  const lowRiskCount = countRiskBand(students, "low");
  const highRiskCount = countRiskBand(students, "high");
  const interventionsLoggedThisWeek = students.filter((student) => isLoggedThisWeek(student.interventionLoggedAt, referenceNow)).length;
  const moduleOptions = Array.from(new Set(students.map((student) => student.module))).sort();

  const handleLogIntervention = async () => {
    if (!selectedStudent || isLoggingIntervention) return;
    if (readOnly) return;

    setIsLoggingIntervention(true);
    try {
      const loggedAt =
        (await onLogIntervention?.(selectedStudent)) ?? new Date().toISOString();

      if (loggedAt) {
        setStudents((current) =>
          current.map((student) =>
            student.id === selectedStudent.id
              ? { ...student, interventionLoggedAt: student.interventionLoggedAt ?? loggedAt }
              : student,
          ),
        );
      }
    } catch {
      return;
    } finally {
      setIsLoggingIntervention(false);
    }
  };

  const selectedBandMeta = selectedStudent ? riskBandMeta[selectedStudent.riskBand] : null;
  const FilterIcon = Filter;
  const overviewBullets = getOverviewBullets(isDemo);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_26%),radial-gradient(circle_at_top_right,hsl(var(--accent)/0.12),transparent_24%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.2))] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-primary/15 bg-card/90 shadow-[0_24px_70px_-35px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.9fr] lg:p-8">
            <div className="space-y-4">
              <Badge variant="secondary" className="w-fit gap-2 px-3 py-1.5">
                {bannerIcon ?? <Sparkles className="h-3.5 w-3.5" />}
                {bannerLabel}
              </Badge>
              <div className="space-y-3">
                <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  CohortSignal cohort heatmap
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{introText}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5">
                  <FilterIcon className="h-3.5 w-3.5" />
                  Filters for risk, module, intervention state, trend, and missing submissions
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Keyboard accessible tiles and a right-hand detail panel
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Total students", value: students.length, icon: GraduationCap, testId: "summary-total-students" },
                { label: "High risk", value: highRiskCount, icon: ShieldAlert, testId: "summary-high-risk" },
                { label: "Medium risk", value: mediumRiskCount, icon: AlertTriangle, testId: "summary-medium-risk" },
                { label: "Low risk", value: lowRiskCount, icon: CheckCircle2, testId: "summary-low-risk" },
                {
                  label: "Interventions logged this week",
                  value: interventionsLoggedThisWeek,
                  icon: Clock3,
                  fullWidth: true,
                  testId: "summary-interventions",
                },
              ].map((card) => {
                const Icon = card.icon;

                return (
                  <Card
                    key={card.label}
                    data-testid={card.testId}
                    className={cn(
                      "border-primary/10 bg-background/80 shadow-none backdrop-blur",
                      card.fullWidth ? "sm:col-span-2" : "",
                    )}
                  >
                    <CardContent className="flex items-start gap-4 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
                        <p className="mt-1 text-3xl font-semibold tracking-tight">{card.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <Card className="border-primary/10 bg-card/90 shadow-sm">
          <CardHeader className="space-y-4 p-5 pb-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Heatmap filters</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Narrow the cohort by risk band, module, intervention status, trend, or missing submission.
                </p>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {filteredStudents.length} visible of {students.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 pt-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <label htmlFor="risk-band" className="text-sm font-medium">
                Risk band
              </label>
              <Select
                value={filters.riskBand}
                onValueChange={(value) => {
                  setFilters((current) => ({ ...current, riskBand: value as FilterState["riskBand"] }));
                }}
              >
                <SelectTrigger id="risk-band" aria-label="Risk band" className="bg-background">
                  <SelectValue placeholder="All risk bands" />
                </SelectTrigger>
                <SelectContent>
                  {riskBandOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="module" className="text-sm font-medium">
                Module
              </label>
              <Select
                value={filters.module}
                onValueChange={(value) => {
                  setFilters((current) => ({ ...current, module: value }));
                }}
              >
                <SelectTrigger id="module" aria-label="Module" className="bg-background">
                  <SelectValue placeholder="All modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>
                  {moduleOptions.map((module) => (
                    <SelectItem key={module} value={module}>
                      {module}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {[
              { id: "no-intervention", label: "No intervention logged", key: "noInterventionLogged" as const },
              { id: "declining-trend", label: "Declining trend", key: "decliningTrend" as const },
              { id: "missing-submission", label: "Missing submission", key: "missingSubmission" as const },
            ].map((filter) => (
              <label
                key={filter.id}
                htmlFor={filter.id}
                className="flex items-center gap-3 rounded-2xl border bg-background/70 px-4 py-3 text-sm transition-colors hover:border-primary/30"
              >
                <Checkbox
                  id={filter.id}
                  checked={filters[filter.key]}
                  onCheckedChange={(checked) => {
                    setFilters((current) => ({ ...current, [filter.key]: Boolean(checked) }));
                  }}
                />
                <span className="leading-none">{filter.label}</span>
              </label>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section aria-labelledby="heatmap-grid" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="heatmap-grid" className="text-xl font-semibold tracking-tight">
                  Student tiles
                </h2>
                <p className="text-sm text-muted-foreground">
                  Color is paired with labels and icons, so the status is still readable without the heatmap palette.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {Object.values(riskBandMeta).map((meta) => {
                  const Icon = meta.icon;
                  return (
                    <Badge key={meta.label} variant="outline" className="gap-1.5 bg-background/70">
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </Badge>
                  );
                })}
                <Badge variant="outline" className="gap-1.5 bg-background/70">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Intervention logged marker
                </Badge>
              </div>
            </div>

            {filteredStudents.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredStudents.map((student) => {
                  const meta = riskBandMeta[student.riskBand];
                  const Icon = meta.icon;
                  const logged = hasInterventionLogged(student.interventionLoggedAt);

                  return (
                    <button
                      key={student.id}
                      type="button"
                      data-testid="student-tile"
                      data-risk-band={student.riskBand}
                      data-student-id={student.id}
                      className={cn(
                        "group relative overflow-hidden rounded-3xl border p-4 text-left transition-all duration-200",
                        "hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "min-h-[190px]",
                        meta.className,
                      )}
                      aria-label={`${student.name}, ${meta.label}, ${formatMark(student.latestMark)} latest mark, ${formatMark(student.averageMark)} average mark${logged ? ", intervention logged" : ""}`}
                      onClick={() => setSelectedStudentId(student.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/40 bg-background/70 text-sm font-semibold tracking-wider text-foreground shadow-sm">
                              {student.initials}
                            </div>
                            <div>
                              <p className="text-sm font-semibold leading-none">{student.name}</p>
                              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-foreground/75">
                                {meta.label}
                              </p>
                            </div>
                          </div>
                        </div>
                        <Icon className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
                      </div>

                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-foreground/70">{student.module}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-2xl bg-background/70 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Latest</p>
                            <p className="mt-1 font-semibold">{formatMark(student.latestMark)}</p>
                          </div>
                          <div className="rounded-2xl bg-background/70 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Average</p>
                            <p className="mt-1 font-semibold">{formatMark(student.averageMark)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1.5 bg-background/70">
                          <TrendingDown className={cn("h-3.5 w-3.5", student.trend === "declining" ? "text-rose-600" : "text-muted-foreground")} />
                          {student.trend}
                        </Badge>
                        {logged ? (
                          <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-background/80 text-emerald-900">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Intervention logged
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1.5 bg-background/80">
                            <MinusCircle className="h-3.5 w-3.5" />
                            No intervention
                          </Badge>
                        )}
                        {student.predictedToFail ? (
                          <Badge variant="outline" className="gap-1.5 border-rose-500/30 bg-background/80 text-rose-900">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Likely to fail
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1.5 bg-background/80">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Pass likely
                          </Badge>
                        )}
                        {student.missingSubmission ? (
                          <Badge variant="outline" className="gap-1.5 bg-background/80">
                            <Clock3 className="h-3.5 w-3.5" />
                            Missing submission
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed border-primary/20 bg-background/70">
                <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <Filter className="h-6 w-6 text-muted-foreground" />
                  <p className="text-base font-medium">No students match the selected filters.</p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Clear one or more filters to bring students back into view.
                  </p>
                </CardContent>
              </Card>
            )}
          </section>

          <aside className="space-y-4">
            <Card className="border-primary/10 bg-card/90 shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="text-lg">{isDemo ? "What this demo shows" : "What this system shows"}</CardTitle>
                <p className="text-sm text-muted-foreground">{introText}</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {overviewBullets.map((line) => (
                  <p key={line}>• {line}</p>
                ))}
              </CardContent>
            </Card>

            <Card className="border-primary/10 bg-card/90 shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="text-lg">Model quality</CardTitle>
                <p className="text-sm text-muted-foreground">{modelQualityDescription}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Risk band holdout", value: formatPct(bandReport.holdoutAccuracy) },
                    { label: "Risk band CV", value: formatPct(bandReport.crossValidation.accuracy) },
                    { label: "Fail holdout", value: formatPct(failureReport.holdoutAccuracy) },
                    { label: "Fail CV", value: formatPct(failureReport.crossValidation.accuracy) },
                    { label: "Fail precision", value: formatPct(failureReport.precision) },
                    { label: "Fail recall", value: formatPct(failureReport.recall) },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-2xl border bg-muted/20 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                      <p className="mt-1 text-lg font-semibold">{metric.value}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fail confusion matrix</p>
                  <div className="grid grid-cols-[1.1fr_repeat(2,minmax(0,1fr))] gap-2 text-sm">
                    <div />
                    <div className="rounded-xl bg-background/70 px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Predicted pass
                    </div>
                    <div className="rounded-xl bg-background/70 px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Predicted fail
                    </div>
                    <div className="rounded-xl bg-background/70 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Actual pass
                    </div>
                    <div className="rounded-xl bg-background/70 px-3 py-2 text-center font-semibold">
                      {failureReport.confusionMatrix.trueNegatives}
                    </div>
                    <div className="rounded-xl bg-background/70 px-3 py-2 text-center font-semibold">
                      {failureReport.confusionMatrix.falsePositives}
                    </div>
                    <div className="rounded-xl bg-background/70 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Actual fail
                    </div>
                    <div className="rounded-xl bg-background/70 px-3 py-2 text-center font-semibold">
                      {failureReport.confusionMatrix.falseNegatives}
                    </div>
                    <div className="rounded-xl bg-background/70 px-3 py-2 text-center font-semibold">
                      {failureReport.confusionMatrix.truePositives}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <Sheet
        open={Boolean(selectedStudent)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStudentId(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selectedStudent ? (
            <div className="space-y-6 pt-8">
              <SheetHeader className="space-y-2 text-left">
                <Badge variant="secondary" className="w-fit gap-1.5">
                  {selectedBandMeta?.icon ? <selectedBandMeta.icon className="h-3.5 w-3.5" /> : null}
                  {selectedBandMeta?.label}
                </Badge>
                <SheetTitle className="text-2xl">{selectedStudent.name}</SheetTitle>
                <SheetDescription>
                  {selectedStudent.module} | confidence {selectedStudent.confidence}% | trend {selectedStudent.trend}
                </SheetDescription>
              </SheetHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Latest mark", value: formatMark(selectedStudent.latestMark) },
                  { label: "Average mark", value: formatMark(selectedStudent.averageMark) },
                  { label: "Risk band", value: selectedBandMeta?.label ?? "Unknown" },
                  { label: "Confidence", value: `${selectedStudent.confidence}%` },
                  {
                    label: "Failure prediction",
                    value: selectedStudent.predictedToFail ? "Likely to fail" : "Not currently predicted to fail",
                  },
                  { label: "Failure probability", value: `${selectedStudent.failProbability}%` },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Risk reasons</p>
                <ul className="space-y-2">
                  {selectedStudent.riskReasons.map((reason) => (
                    <li key={reason} className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 rounded-2xl border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggested action</p>
                <p className="text-sm leading-6">{selectedStudent.suggestedAction}</p>
              </div>

              <div className="space-y-2 rounded-2xl border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Intervention status</p>
                <p className="text-sm leading-6">
                  {hasInterventionLogged(selectedStudent.interventionLoggedAt)
                    ? `Intervention logged on ${new Date(selectedStudent.interventionLoggedAt ?? "").toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}.`
                    : "No intervention has been logged for this student yet."}
                </p>
              </div>

              {readOnly ? (
                <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Admin oversight is read-only. Lecturers can log interventions from their dashboard view.
                </div>
              ) : (
                <Button
                  onClick={() => {
                    void handleLogIntervention();
                  }}
                  className="w-full"
                  disabled={isLoggingIntervention || hasInterventionLogged(selectedStudent.interventionLoggedAt)}
                >
                  {isLoggingIntervention
                    ? "Logging intervention..."
                    : hasInterventionLogged(selectedStudent.interventionLoggedAt)
                      ? "Intervention already logged"
                      : "Log Intervention"}
                </Button>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
};
