import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { computeRisk } from "@/lib/studentRisk";
import { fetchLecturerStudentProfileDataset } from "@/lib/data/student";
import { safeFormatDate } from "@/lib/date";
import { dispatchCommunicationMessage } from "@/lib/communications";
import { log } from "@/lib/logger";
import { toast } from "sonner";
import {
  buildManualInterventionPayload,
  fetchStudentInterventions,
  getInterventionErrorText,
  getStudentInterventionReadiness,
  isInterventionOverdue,
  insertManualIntervention,
  normalizeManualInterventionStatus,
  normalizeManualInterventionType,
  type InterventionEntry,
  type ManualInterventionStatus,
  type ManualInterventionType,
  updateStudentInterventionStatus,
} from "@/lib/interventions";
import {
  buildStudentInsightData,
  matchStudentSubmissions,
  type StudentAssignment,
  type StudentInsightData,
  type StudentSubmission,
} from "@/lib/studentProfile";
import { DashboardEmptyState, DashboardErrorState, DashboardLoadingState } from "@/components/dashboard/PageStates";
import {
  StudentInterventionFormCard,
  StudentInterventionHistoryCard,
  StudentMissedAssignmentsCard,
  StudentProfileBackButton,
  StudentProfileHero,
  StudentProfileSummaryCards,
  StudentRiskReasonsCard,
} from "@/pages/dashboard/student-profile/sections";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const StudentGradesTrendCard = lazy(() =>
  import("@/pages/dashboard/student-profile/trend-card").then((module) => ({
    default: module.StudentGradesTrendCard,
  })),
);

const StudentTrendLoadingCard = () => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Recent Grades Trend</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="h-[260px] animate-pulse rounded-lg bg-muted/40" />
    </CardContent>
  </Card>
);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string | null | undefined): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

const getSupportNotificationToastCopy = (
  actionLabel: string,
  dispatchResult: {
    ok: boolean;
    status: "created" | "duplicate" | "failed" | "unauthenticated";
  },
) => {
  if (dispatchResult.status === "duplicate") {
    return {
      level: "warning" as const,
      message: `${actionLabel} was already queued for this student. No duplicate notice was created.`,
    };
  }

  if (!dispatchResult.ok) {
    return {
      level: "error" as const,
      message: `${actionLabel} could not be queued right now.`,
    };
  }

  return {
    level: "success" as const,
    message: `${actionLabel} saved`,
  };
};

const StudentProfile = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user, isDemo } = useAuth();

  const decodedStudentId = decodeURIComponent(studentId || "");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [student, setStudent] = useState<StudentInsightData | null>(null);
  const [interventions, setInterventions] = useState<InterventionEntry[]>([]);
  const [interventionType, setInterventionType] = useState<ManualInterventionType>("email");
  const [interventionStatus, setInterventionStatus] = useState<ManualInterventionStatus>("in_progress");
  const [interventionNote, setInterventionNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const resolvedStudentRecordId =
    student?.studentRecordId || (isUuid(student?.studentId) ? student.studentId : null);

  useEffect(() => {
    if (!user || !decodedStudentId) return;

    const loadStudent = async () => {
      setLoading(true);
      setLoadError(null);

      if (isDemo) {
        setStudent({
          name: "David Lee",
          email: "david.lee@example.edu",
          studentId: decodedStudentId,
          studentRecordId: decodedStudentId,
          modules: ["CS301", "CS205"],
          averageGrade: 38,
          latestGrade: 32,
          riskScore: 78,
          riskLevel: "critical",
          reasons: ["Average below 40%", "Steep grade decline", "Predicted next: 29%"],
          recommendation: "Urgent: schedule a 1-on-1 meeting, review fundamentals, and refer to support services.",
          missedAssignments: [
            {
              id: "demo-missed",
              title: "Algorithms Lab Reflection",
              module_code: "CS205",
              due_date: new Date().toISOString(),
              max_score: 20,
            },
          ],
          submissions: [],
          chart: [
            { assessment: "Assignment 1", grade: 65 },
            { assessment: "Midterm", grade: 58 },
            { assessment: "Assignment 2", grade: 45 },
            { assessment: "Lab Report", grade: 38 },
            { assessment: "Assignment 3", grade: 32 },
          ],
        });
        setLoading(false);
        return;
      }

      try {
        const { assignments, submissions: allSubmissions, grades } = await fetchLecturerStudentProfileDataset(user.id);
        if (assignments.length === 0) {
          setStudent(null);
          setLoading(false);
          return;
        }
        const matchingSubmissions = matchStudentSubmissions({
          submissions: allSubmissions,
          studentId: decodedStudentId,
        });

        if (matchingSubmissions.length === 0) {
          setStudent(null);
          setLoading(false);
          return;
        }

        const sortedSubmissions = [...matchingSubmissions].sort(
          (left, right) => new Date(left.submitted_at).getTime() - new Date(right.submitted_at).getTime(),
        );
        const matchedStudentEmail =
          sortedSubmissions.find((submission) => submission.student_email)?.student_email || null;
        let linkedStudentRecordId =
          sortedSubmissions.find((submission) => submission.student_id)?.student_id || null;

        if (!linkedStudentRecordId && matchedStudentEmail) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", matchedStudentEmail)
            .maybeSingle();

          if (profileError) {
            log.error("Failed to resolve student profile", profileError, {
              studentId: decodedStudentId,
            });
          } else {
            linkedStudentRecordId = profileData?.id ?? null;
          }
        }

        setStudent(
          buildStudentInsightData({
            assignments,
            submissions: allSubmissions,
            grades,
            decodedStudentId,
            studentRecordId: linkedStudentRecordId,
            computeRisk,
          }),
        );
      } catch (error) {
        log.error("Failed to load student profile", error, {
          studentId: decodedStudentId,
        });
        setLoadError("Student support profile could not be loaded right now.");
        setStudent(null);
      }

      setLoading(false);
    };

    void loadStudent();
  }, [decodedStudentId, isDemo, reloadKey, user]);

  const riskBadgeVariant = useMemo(() => {
    if (!student) return "outline";
    if (student.riskLevel === "critical") return "destructive";
    if (student.riskLevel === "high") return "secondary";
    return "outline";
  }, [student]);

  const trendDirection = useMemo(() => {
    if (!student || student.chart.length < 2) return "steady";
    const first = student.chart[0].grade;
    const last = student.chart[student.chart.length - 1].grade;
    if (last > first) return "up";
    if (last < first) return "down";
    return "steady";
  }, [student]);

  useEffect(() => {
    if (!user?.id || !resolvedStudentRecordId || isDemo) return;

    const loadInterventions = async () => {
      const { data, error } = await fetchStudentInterventions(supabase, user.id, resolvedStudentRecordId);

      if (error) {
        log.error("Failed to load interventions", error, {
          studentId: decodedStudentId,
        });
        toast.error(getInterventionErrorText(error) || "Could not load intervention history");
        return;
      }

      setInterventions(data || []);
    };

    void loadInterventions();
  }, [decodedStudentId, isDemo, resolvedStudentRecordId, user?.id]);

  const handleAddIntervention = async () => {
    if (!interventionNote.trim()) return;

    if (!student || !user?.id) {
      toast.error("Student context is not ready yet");
      return;
    }

    if (!resolvedStudentRecordId) {
      toast.error("This student record is missing a database ID, so the intervention cannot be saved yet");
      return;
    }

    if (isDemo) {
      const nextEntry: InterventionEntry = {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        type: interventionType,
        note: interventionNote.trim(),
        followUpDate: followUpDate || null,
        status: interventionStatus,
      };

      setInterventions((current) => [nextEntry, ...current]);
      setInterventionNote("");
      setFollowUpDate("");
      setInterventionType("email");
      setInterventionStatus("in_progress");
      return;
    }

    const safeInterventionType = normalizeManualInterventionType(interventionType);
    const safeInterventionStatus = normalizeManualInterventionStatus(interventionStatus);
    const payload = buildManualInterventionPayload({
      lecturerId: user.id,
      studentId: resolvedStudentRecordId,
      studentName: student.name,
      studentEmail: student.email,
      interventionType: safeInterventionType,
      interventionStatus: safeInterventionStatus,
      note: interventionNote,
      followUpDate: followUpDate || null,
      riskLevel: student.riskLevel,
    });

    const { data, error } = await insertManualIntervention(supabase, payload);

    if (error) {
      log.error("Failed to save intervention", error, {
        studentId: decodedStudentId,
      });
      toast.error(
        getInterventionErrorText(error) ||
          `Could not save intervention (type: ${safeInterventionType}, status: ${safeInterventionStatus})`,
      );
      return;
    }

    setInterventions((current) => (data ? [data, ...current] : current));
    setInterventionNote("");
    setFollowUpDate("");
    setInterventionType("email");
    setInterventionStatus("in_progress");
    toast.success("Intervention logged");

    const notificationResult = await dispatchCommunicationMessage({
      category: "intervention-follow-up",
      recipientName: student.name,
      recipientEmail: student.email,
      recipientId: resolvedStudentRecordId,
      subject: `${safeInterventionType.charAt(0).toUpperCase()}${safeInterventionType.slice(1)} support update`,
      body: `Dear ${student.name},

An academic support action has been logged for you.

Type:
${safeInterventionType}

Summary:
${interventionNote.trim()}

Status:
${safeInterventionStatus}

${followUpDate ? `Follow-up date: ${safeFormatDate(followUpDate, "MMM d, yyyy")}` : "Please check your improvement plan and follow any next steps shared by your lecturer."}`,
      relatedStudentId: resolvedStudentRecordId,
    });

    if (notificationResult.status === "failed" || notificationResult.status === "unauthenticated") {
      toast.warning("Intervention saved, but the student notification could not be created");
      return;
    }

    if (notificationResult.status === "duplicate") {
      toast.warning("Intervention logged. An equivalent student support notice was already queued.");
    }
  };

  const queueAtRiskAlert = async () => {
    if (isDemo) {
      toast.success("Demo at-risk alert queued.");
      return;
    }

    if (!student || !resolvedStudentRecordId) {
      toast.error("Student record is not linked, so the alert cannot be saved correctly yet");
      return;
    }
    const result = await dispatchCommunicationMessage({
      category: "at-risk-alert",
      recipientName: student.name,
      recipientEmail: student.email,
      recipientId: resolvedStudentRecordId,
      subject: `Academic support check-in for ${student.name}`,
      body: `Dear ${student.name},

Your recent assessment pattern suggests it may be useful to arrange an academic support review.

Why you are being contacted:
- ${student.reasons.join("\n- ")}

Recommended next step:
${student.recommendation}

Please reply to arrange a short meeting so we can agree the most useful support before the next submission.`,
      relatedStudentId: resolvedStudentRecordId,
    });
    const feedback = getSupportNotificationToastCopy("At-risk alert", result);
    toast[feedback.level](feedback.message);
  };

  const queueFollowUpReminder = async () => {
    if (isDemo) {
      toast.success("Demo follow-up reminder queued.");
      return;
    }

    if (!student || !resolvedStudentRecordId) {
      toast.error("Student record is not linked, so the reminder cannot be saved correctly yet");
      return;
    }
    const latestIntervention = interventions[0];
    const result = await dispatchCommunicationMessage({
      category: "intervention-follow-up",
      recipientName: student.name,
      recipientEmail: student.email,
      recipientId: resolvedStudentRecordId,
      subject: "Follow-up on your academic support plan",
      body: `Dear ${student.name},

This is a follow-up on the support actions we discussed${latestIntervention ? ` on ${safeFormatDate(latestIntervention.createdAt, "MMM d, yyyy")}` : ""}.

Current focus:
${student.recommendation}

Please share a short update before ${latestIntervention?.followUpDate ? safeFormatDate(latestIntervention.followUpDate, "MMM d, yyyy") : "our next review"} so we can confirm what is working and what still needs attention.`,
      relatedStudentId: resolvedStudentRecordId,
    });
    const feedback = getSupportNotificationToastCopy("Follow-up reminder", result);
    toast[feedback.level](feedback.message);
  };

  const handleUpdateInterventionStatus = async (
    interventionId: string,
    nextStatus: ManualInterventionStatus,
  ) => {
    if (isDemo) {
      setInterventions((current) =>
        current.map((entry) => (entry.id === interventionId ? { ...entry, status: nextStatus } : entry)),
      );
      toast.success(nextStatus === "resolved" ? "Demo intervention resolved." : "Demo intervention reopened.");
      return;
    }

    const { data, error } = await updateStudentInterventionStatus(supabase, interventionId, nextStatus);

    if (error) {
      toast.error(getInterventionErrorText(error) || "Could not update intervention status");
      return;
    }

    setInterventions((current) =>
      current.map((entry) => (entry.id === interventionId && data ? data : entry)),
    );
    toast.success(nextStatus === "resolved" ? "Intervention resolved" : "Intervention reopened");
  };

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (loadError) {
    return (
      <DashboardErrorState
        title="Student support profile unavailable"
        description={loadError}
        action={
          <Button variant="outline" onClick={() => setReloadKey((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  if (!student) {
    return (
      <div className="space-y-4 animate-fade-in">
        <StudentProfileBackButton onBack={() => navigate(-1)} />
        <DashboardEmptyState
          title="Student not found"
          description="Student not found for this lecturer view."
        />
      </div>
    );
  }

  const openInterventions = interventions.filter(
    (entry) => entry.status === "planned" || entry.status === "in_progress",
  ).length;
  const overdueInterventions = interventions.filter((entry) => isInterventionOverdue(entry)).length;
  const interventionReadiness = getStudentInterventionReadiness({
    riskLevel: student.riskLevel,
    recommendation: student.recommendation,
    missedAssignmentsCount: student.missedAssignments.length,
    openInterventions,
    overdueInterventions,
    latestIntervention: interventions[0] || null,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <StudentProfileBackButton onBack={() => navigate(-1)} />

      <StudentProfileHero
        student={student}
        riskBadgeVariant={riskBadgeVariant as "outline" | "secondary" | "destructive"}
        openInterventions={openInterventions}
        onQueueAtRiskAlert={() => void queueAtRiskAlert()}
        onQueueFollowUpReminder={() => void queueFollowUpReminder()}
      />

      <div className="rounded-lg border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-base font-semibold tracking-tight">Support Priorities</h3>
          <p className="text-sm text-muted-foreground">
            A compact reading of what this student support view is most likely to require next.
          </p>
        </div>
        <div className="grid gap-4 p-6 pt-0 md:grid-cols-3">
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current posture</p>
            <p className="mt-2 text-sm font-semibold">{interventionReadiness.postureLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Based on current risk level, missed assignments, and open intervention state for this student.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely challenge</p>
            <p className="mt-2 text-sm font-semibold">{interventionReadiness.likelyChallenge}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This is the support issue most likely to need follow-up or a clear explanation in review.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next action</p>
            <p className="mt-2 text-sm font-semibold">{interventionReadiness.bestNextAction}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use this to decide whether to open a first intervention, chase progress, or close the loop.
            </p>
          </div>
        </div>
      </div>

      <StudentProfileSummaryCards
        student={student}
        trendDirection={trendDirection}
        openInterventions={openInterventions}
        onEmailStudent={() => {
          window.location.href = `mailto:${student.email}`;
        }}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Suspense fallback={<StudentTrendLoadingCard />}>
          <StudentGradesTrendCard student={student} trendDirection={trendDirection} />
        </Suspense>
        <StudentRiskReasonsCard student={student} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StudentMissedAssignmentsCard assignments={student.missedAssignments} />
        <StudentInterventionFormCard
          isDemo={isDemo}
          canSave={Boolean(resolvedStudentRecordId)}
          interventionType={interventionType}
          interventionStatus={interventionStatus}
          interventionNote={interventionNote}
          followUpDate={followUpDate}
          onInterventionTypeChange={(value) => setInterventionType(normalizeManualInterventionType(value))}
          onInterventionStatusChange={(value) => setInterventionStatus(normalizeManualInterventionStatus(value))}
          onInterventionNoteChange={setInterventionNote}
          onFollowUpDateChange={setFollowUpDate}
          onSubmit={() => void handleAddIntervention()}
        />
      </div>

      <StudentInterventionHistoryCard
        interventions={interventions}
        onUpdateStatus={(interventionId, nextStatus) => void handleUpdateInterventionStatus(interventionId, nextStatus)}
      />
    </div>
  );
};

export default StudentProfile;
