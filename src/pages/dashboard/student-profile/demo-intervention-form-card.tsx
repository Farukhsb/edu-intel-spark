import { BookOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ManualInterventionStatus, ManualInterventionType } from "@/lib/interventions";

export const DemoStudentInterventionFormCard = ({
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
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        Demo entries are local to this page and do not touch the live database.
      </div>

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
