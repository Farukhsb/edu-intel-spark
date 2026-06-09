import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, Info, ShieldAlert, Sparkles } from "lucide-react";

import { usePageMetadata } from "@/lib/seo";
import type { CohortSignalRiskBand, CohortSignalStudent } from "@/pages/cohortsignal-demo/demoData";

import { CohortSignalFiltersSection } from "./cohortsignal-heatmap-filters-section";
import { CohortSignalHeroSection } from "./cohortsignal-heatmap-hero-section";
import { CohortSignalDetailSheet } from "./cohortsignal-heatmap-detail-sheet";
import { CohortSignalSidebarSections } from "./cohortsignal-heatmap-sidebar-sections";
import { CohortSignalTilesSection } from "./cohortsignal-heatmap-tiles-section";
import type { HeatmapBandReport, HeatmapFailureReport, HeatmapFilterState, HeatmapRiskBandMeta } from "./index";

const riskBandMeta: HeatmapRiskBandMeta = {
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
    icon: Info,
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

const riskBandOptions: Array<{ value: HeatmapFilterState["riskBand"]; label: string }> = [
  { value: "all", label: "All risk bands" },
  { value: "low", label: "Low risk" },
  { value: "medium", label: "Medium risk" },
  { value: "high", label: "High risk" },
  { value: "insufficient", label: "Insufficient data" },
];

const weekStart = (referenceNow: string) => {
  const date = new Date(referenceNow);
  date.setUTCDate(date.getUTCDate() - 7);
  return date;
};

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
  bandReport: HeatmapBandReport;
  failureReport: HeatmapFailureReport;
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
  const [filters, setFilters] = useState<HeatmapFilterState>({
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
      if (filters.riskBand !== "all" && student.riskBand !== filters.riskBand) return false;
      if (filters.module !== "all" && student.module !== filters.module) return false;
      if (filters.noInterventionLogged && student.interventionLoggedAt != null) return false;
      if (filters.decliningTrend && student.trend !== "declining") return false;
      if (filters.missingSubmission && !student.missingSubmission) return false;
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
  const overviewBullets = getOverviewBullets(isDemo);
  const selectedBandMeta = selectedStudent ? riskBandMeta[selectedStudent.riskBand] : null;

  const handleLogIntervention = async () => {
    if (!selectedStudent || isLoggingIntervention || readOnly) return;

    setIsLoggingIntervention(true);
    try {
      const loggedAt = (await onLogIntervention?.(selectedStudent)) ?? new Date().toISOString();
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_26%),radial-gradient(circle_at_top_right,hsl(var(--accent)/0.12),transparent_24%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.2))] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <CohortSignalHeroSection
          bannerLabel={bannerLabel}
          bannerIcon={bannerIcon ?? <Sparkles className="h-3.5 w-3.5" />}
          introText={introText}
          totalStudents={students.length}
          highRiskCount={highRiskCount}
          mediumRiskCount={mediumRiskCount}
          lowRiskCount={lowRiskCount}
          interventionsLoggedThisWeek={interventionsLoggedThisWeek}
        />

        <CohortSignalFiltersSection
          filters={filters}
          onFiltersChange={setFilters}
          riskBandOptions={riskBandOptions}
          moduleOptions={moduleOptions}
          filteredCount={filteredStudents.length}
          totalCount={students.length}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <CohortSignalTilesSection
          students={filteredStudents}
          riskBandMeta={riskBandMeta}
          onSelectStudent={setSelectedStudentId}
        />

          <CohortSignalSidebarSections
            isDemo={isDemo}
            introText={introText}
            overviewBullets={overviewBullets}
            modelQualityDescription={modelQualityDescription}
            bandReport={bandReport}
            failureReport={failureReport}
          />
        </div>
      </div>

        <CohortSignalDetailSheet
          selectedStudent={selectedStudent}
          selectedBandMeta={selectedBandMeta}
          readOnly={readOnly}
          isLoggingIntervention={isLoggingIntervention}
        onClose={(open) => {
          if (!open) setSelectedStudentId(null);
        }}
        onLogIntervention={() => {
          void handleLogIntervention();
        }}
      />
    </div>
  );
};
