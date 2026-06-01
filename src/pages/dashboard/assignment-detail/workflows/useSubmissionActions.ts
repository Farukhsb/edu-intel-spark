import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { buildSubmissionReceivedNotification } from "@/lib/communications";
import { log } from "@/lib/logger";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailSubmission,
} from "@/pages/dashboard/assignment-detail/types";
import {
  getSubmissionUploadFailureReason,
  loadTargetedStudentProfiles,
  normalizeStudentKey,
  persistWorkflowNotification,
  uploadSubmissionFile,
} from "@/pages/dashboard/assignment-detail/workflows/submissionActions";

interface SubmissionActionUser {
  id: string;
  email?: string | null;
}

interface SubmissionActionProfile {
  full_name?: string | null;
}

interface UseSubmissionActionsArgs {
  assignment: AssignmentDetailAssignment | null;
  assignmentId: string | null;
  user: SubmissionActionUser | null;
  profile: SubmissionActionProfile | null;
  submissions: AssignmentDetailSubmission[]; 
  reloadSubmissions: () => Promise<void>;
}

export const useSubmissionActions = ({
  assignment,
  assignmentId,
  user,
  profile,
  submissions,
  reloadSubmissions,
}: UseSubmissionActionsArgs) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const handleStudentSubmit = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !assignmentId || !assignment || !user?.id) {
      e.target.value = "";
      return;
    }

    const hasExisting = submissions.some(
      (submission) => submission.student_id === user.id || (user.email && submission.student_email === user.email),
    );
    if (hasExisting) {
      toast.error("You have already submitted this assignment");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadSubmissionFile(file, user.id, assignment.id, setUploadProgress);
      const { error } = await supabase
        .from("submissions")
        .insert({
          assignment_id: assignment.id,
          student_id: user.id,
          file_url: uploaded.fileUrl,
          file_name: uploaded.fileName,
          file_type: uploaded.fileType,
          uploaded_by: user.id,
          status: "submitted" as const,
          student_name: profile?.full_name ?? null,
          student_email: user.email ?? null,
        });
      if (error) throw error;
      await persistWorkflowNotification(
        buildSubmissionReceivedNotification({
          lecturerId: assignment.lecturer_id,
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          studentName: profile?.full_name || user.email || "A student",
        }),
        {
          assignmentId: assignment.id,
          workflow: "submission",
        },
      );
      toast.success("Submission uploaded successfully");
      await reloadSubmissions();
    } catch (error: unknown) {
      const reason = getSubmissionUploadFailureReason(error);
      log.error("Student submission upload failed", error, {
        assignmentId: assignment.id,
        studentId: user.id,
      });
      toast.error(reason ? `Upload failed: ${reason}` : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const handleBulkUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !assignment || !user?.id) return;
    setUploading(true);
    let success = 0;
    let linked = 0;
    let unmatched = 0;

    try {
      const studentProfiles = await loadTargetedStudentProfiles(assignment.id);
      const profileMatches = new Map(
        studentProfiles.flatMap((studentProfile) => {
          const keys = new Set<string>();
          const normalizedEmail = normalizeStudentKey(studentProfile.email);
          const normalizedName = normalizeStudentKey(studentProfile.full_name);
          if (normalizedEmail) {
            keys.add(normalizedEmail);
            keys.add(normalizedEmail.split("@")[0]);
          }
          if (normalizedName) keys.add(normalizedName);
          return Array.from(keys).map((key) => [key, studentProfile] as const);
        }),
      );

      for (const file of Array.from(files)) {
        try {
          const { fileUrl, fileName, fileType } = await uploadSubmissionFile(
            file,
            user.id,
            assignment.id,
            setUploadProgress,
          );
          const studentName = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
          const matchedProfile = profileMatches.get(normalizeStudentKey(file.name)) ||
            profileMatches.get(normalizeStudentKey(studentName));
          const { error } = await supabase.from("submissions").insert({
            assignment_id: assignment.id,
            student_name: matchedProfile?.full_name ?? studentName,
            file_url: fileUrl,
            file_name: fileName,
            file_type: fileType,
            uploaded_by: user.id,
            status: "submitted" as const,
            student_id: matchedProfile?.id ?? null,
            student_email: matchedProfile?.email ?? null,
          });
          if (error) throw error;
          success++;
          if (matchedProfile?.id) {
            linked++;
          } else {
            unmatched++;
          }
        } catch (error: unknown) {
          const reason = getSubmissionUploadFailureReason(error);
          log.error("Bulk upload failed for file", error, {
            assignmentId: assignment.id,
            fileName: file.name,
          });
          toast.error(reason ? `Failed to upload ${file.name}: ${reason}` : `Failed to upload ${file.name}`);
        }
      }
    } catch (error) {
      log.error("Bulk upload failed to load targeted student profiles", error, {
        assignmentId: assignment.id,
      });
      toast.error("Could not load targeted student profiles for bulk upload");
      setUploading(false);
      e.target.value = "";
      return;
    }

    if (success > 0) {
      toast.success(`${success} file(s) uploaded`);
      if (linked > 0 || unmatched > 0) {
        toast.info(`${linked} linked to student accounts, ${unmatched} left unlinked`);
      }
    }
    setUploading(false);
    await reloadSubmissions();
    e.target.value = "";
  };

  return {
    bulkInputRef,
    fileInputRef,
    handleBulkUpload,
    handleStudentSubmit,
    uploading,
    uploadProgress,
  };
};
