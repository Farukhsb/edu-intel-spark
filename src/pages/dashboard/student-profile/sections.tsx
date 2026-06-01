import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Lightbulb,
  Mail,
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
  isInterventionOverdue,
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
