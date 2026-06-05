import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Clock3,
  Lightbulb,
  Mail,
  MessageSquareText,
  Target,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { safeFormatDate } from "@/lib/date";
import {
  formatManualInterventionStatus,
  formatInterventionContactMethod,
  formatInterventionContactTargetType,
  formatInterventionOutcome,
  isInterventionOverdue,
  type InterventionContactMethod,
  type InterventionContactTargetType,
  type InterventionEventEntry,
  type InterventionOutcome,
  type InterventionEntry,
  type ManualInterventionStatus,
  type ManualInterventionType,
} from "@/lib/interventions";
import type { StudentAssignment, StudentInsightData } from "@/lib/studentProfile";

export const StudentProfileBackButton = ({ onBack }: { onBack: () => void }) => (
  <Button variant="ghost" onClick={onBack}>
    <ArrowLeft className="mr-2 h-4 w-4" /> Back
  </Button>
);

export const StudentProfileHero = ({
  student,
  riskBadgeVariant,
  openInterventions,
  onQueueAtRiskAlert,
  onQueueFollowUpReminder,
}: {
  student: StudentInsightData;
  riskBadgeVariant: "outline" | "secondary" | "destructive";
  openInterventions: number;
  onQueueAtRiskAlert: () => void;
  onQueueFollowUpReminder: () => void;
}) => (
  <>
    <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
      <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold font-display">{student.name}</h2>
              <Badge variant={riskBadgeVariant}>
                {student.riskLevel === "watch" ? "Watchlist" : `${student.riskLevel} risk`}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {student.modules.length > 0 ? student.modules.join(", ") : "No modules recorded"}
            </p>
            <p className="max-w-2xl text-sm text-muted-foreground">{student.recommendation}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <StatPill label="Risk score" value={student.riskScore ?? "-"} />
          <StatPill label="Average" value={`${student.averageGrade ?? "-"}%`} />
          <StatPill label="Missed" value={student.missedAssignments.length} />
          <StatPill label="Open interventions" value={openInterventions} />
          <Button variant="outline" onClick={onQueueAtRiskAlert}>
            Send at-risk alert
          </Button>
          <Button variant="outline" onClick={onQueueFollowUpReminder}>
            Send follow-up reminder
          </Button>
        </div>
      </CardContent>
    </Card>
  </>
);

const StatPill = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border bg-background/70 p-3 text-center">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-2xl font-bold font-display">{value}</p>
  </div>
);

export const StudentProfileSummaryCards = ({
  student,
  trendDirection,
  openInterventions,
  onEmailStudent,
}: {
  student: StudentInsightData;
  trendDirection: "up" | "down" | "steady";
  openInterventions: number;
  onEmailStudent: () => void;
}) => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">Latest grade</p>
        <div className="mt-2 flex items-center gap-2">
          <p className="text-2xl font-semibold">{student.latestGrade ?? "-"}</p>
          {trendDirection === "up" ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : trendDirection === "down" ? (
            <TrendingDown className="h-4 w-4 text-destructive" />
          ) : null}
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">Submissions tracked</p>
        <p className="mt-2 text-2xl font-semibold">{student.submissions.length}</p>
      </CardContent>
    </Card>
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">Open interventions</p>
        <p className="mt-2 text-2xl font-semibold">{openInterventions}</p>
      </CardContent>
    </Card>
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">Contact</p>
        {student.email ? (
          <Button variant="outline" size="sm" className="mt-2 w-full justify-start" onClick={onEmailStudent}>
            <Mail className="mr-2 h-4 w-4" />
            Email student
          </Button>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No student email on record.</p>
        )}
      </CardContent>
    </Card>
  </div>
);

export const StudentRiskReasonsCard = ({ student }: { student: StudentInsightData }) => (
  <Card>
    <CardHeader>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <CardTitle className="text-base">Why This Student Is At Risk</CardTitle>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      {student.reasons.map((reason) => (
        <div key={reason} className="rounded-lg border p-3 text-sm">
          {reason}
        </div>
      ))}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Intervention suggestion</p>
            <p className="mt-1 text-sm text-muted-foreground">{student.recommendation}</p>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

export const StudentMissedAssignmentsCard = ({ assignments }: { assignments: StudentAssignment[] }) => (
  <Card>
    <CardHeader>
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Missed Submissions</CardTitle>
      </div>
      <CardDescription>Assignments with no submission found for this student</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {assignments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No missed assignments detected in this lecturer view.
        </div>
      ) : (
        assignments.map((assignment) => (
          <div key={assignment.id} className="rounded-lg border p-3">
            <p className="text-sm font-medium">{assignment.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {assignment.module_code || "No module"}{assignment.due_date ? ` • Due ${safeFormatDate(assignment.due_date, "MMM d, yyyy")}` : ""}
            </p>
          </div>
        ))
      )}
    </CardContent>
  </Card>
);

export const StudentInterventionFormCard = ({
  canSave,
  interventionType,
  interventionStatus,
  interventionNote,
  followUpDate,
  onInterventionTypeChange,
  onInterventionStatusChange,
  onInterventionNoteChange,
  onFollowUpDateChange,
  onSubmit,
}: {
  canSave: boolean;
  interventionType: ManualInterventionType;
  interventionStatus: ManualInterventionStatus;
  interventionNote: string;
  followUpDate: string;
  onInterventionTypeChange: (value: string) => void;
  onInterventionStatusChange: (value: string) => void;
  onInterventionNoteChange: (value: string) => void;
  onFollowUpDateChange: (value: string) => void;
  onSubmit: () => void;
}) => (
  <Card>
    <CardHeader>
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Intervention Tracking</CardTitle>
      </div>
      <CardDescription>Log actions, follow-up dates, and resolution status</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Intervention type</Label>
          <Select value={interventionType} onValueChange={onInterventionTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="feedback">Feedback</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={interventionStatus} onValueChange={onInterventionStatusChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="in_progress">Ongoing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Lecturer note</Label>
        <Textarea
          rows={4}
          value={interventionNote}
          onChange={(event) => onInterventionNoteChange(event.target.value)}
          placeholder="Record what happened, what support was offered, and what to review next."
        />
        {!canSave && (
          <p className="text-xs text-destructive">
            This student is missing a database ID, so interventions cannot be saved yet.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Follow-up date</Label>
        <Input type="date" value={followUpDate} onChange={(event) => onFollowUpDateChange(event.target.value)} />
      </div>

      <Button className="w-full" onClick={onSubmit} disabled={!interventionNote.trim() || !canSave}>
        Log intervention
      </Button>
    </CardContent>
  </Card>
);

export const StudentInterventionHistoryCard = ({
  interventions,
  onUpdateStatus,
}: {
  interventions: InterventionEntry[];
  onUpdateStatus: (interventionId: string, nextStatus: ManualInterventionStatus) => void;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Intervention History</CardTitle>
      <CardDescription>Saved to your connected Supabase project for this student</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {interventions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No interventions logged yet.
        </div>
      ) : (
        interventions.map((entry) => (
          <div key={entry.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="capitalize">{entry.type}</Badge>
              <Badge variant={entry.status === "resolved" ? "default" : "secondary"}>
                {formatManualInterventionStatus(entry.status)}
              </Badge>
              {isInterventionOverdue(entry) && (
                <Badge variant="destructive">Follow-up overdue</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Logged {safeFormatDate(entry.createdAt, "MMM d, yyyy HH:mm")}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium">{entry.title}</p>
            <p className="mt-3 text-sm">{entry.note}</p>
            {entry.followUpDate && (
              <p className="mt-2 text-xs text-muted-foreground">
                Follow up on {safeFormatDate(entry.followUpDate, "MMM d, yyyy")}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.status === "resolved" ? (
                <Button variant="outline" size="sm" onClick={() => onUpdateStatus(entry.id, "in_progress")}>
                  Reopen follow-up
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => onUpdateStatus(entry.id, "resolved")}>
                  Mark resolved
                </Button>
              )}
            </div>
          </div>
        ))
      )}
  </CardContent>
</Card>
);

const INTERVENTION_CONTACT_TARGETS: InterventionContactTargetType[] = [
  "student",
  "parent",
  "guardian",
  "tutor",
  "course_leader",
  "department_head",
  "support_service",
  "placement_supervisor",
  "employer",
  "other",
];

const INTERVENTION_CONTACT_METHODS: InterventionContactMethod[] = [
  "email",
  "meeting",
  "phone",
  "lms_message",
  "sms",
  "in_person",
  "referral",
  "other",
];

const INTERVENTION_OUTCOMES: InterventionOutcome[] = [
  "no_response",
  "left_message",
  "responded",
  "attended",
  "referred",
  "resolved",
  "follow_up_scheduled",
  "escalated",
  "ongoing",
  "other",
];

export const StudentInterventionEventFormCard = ({
  canSave,
  interventionId,
  contactTargetType,
  contactTargetName,
  contactMethod,
  outcome,
  summary,
  nextStep,
  contactedAt,
  interventions,
  onInterventionIdChange,
  onContactTargetTypeChange,
  onContactTargetNameChange,
  onContactMethodChange,
  onOutcomeChange,
  onSummaryChange,
  onNextStepChange,
  onContactedAtChange,
  onSubmit,
}: {
  canSave: boolean;
  interventionId: string;
  contactTargetType: InterventionContactTargetType;
  contactTargetName: string;
  contactMethod: InterventionContactMethod;
  outcome: InterventionOutcome;
  summary: string;
  nextStep: string;
  contactedAt: string;
  interventions: InterventionEntry[];
  onInterventionIdChange: (value: string) => void;
  onContactTargetTypeChange: (value: string) => void;
  onContactTargetNameChange: (value: string) => void;
  onContactMethodChange: (value: string) => void;
  onOutcomeChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
  onNextStepChange: (value: string) => void;
  onContactedAtChange: (value: string) => void;
  onSubmit: () => void;
}) => (
  <Card>
    <CardHeader>
      <div className="flex items-center gap-2">
        <Clock3 className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Intervention evidence log</CardTitle>
      </div>
      <CardDescription>Record who was contacted, when, by whom, and the outcome</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Intervention</Label>
          <Select value={interventionId} onValueChange={onInterventionIdChange}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an intervention" />
            </SelectTrigger>
            <SelectContent>
              {interventions.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No interventions available
                </SelectItem>
              ) : (
                interventions.map((intervention) => (
                  <SelectItem key={intervention.id} value={intervention.id}>
                    {intervention.title || intervention.type} - {intervention.status}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Contacted at</Label>
          <Input type="datetime-local" value={contactedAt} onChange={(event) => onContactedAtChange(event.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Who was contacted</Label>
          <Select value={contactTargetType} onValueChange={onContactTargetTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVENTION_CONTACT_TARGETS.map((target) => (
                <SelectItem key={target} value={target}>
                  {formatInterventionContactTargetType(target)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Contact name</Label>
          <Input
            value={contactTargetName}
            onChange={(event) => onContactTargetNameChange(event.target.value)}
            placeholder="Student, parent, tutor, or support contact"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>By what method</Label>
          <Select value={contactMethod} onValueChange={onContactMethodChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVENTION_CONTACT_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {formatInterventionContactMethod(method)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Outcome</Label>
          <Select value={outcome} onValueChange={onOutcomeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVENTION_OUTCOMES.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {formatInterventionOutcome(entry)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Evidence summary</Label>
        <Textarea
          rows={4}
          value={summary}
          onChange={(event) => onSummaryChange(event.target.value)}
          placeholder="Summarise the contact, what was agreed, and anything that needs escalation."
        />
      </div>

      <div className="space-y-2">
        <Label>Next step</Label>
        <Textarea
          rows={3}
          value={nextStep}
          onChange={(event) => onNextStepChange(event.target.value)}
          placeholder="Record the follow-up action, owner, and deadline."
        />
      </div>

      {!canSave && (
        <p className="text-xs text-destructive">
          This student is missing a database ID, so evidence entries cannot be saved yet.
        </p>
      )}

      <Button className="w-full" onClick={onSubmit} disabled={!canSave || !summary.trim() || !contactTargetName.trim()}>
        Log contact evidence
      </Button>
    </CardContent>
  </Card>
);

export const StudentInterventionEvidenceTrailCard = ({
  interventions,
  events,
}: {
  interventions: InterventionEntry[];
  events: InterventionEventEntry[];
}) => {
  const interventionTitleById = new Map(
    interventions.map((intervention) => [intervention.id, intervention.title || intervention.type]),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Intervention evidence trail</CardTitle>
        </div>
        <CardDescription>Each contact attempt, follow-up, and outcome recorded against the intervention</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No contact evidence logged yet.
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{formatInterventionContactTargetType(event.contactTargetType)}</Badge>
                <Badge variant="secondary">{formatInterventionContactMethod(event.contactMethod)}</Badge>
                <Badge variant={event.outcome === "resolved" ? "default" : "outline"}>
                  {formatInterventionOutcome(event.outcome)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {safeFormatDate(event.contactedAt, "MMM d, yyyy HH:mm")}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium">
                {event.contactTargetName}
                <span className="text-muted-foreground">
                  {" "}
                  on {interventionTitleById.get(event.interventionId) || "intervention"}
                </span>
              </p>
              <p className="mt-2 text-sm">{event.summary}</p>
              {event.nextStep && <p className="mt-2 text-xs text-muted-foreground">Next step: {event.nextStep}</p>}
              <p className="mt-3 text-xs text-muted-foreground">Recorded by the lecturer account</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
