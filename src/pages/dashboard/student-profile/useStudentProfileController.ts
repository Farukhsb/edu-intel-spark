import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logAcademicAccessEvent } from "@/lib/audit/academicAccessEvents";
import { fetchLecturerStudentProfileDataset } from "@/lib/data/student";
import { safeFormatDate } from "@/lib/date";
import { dispatchCommunicationMessage } from "@/lib/communications";
import { log } from "@/lib/logger";
import { toast } from "sonner";
import {
  buildManualInterventionPayload,
  buildStudentInterventionEventPayload,
  fetchStudentInterventions,
  fetchStudentInterventionEvents,
  getInterventionErrorText,
  getStudentInterventionReadiness,
  isInterventionOverdue,
  insertManualIntervention,
  insertStudentInterventionEvent,
  normalizeManualInterventionStatus,
  normalizeManualInterventionType,
  type InterventionContactMethod,
  type InterventionContactTargetType,
  type InterventionEventEntry,
  type InterventionOutcome,
  type InterventionEntry,
  type ManualInterventionStatus,
  type ManualInterventionType,
  updateStudentInterventionStatus,
} from "@/lib/interventions";
import { buildStudentInsightData, matchStudentSubmissions, type StudentInsightData } from "@/lib/studentProfile";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string | null | undefined): value is string => typeof value === "string" && UUID_PATTERN.test(value);

const resolveLinkedProfileByStudentId = async (studentId: string) => {
  if (!isUuid(studentId)) return null;

  const { data, error } = await supabase.from("profiles").select("id, email").eq("id", studentId).maybeSingle();

  if (error) {
    log.error("Failed to resolve linked student profile", error, {
      studentId,
    });
    return null;
  }

  return data;
};

const normalizeResolvedProfile = (profile: { id: string; email?: string | null } | null | undefined) =>
  profile
    ? {
        id: profile.id,
        email: profile.email ?? null,
      }
    : null;

const toDateTimeLocalValue = (value: Date = new Date()) => {
  const pad = (input: number) => String(input).padStart(2, "0");
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hours = pad(value.getHours());
  const minutes = pad(value.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

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

export const useStudentProfileController = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const decodedStudentId = decodeURIComponent(studentId || "");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [student, setStudent] = useState<StudentInsightData | null>(null);
  const [interventions, setInterventions] = useState<InterventionEntry[]>([]);
  const [interventionEvents, setInterventionEvents] = useState<InterventionEventEntry[]>([]);
  const [interventionType, setInterventionType] = useState<ManualInterventionType>("email");
  const [interventionStatus, setInterventionStatus] = useState<ManualInterventionStatus>("in_progress");
  const [interventionNote, setInterventionNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [evidenceInterventionId, setEvidenceInterventionId] = useState("");
  const [evidenceContactTargetType, setEvidenceContactTargetType] = useState<InterventionContactTargetType>("student");
  const [evidenceContactTargetName, setEvidenceContactTargetName] = useState("");
  const [evidenceContactMethod, setEvidenceContactMethod] = useState<InterventionContactMethod>("email");
  const [evidenceOutcome, setEvidenceOutcome] = useState<InterventionOutcome>("ongoing");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [evidenceNextStep, setEvidenceNextStep] = useState("");
  const [evidenceContactedAt, setEvidenceContactedAt] = useState(toDateTimeLocalValue());
  const lastLoggedProfileViewRef = useRef<string | null>(null);
  const resolvedStudentRecordId = student?.studentRecordId || (isUuid(student?.studentId) ? student.studentId : null);

  useEffect(() => {
    if (!user || !decodedStudentId) return;

    const loadStudent = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const { assignments, submissions: allSubmissions, grades } = await fetchLecturerStudentProfileDataset(user.id);
        if (assignments.length === 0) {
          setStudent(null);
          setLoading(false);
          return;
        }
        let resolvedStudentLookupId = decodedStudentId;
        let matchingSubmissions = matchStudentSubmissions({
          submissions: allSubmissions,
          studentId: resolvedStudentLookupId,
        });

        let linkedProfile = normalizeResolvedProfile(await resolveLinkedProfileByStudentId(decodedStudentId));

        if (matchingSubmissions.length === 0 && linkedProfile?.email) {
          resolvedStudentLookupId = linkedProfile.email;
          matchingSubmissions = matchStudentSubmissions({
            submissions: allSubmissions,
            studentId: resolvedStudentLookupId,
          });
        }

        if (matchingSubmissions.length === 0) {
          setStudent(null);
          setLoading(false);
          return;
        }

        const sortedSubmissions = [...matchingSubmissions].sort(
          (left, right) => new Date(left.submitted_at).getTime() - new Date(right.submitted_at).getTime(),
        );
        const matchedStudentEmail = sortedSubmissions.find((submission) => submission.student_email)?.student_email || null;
        let linkedStudentRecordId =
          sortedSubmissions.find((submission) => submission.student_id)?.student_id || linkedProfile?.id || null;

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
            linkedProfile = normalizeResolvedProfile(profileData ? { ...linkedProfile, ...profileData } : linkedProfile);
          }
        }

        setStudent(
          buildStudentInsightData({
            assignments,
            submissions: allSubmissions,
            grades,
            decodedStudentId: resolvedStudentLookupId,
            studentRecordId: linkedStudentRecordId,
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
  }, [decodedStudentId, reloadKey, user]);

  const riskBadgeVariant = useMemo(() => {
    if (!student) return "outline";
    if (student.riskLevel === "critical") return "destructive";
    if (student.riskLevel === "high") return "secondary";
    return "outline";
  }, [student]);

  const trendDirection: "up" | "down" | "steady" = useMemo(() => {
    if (!student || student.chart.length < 2) return "steady";
    const first = student.chart[0].grade;
    const last = student.chart[student.chart.length - 1].grade;
    if (last > first) return "up";
    if (last < first) return "down";
    return "steady";
  }, [student]);

  useEffect(() => {
    if (!user?.id || !resolvedStudentRecordId) return;

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
  }, [decodedStudentId, resolvedStudentRecordId, user?.id]);

  useEffect(() => {
    if (!user?.id || !resolvedStudentRecordId) return;

    const loadInterventionEvents = async () => {
      const { data, error } = await fetchStudentInterventionEvents(supabase, user.id, resolvedStudentRecordId);

      if (error) {
        log.error("Failed to load intervention events", error, {
          studentId: decodedStudentId,
        });
        toast.error(getInterventionErrorText(error) || "Could not load intervention evidence");
        return;
      }

      setInterventionEvents(data || []);
    };

    void loadInterventionEvents();
  }, [decodedStudentId, resolvedStudentRecordId, user?.id, reloadKey]);

  useEffect(() => {
    if (!user?.id || !resolvedStudentRecordId || !student) return;

    const logKey = `${resolvedStudentRecordId}:${student.name}`;
    if (lastLoggedProfileViewRef.current === logKey) return;

    lastLoggedProfileViewRef.current = logKey;
    void logAcademicAccessEvent({
      actorId: user.id,
      actorRole: "lecturer",
      institutionId: profile?.institution_id ?? null,
      eventType: "student_profile_viewed",
      resourceType: "student_profile",
      resourceId: resolvedStudentRecordId,
      metadata: {
        source: "student_profile_page",
        studentName: student.name,
        studentRiskLevel: student.riskLevel,
      },
    });
  }, [profile?.institution_id, resolvedStudentRecordId, student, user?.id]);

  useEffect(() => {
    if (!evidenceInterventionId && interventions[0]?.id) {
      setEvidenceInterventionId(interventions[0].id);
    }
  }, [evidenceInterventionId, interventions]);

  useEffect(() => {
    if (student?.name) {
      setEvidenceContactTargetName((current) => current || student.name);
    }
  }, [student?.name]);

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
    setEvidenceInterventionId(data?.id || "");
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
      body: `Dear ${student.name},\n\nAn academic support action has been logged for you.\n\nType:\n${safeInterventionType}\n\nSummary:\n${interventionNote.trim()}\n\nStatus:\n${safeInterventionStatus}\n\n${followUpDate ? `Follow-up date: ${safeFormatDate(followUpDate, "MMM d, yyyy")}` : "Please check your improvement plan and follow any next steps shared by your lecturer."}`,
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
      body: `Dear ${student.name},\n\nYour recent assessment pattern suggests it may be useful to arrange an academic support review.\n\nWhy you are being contacted:\n- ${student.reasons.join("\n- ")}\n\nRecommended next step:\n${student.recommendation}\n\nPlease reply to arrange a short meeting so we can agree the most useful support before the next submission.`,
      relatedStudentId: resolvedStudentRecordId,
    });
    const feedback = getSupportNotificationToastCopy("At-risk alert", result);
    toast[feedback.level](feedback.message);
  };

  const queueFollowUpReminder = async () => {
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
      body: `Dear ${student.name},\n\nThis is a follow-up on the support actions we discussed${latestIntervention ? ` on ${safeFormatDate(latestIntervention.createdAt, "MMM d, yyyy")}` : ""}.\n\nCurrent focus:\n${student.recommendation}\n\nPlease share a short update before ${latestIntervention?.followUpDate ? safeFormatDate(latestIntervention.followUpDate, "MMM d, yyyy") : "our next review"} so we can confirm what is working and what still needs attention.`,
      relatedStudentId: resolvedStudentRecordId,
    });
    const feedback = getSupportNotificationToastCopy("Follow-up reminder", result);
    toast[feedback.level](feedback.message);
  };

  const handleUpdateInterventionStatus = async (interventionId: string, nextStatus: ManualInterventionStatus) => {
    const { data, error } = await updateStudentInterventionStatus(supabase, interventionId, nextStatus);

    if (error) {
      toast.error(getInterventionErrorText(error) || "Could not update intervention status");
      return;
    }

    setInterventions((current) => current.map((entry) => (entry.id === interventionId && data ? data : entry)));
    toast.success(nextStatus === "resolved" ? "Intervention resolved" : "Intervention reopened");
  };

  const handleLogEvidence = async () => {
    if (!student || !user?.id) {
      toast.error("Student context is not ready yet");
      return;
    }

    if (!resolvedStudentRecordId) {
      toast.error("This student record is missing a database ID, so the evidence cannot be saved yet");
      return;
    }

    if (!evidenceInterventionId) {
      toast.error("Choose an intervention before logging evidence");
      return;
    }

    const payload = buildStudentInterventionEventPayload({
      lecturerId: user.id,
      studentId: resolvedStudentRecordId,
      interventionId: evidenceInterventionId,
      contactTargetType: evidenceContactTargetType,
      contactTargetName: evidenceContactTargetName,
      contactMethod: evidenceContactMethod,
      outcome: evidenceOutcome,
      summary: evidenceSummary,
      nextStep: evidenceNextStep || null,
      contactedAt: new Date(evidenceContactedAt).toISOString(),
    });

    const { data, error } = await insertStudentInterventionEvent(supabase, payload);

    if (error) {
      log.error("Failed to save intervention evidence", error, {
        studentId: decodedStudentId,
      });
      toast.error(getInterventionErrorText(error) || "Could not save intervention evidence");
      return;
    }

    setInterventionEvents((current) => (data ? [data, ...current] : current));
    setEvidenceContactTargetType("student");
    setEvidenceContactTargetName(student.name);
    setEvidenceContactMethod("email");
    setEvidenceOutcome("ongoing");
    setEvidenceSummary("");
    setEvidenceNextStep("");
    setEvidenceContactedAt(toDateTimeLocalValue());
    toast.success("Contact evidence logged");
  };

  const openInterventions = interventions.filter((entry) => entry.status === "planned" || entry.status === "in_progress").length;
  const overdueInterventions = interventions.filter((entry) => isInterventionOverdue(entry)).length;
  const interventionReadiness = student
    ? getStudentInterventionReadiness({
        riskLevel: student.riskLevel,
        recommendation: student.recommendation,
        missedAssignmentsCount: student.missedAssignments.length,
        openInterventions,
        overdueInterventions,
        latestIntervention: interventions[0] || null,
      })
    : null;

  return {
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
    reloadStudent: () => setReloadKey((current) => current + 1),
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
    setStudent,
    setInterventions,
    student,
    trendDirection,
    user,
  };
};
