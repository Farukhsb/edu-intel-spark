import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { type AtRiskStudent, computeRisk, type StudentTrajectory } from "@/lib/studentRisk";
import { log } from "@/lib/logger";
import {
  DashboardDemoBanner,
  DashboardEmptyState,
  DashboardLoadingState,
} from "@/components/dashboard/PageStates";
import {
  buildGradeDistribution,
  buildPerformanceProjection,
  EMPTY_GRADE_DIST,
  filterAtRiskStudents,
} from "@/lib/performanceAnalytics";
import {
  AssessmentTrendsCard,
  EarlySupportSignalsCard,
  FilteredInterventionBanner,
  GradeDistributionCard,
  PerformanceFiltersBar,
  StudentSupportSummaryCard,
} from "@/pages/dashboard/performance-trends/sections";

const ASSIGNMENT_FIELDS = "id, title, module_code";
const SUBMISSION_FIELDS = "id, assignment_id, student_id, student_name, student_email, submitted_at";
const GRADE_FIELDS = "submission_id, ai_score, final_score";

type DemoAssessmentTrend = {
  module: string;
  name: string;
  avgGrade: number;
  participation: number;
};

type DemoTrajectory = StudentTrajectory & {
  module: string;
};

const DEMO_ASSESSMENT_TRENDS: DemoAssessmentTrend[] = [
  { module: "CS301", name: "Sorting Report Draft", avgGrade: 68, participation: 94 },
  { module: "CS301", name: "Algorithm Benchmark Reflection", avgGrade: 63, participation: 91 },
  { module: "CS220", name: "Normalisation Case Study", avgGrade: 57, participation: 89 },
  { module: "CS220", name: "Schema Redesign Memo", avgGrade: 61, participation: 86 },
];

const DEMO_GRADE_SCORES: Array<{ module: string; score: number }> = [
  { module: "CS301", score: 81 },
  { module: "CS301", score: 76 },
  { module: "CS301", score: 74 },
  { module: "CS301", score: 69 },
  { module: "CS301", score: 66 },
  { module: "CS301", score: 58 },
  { module: "CS301", score: 45 },
  { module: "CS301", score: 34 },
  { module: "CS220", score: 72 },
  { module: "CS220", score: 64 },
  { module: "CS220", score: 59 },
  { module: "CS220", score: 56 },
  { module: "CS220", score: 48 },
  { module: "CS220", score: 41 },
  { module: "CS220", score: 38 },
  { module: "CS220", score: 29 },
];

const DEMO_TRAJECTORIES: DemoTrajectory[] = [
  {
    module: "CS301",
    name: "Mariam Okeke",
    email: "mariam.okeke@example.edu",
    studentId: "demo-risk-1",
    scores: [
      { score: 49, date: "2026-01-20T09:00:00.000Z", assignmentTitle: "Sorting Lab Checkpoint" },
      { score: 37, date: "2026-02-18T09:00:00.000Z", assignmentTitle: "Algorithm Reflection" },
      { score: 26, date: "2026-03-22T09:00:00.000Z", assignmentTitle: "Benchmark Planning Memo" },
    ],
  },
  {
    module: "CS301",
    name: "Oliver Grant",
    email: "oliver.grant@example.edu",
    studentId: "demo-risk-2",
    scores: [
      { score: 62, date: "2026-01-20T09:00:00.000Z", assignmentTitle: "Sorting Lab Checkpoint" },
      { score: 48, date: "2026-02-18T09:00:00.000Z", assignmentTitle: "Algorithm Reflection" },
      { score: 34, date: "2026-03-22T09:00:00.000Z", assignmentTitle: "Benchmark Planning Memo" },
    ],
  },
  {
    module: "CS220",
    name: "Fatima Bello",
    email: "fatima.bello@example.edu",
    studentId: "demo-risk-3",
    scores: [
      { score: 71, date: "2026-01-16T09:00:00.000Z", assignmentTitle: "ER Model Exercise" },
      { score: 55, date: "2026-02-14T09:00:00.000Z", assignmentTitle: "Functional Dependency Quiz" },
      { score: 38, date: "2026-03-12T09:00:00.000Z", assignmentTitle: "Normalisation Case Study" },
    ],
  },
  {
    module: "CS220",
    name: "Samuel Hart",
    email: "samuel.hart@example.edu",
    studentId: "demo-risk-4",
    scores: [
      { score: 52, date: "2026-01-16T09:00:00.000Z", assignmentTitle: "ER Model Exercise" },
      { score: 47, date: "2026-02-14T09:00:00.000Z", assignmentTitle: "Functional Dependency Quiz" },
      { score: 43, date: "2026-03-12T09:00:00.000Z", assignmentTitle: "Normalisation Case Study" },
    ],
  },
];

const PerformanceTrends = () => {
  const { user, isDemo } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [moduleFilter, setModuleFilter] = useState("all");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const [modules, setModules] = useState<string[]>([]);
  const [assessmentTrends, setAssessmentTrends] = useState<{ name: string; avgGrade: number; participation: number }[]>([]);
  const [gradeDist, setGradeDist] = useState(EMPTY_GRADE_DIST);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);

  const riskFilter = searchParams.get("risk") || "all";
  const scoreBandFilter = searchParams.get("scoreBand") || "all";

  useEffect(() => {
    if (isDemo) {
      const demoModules = Array.from(new Set(DEMO_ASSESSMENT_TRENDS.map((entry) => entry.module)));
      const filteredTrends =
        moduleFilter === "all"
          ? DEMO_ASSESSMENT_TRENDS
          : DEMO_ASSESSMENT_TRENDS.filter((entry) => entry.module === moduleFilter);
      const filteredScores = DEMO_GRADE_SCORES
        .filter((entry) => moduleFilter === "all" || entry.module === moduleFilter)
        .map((entry) => entry.score);
      const filteredStudents = DEMO_TRAJECTORIES
        .filter((student) => moduleFilter === "all" || student.module === moduleFilter)
        .map(computeRisk)
        .filter((student): student is AtRiskStudent => student !== null)
        .sort((left, right) => right.riskScore - left.riskScore);

      setModules(demoModules);
      setAssessmentTrends(
        filteredTrends.map(({ name, avgGrade, participation }) => ({
          name,
          avgGrade,
          participation,
        })),
      );
      setGradeDist(buildGradeDistribution(filteredScores));
      setAtRiskStudents(filteredStudents);
      setLoading(false);
      return;
    }

    if (!user) return;

    const fetchLiveData = async () => {
      try {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from("assignments")
          .select(ASSIGNMENT_FIELDS)
          .eq("lecturer_id", user.id);

        if (assignmentsError) throw assignmentsError;

        const assignments = assignmentsData || [];
        if (assignments.length === 0) {
          setModules([]);
          setAssessmentTrends([]);
          setGradeDist(EMPTY_GRADE_DIST);
          setAtRiskStudents([]);
          setLoading(false);
          return;
        }

        const assignmentIds = assignments.map((assignment) => assignment.id);
        const moduleSet = new Set(assignments.map((assignment) => assignment.module_code).filter(Boolean) as string[]);
        setModules(Array.from(moduleSet));

        const { data: submissionsData, error: submissionsError } = await supabase
          .from("submissions")
          .select(SUBMISSION_FIELDS)
          .in("assignment_id", assignmentIds);

        if (submissionsError) throw submissionsError;

        const submissions = submissionsData || [];
        if (submissions.length === 0) {
          setAssessmentTrends([]);
          setGradeDist(EMPTY_GRADE_DIST);
          setAtRiskStudents([]);
          setLoading(false);
          return;
        }

        const submissionIds = submissions.map((submission) => submission.id);
        let grades: Array<{ submission_id: string; ai_score: number | null; final_score: number | null }> = [];
        if (submissionIds.length > 0) {
          const { data: gradesData, error: gradesError } = await supabase
            .from("grades")
            .select(GRADE_FIELDS)
            .in("submission_id", submissionIds);

          if (gradesError) throw gradesError;
          grades = gradesData || [];
        }

        const projection = buildPerformanceProjection({
          assignments,
          submissions,
          grades,
          moduleFilter,
          computeRisk,
        });

        setAssessmentTrends(projection.assessmentTrends);
        setGradeDist(projection.gradeDist);
        setAtRiskStudents(projection.atRiskStudents);
      } catch (error) {
        log.error("Failed to fetch performance data", error);
      }

      setLoading(false);
    };

    void fetchLiveData();
  }, [isDemo, user?.id, moduleFilter]);

  useEffect(() => {
    if (alertsDismissed || atRiskStudents.length === 0) return;

    const critical = atRiskStudents.filter((student) => student.riskLevel === "critical");
    const high = atRiskStudents.filter((student) => student.riskLevel === "high");

    if (critical.length > 0) {
      toast({
        variant: "destructive",
        title: `Critical At-Risk Student${critical.length > 1 ? "s" : ""}`,
        description: `${critical.map((student) => student.name).join(", ")} - immediate intervention recommended.`,
      });
    }

    if (high.length > 0) {
      toast({
        title: `${high.length} High-Risk Student${high.length > 1 ? "s" : ""} Detected`,
        description: `${high.map((student) => student.name).join(", ")} - review their trajectories.`,
      });
    }

    setAlertsDismissed(true);
  }, [atRiskStudents, alertsDismissed, toast]);

  const filteredAtRiskStudents = useMemo(() => {
    return filterAtRiskStudents({
      students: atRiskStudents,
      riskFilter,
      scoreBandFilter,
    });
  }, [atRiskStudents, riskFilter, scoreBandFilter]);

  const updateFilters = (nextRisk: string, nextScoreBand: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextRisk === "all") next.delete("risk");
    else next.set("risk", nextRisk);

    if (nextScoreBand === "all") next.delete("scoreBand");
    else next.set("scoreBand", nextScoreBand);

    setSearchParams(next);
  };

  if (loading) {
    return <DashboardLoadingState />;
  }

  const noData = assessmentTrends.length === 0 && gradeDist.every((entry) => entry.count === 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && <DashboardDemoBanner label="Viewing demo performance trends data" />}
      <PerformanceFiltersBar
        modules={modules}
        moduleFilter={moduleFilter}
        riskFilter={riskFilter}
        scoreBandFilter={scoreBandFilter}
        atRiskCount={atRiskStudents.length}
        onModuleFilterChange={setModuleFilter}
        onRiskFilterChange={(value) => updateFilters(value, scoreBandFilter)}
        onScoreBandFilterChange={(value) => updateFilters(riskFilter, value)}
      />

      {(riskFilter !== "all" || scoreBandFilter !== "all") && (
        <FilteredInterventionBanner count={filteredAtRiskStudents.length} onClear={() => updateFilters("all", "all")} />
      )}

      {noData ? (
        <DashboardEmptyState
          title="No graded submissions yet"
          description="Performance trends will appear once assignments are graded."
        />
      ) : (
        <>
          {assessmentTrends.length > 0 && (
            <AssessmentTrendsCard assessmentTrends={assessmentTrends} />
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <GradeDistributionCard gradeDist={gradeDist} />
            <StudentSupportSummaryCard filteredStudents={filteredAtRiskStudents} allAtRiskCount={atRiskStudents.length} />
          </div>

          <EarlySupportSignalsCard
            students={filteredAtRiskStudents}
            allAtRiskCount={atRiskStudents.length}
            expandedStudent={expandedStudent}
            onToggleStudent={(studentId) => setExpandedStudent(studentId || null)}
            onOpenStudentPlan={(studentId) => navigate(`/dashboard/student/${encodeURIComponent(studentId)}`)}
            onContactStudent={(student) => {
              window.location.href = `mailto:${student.email}?subject=Academic Support - Performance Check-in&body=Dear ${student.name},%0A%0AI would like to schedule a meeting to discuss your academic progress and explore support options available to you.%0A%0ABest regards`;
            }}
          />
        </>
      )}
    </div>
  );
};

export default PerformanceTrends;
