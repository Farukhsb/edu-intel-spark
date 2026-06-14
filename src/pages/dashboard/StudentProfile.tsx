import { Suspense, lazy } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState, DashboardErrorState, DashboardLoadingState } from "@/components/dashboard/PageStates";
import {
  StudentInterventionEvidenceTrailCard,
  StudentInterventionEventFormCard,
  StudentInterventionFormCard,
  StudentInterventionHistoryCard,
  StudentMissedAssignmentsCard,
  StudentProfileBackButton,
  StudentProfileHero,
  StudentProfileSummaryCards,
  StudentRiskReasonsCard,
} from "@/pages/dashboard/student-profile/sections";
import { useStudentProfileController } from "@/pages/dashboard/student-profile/useStudentProfileController";
import {
  normalizeManualInterventionStatus,
  normalizeManualInterventionType,
  type InterventionContactMethod,
  type InterventionContactTargetType,
  type InterventionOutcome,
  type ManualInterventionStatus,
  type ManualInterventionType,
} from "@/lib/interventions";

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

const StudentProfile = () => {
  const {
    evidenceContactMethod,
    evidenceContactTargetName,
    evidenceContactTargetType,
    evidenceContactedAt,
    evidenceInterventionId,
    evidenceNextStep,
    evidenceOutcome,
    evidenceSummary,
    followUpDate,
    handleAddIntervention,
    handleLogEvidence,
    handleUpdateInterventionStatus,
    interventionEvents,
    interventionNote,
    interventionReadiness,
    interventionStatus,
    interventionType,
    interventions,
    loadError,
    loading,
    navigate,
    openInterventions,
    queueAtRiskAlert,
    queueFollowUpReminder,
    reloadStudent,
    resolvedStudentRecordId,
    riskBadgeVariant,
    setEvidenceContactMethod,
    setEvidenceContactTargetName,
    setEvidenceContactTargetType,
    setEvidenceContactedAt,
    setEvidenceInterventionId,
    setEvidenceNextStep,
    setEvidenceOutcome,
    setEvidenceSummary,
    setFollowUpDate,
    setInterventionNote,
    setInterventionStatus,
    setInterventionType,
    student,
    trendDirection,
  } = useStudentProfileController();

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (loadError) {
    return (
      <DashboardErrorState
        title="Student support profile unavailable"
        description={loadError}
        action={
          <Button variant="outline" onClick={reloadStudent}>
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
        <DashboardEmptyState title="Student not found" description="Student not found for this lecturer view." />
      </div>
    );
  }

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
            <p className="mt-2 text-sm font-semibold">{interventionReadiness?.postureLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Based on current risk level, missed assignments, and open intervention state for this student.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely challenge</p>
            <p className="mt-2 text-sm font-semibold">{interventionReadiness?.likelyChallenge}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This is the support issue most likely to need follow-up or a clear explanation in review.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next action</p>
            <p className="mt-2 text-sm font-semibold">{interventionReadiness?.bestNextAction}</p>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <StudentInterventionEventFormCard
          canSave={Boolean(resolvedStudentRecordId && interventions.length > 0)}
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
          onSubmit={() => void handleLogEvidence()}
        />
        <StudentInterventionHistoryCard
          interventions={interventions}
          onUpdateStatus={(interventionId, nextStatus) => void handleUpdateInterventionStatus(interventionId, nextStatus)}
        />
      </div>

      <StudentInterventionEvidenceTrailCard interventions={interventions} events={interventionEvents} />
    </div>
  );
};

export default StudentProfile;
