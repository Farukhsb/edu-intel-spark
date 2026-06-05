import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { DashboardDemoBanner } from "@/components/dashboard/PageStates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StudentGradesTrendCard } from "@/pages/dashboard/student-profile/trend-card";
import {
  StudentInterventionHistoryCard,
  StudentMissedAssignmentsCard,
  StudentProfileBackButton,
  StudentProfileHero,
  StudentProfileSummaryCards,
  StudentRiskReasonsCard,
} from "@/pages/dashboard/student-profile/sections";
import { DemoStudentInterventionFormCard } from "@/pages/dashboard/student-profile/demo-intervention-form-card";
import {
  StudentInterventionEvidenceTrailCard,
  StudentInterventionEventFormCard,
} from "@/pages/dashboard/student-profile/sections";
import { type StudentInsightData } from "@/lib/studentProfile";
import {
  buildStudentInterventionEventPayload,
  type InterventionContactMethod,
  type InterventionContactTargetType,
  type InterventionEntry,
  type InterventionEventEntry,
  type InterventionOutcome,
  type ManualInterventionStatus,
  type ManualInterventionType,
} from "@/lib/interventions";
import { getStudentInterventionReadiness } from "@/lib/interventions";

const DEMO_STUDENT: StudentInsightData = {
  name: "David Lee",
  email: "david.lee@example.edu",
  studentId: "demo-student",
  studentRecordId: "demo-student",
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
};

const toDateTimeLocalValue = (value: Date = new Date()) => {
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(
    value.getMinutes(),
  )}`;
};

const DemoStudentProfile = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [interventions, setInterventions] = useState<InterventionEntry[]>([]);
  const [interventionEvents, setInterventionEvents] = useState<InterventionEventEntry[]>([]);
  const [interventionType, setInterventionType] = useState<ManualInterventionType>("email");
  const [interventionStatus, setInterventionStatus] = useState<ManualInterventionStatus>("in_progress");
  const [interventionNote, setInterventionNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [evidenceInterventionId, setEvidenceInterventionId] = useState("");
  const [evidenceContactTargetType, setEvidenceContactTargetType] = useState<InterventionContactTargetType>("student");
  const [evidenceContactTargetName, setEvidenceContactTargetName] = useState(studentId ?? DEMO_STUDENT.name);
  const [evidenceContactMethod, setEvidenceContactMethod] = useState<InterventionContactMethod>("email");
  const [evidenceOutcome, setEvidenceOutcome] = useState<InterventionOutcome>("ongoing");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [evidenceNextStep, setEvidenceNextStep] = useState("");
  const [evidenceContactedAt, setEvidenceContactedAt] = useState(toDateTimeLocalValue());

  const student = useMemo(
    () => ({
      ...DEMO_STUDENT,
      studentId: studentId ?? DEMO_STUDENT.studentId,
      studentRecordId: studentId ?? DEMO_STUDENT.studentRecordId,
    }),
    [studentId],
  );

  const trendDirection = useMemo(() => {
    if (student.chart.length < 2) return "steady" as const;
    const first = student.chart[0].grade;
    const last = student.chart[student.chart.length - 1].grade;
    if (last > first) return "up" as const;
    if (last < first) return "down" as const;
    return "steady" as const;
  }, [student.chart]);

  useEffect(() => {
    setEvidenceContactTargetName((current) => current || student.name);
  }, [student.name]);

  const openInterventions = interventions.filter((entry) => entry.status === "planned" || entry.status === "in_progress").length;
  const overdueInterventions = useMemo(
    () =>
      interventions.filter(
        (entry) =>
          (entry.status === "planned" || entry.status === "in_progress") &&
          entry.followUpDate &&
          new Date(entry.followUpDate).getTime() < Date.now(),
      ).length,
    [interventions],
  );
  const interventionReadiness = getStudentInterventionReadiness({
    riskLevel: student.riskLevel,
    recommendation: student.recommendation,
    missedAssignmentsCount: student.missedAssignments.length,
    openInterventions,
    overdueInterventions,
    latestIntervention: interventions[0] ?? null,
  });

  const handleAddIntervention = () => {
    if (!interventionNote.trim()) {
      return;
    }

    const nextEntry: InterventionEntry = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      title: `${interventionType.charAt(0).toUpperCase()}${interventionType.slice(1)} intervention`,
      type: interventionType,
      note: interventionNote.trim(),
      followUpDate: followUpDate || null,
      status: interventionStatus,
    };

    setInterventions((current) => [nextEntry, ...current]);
    setEvidenceInterventionId(nextEntry.id);
    setInterventionNote("");
    setFollowUpDate("");
    setInterventionType("email");
    setInterventionStatus("in_progress");
    toast.success("Demo intervention logged");
  };

  const handleLogEvidence = () => {
    if (!evidenceInterventionId) {
      return;
    }

    const payload = buildStudentInterventionEventPayload({
      lecturerId: "demo-lecturer",
      studentId: student.studentRecordId ?? student.studentId,
      interventionId: evidenceInterventionId,
      contactTargetType: evidenceContactTargetType,
      contactTargetName: evidenceContactTargetName,
      contactMethod: evidenceContactMethod,
      outcome: evidenceOutcome,
      summary: evidenceSummary,
      nextStep: evidenceNextStep || null,
      contactedAt: new Date(evidenceContactedAt).toISOString(),
    });

    const nextEntry: InterventionEventEntry = {
      id: `${Date.now()}`,
      interventionId: payload.intervention_id,
      studentId: payload.student_id,
      lecturerId: payload.lecturer_id,
      contactedAt: payload.contacted_at || new Date().toISOString(),
      contactTargetType: payload.contact_target_type as InterventionContactTargetType,
      contactTargetName: payload.contact_target_name,
      contactMethod: payload.contact_method as InterventionContactMethod,
      outcome: payload.outcome as InterventionOutcome,
      summary: payload.summary,
      nextStep: payload.next_step || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setInterventionEvents((current) => [nextEntry, ...current]);
    setEvidenceContactTargetType("student");
    setEvidenceContactTargetName(student.name);
    setEvidenceContactMethod("email");
    setEvidenceOutcome("ongoing");
    setEvidenceSummary("");
    setEvidenceNextStep("");
    setEvidenceContactedAt(toDateTimeLocalValue());
    toast.success("Demo contact evidence logged");
  };

  const queueAtRiskAlert = () => {
    toast.success("Demo at-risk alert queued.");
  };

  const queueFollowUpReminder = () => {
    toast.success("Demo follow-up reminder queued.");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardDemoBanner label="Viewing demo student support profile" />

      <StudentProfileBackButton onBack={() => navigate(-1)} />

      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">Demo student profile</p>
          <p className="text-xs text-muted-foreground">
            This view shows the same intervention and risk workflow without connecting to live student records.
          </p>
        </CardContent>
      </Card>

      <StudentProfileHero
        student={student}
        riskBadgeVariant="destructive"
        openInterventions={openInterventions}
        onQueueAtRiskAlert={queueAtRiskAlert}
        onQueueFollowUpReminder={queueFollowUpReminder}
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
            <p className="mt-1 text-sm text-muted-foreground">Based on the demo student&apos;s risk pattern and missed work.</p>
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
          window.location.href = `mailto:${student.email ?? ""}`;
        }}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <StudentGradesTrendCard student={student} trendDirection={trendDirection} />
        <StudentRiskReasonsCard student={student} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StudentMissedAssignmentsCard assignments={student.missedAssignments} />
        <DemoStudentInterventionFormCard
          canSave
          interventionType={interventionType}
          interventionStatus={interventionStatus}
          interventionNote={interventionNote}
          followUpDate={followUpDate}
          onInterventionTypeChange={(value) => setInterventionType(value as ManualInterventionType)}
          onInterventionStatusChange={(value) => setInterventionStatus(value as ManualInterventionStatus)}
          onInterventionNoteChange={setInterventionNote}
          onFollowUpDateChange={setFollowUpDate}
          onSubmit={handleAddIntervention}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StudentInterventionEventFormCard
          canSave={interventions.length > 0}
          interventionId={evidenceInterventionId}
          contactTargetType={evidenceContactTargetType}
          contactTargetName={evidenceContactTargetName}
          contactMethod={evidenceContactMethod}
          outcome={evidenceOutcome}
          summary={evidenceSummary}
          nextStep={evidenceNextStep}
          contactedAt={evidenceContactedAt}
          interventions={interventions}
          onInterventionIdChange={setEvidenceInterventionId}
          onContactTargetTypeChange={(value) => setEvidenceContactTargetType(value as InterventionContactTargetType)}
          onContactTargetNameChange={setEvidenceContactTargetName}
          onContactMethodChange={(value) => setEvidenceContactMethod(value as InterventionContactMethod)}
          onOutcomeChange={(value) => setEvidenceOutcome(value as InterventionOutcome)}
          onSummaryChange={setEvidenceSummary}
          onNextStepChange={setEvidenceNextStep}
          onContactedAtChange={setEvidenceContactedAt}
          onSubmit={handleLogEvidence}
        />
        <StudentInterventionHistoryCard
          interventions={interventions}
          onUpdateStatus={(interventionId, nextStatus) =>
            setInterventions((current) =>
              current.map((entry) => (entry.id === interventionId ? { ...entry, status: nextStatus } : entry)),
            )
          }
        />
      </div>

      <StudentInterventionEvidenceTrailCard
        interventions={interventions}
        events={interventionEvents}
      />
    </div>
  );
};

export default DemoStudentProfile;
