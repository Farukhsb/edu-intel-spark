import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logAcademicAccessEvent } from "@/lib/audit/academicAccessEvents";
import { log } from "@/lib/logger";
import type { AssignmentDetailSubmission } from "@/pages/dashboard/assignment-detail/types";

type SubmissionFileAccessOptions = {
  source?: string;
  resourceType?: string;
  moderationCaseId?: string | null;
};

interface UseSubmissionFileActionsResult {
  openSubmissionFile: (submission: AssignmentDetailSubmission, options?: SubmissionFileAccessOptions) => Promise<void>;
}

export const useSubmissionFileActions = (): UseSubmissionFileActionsResult => {
  const { user, profile } = useAuth();

  const openSubmissionFile = async (submission: AssignmentDetailSubmission, options?: SubmissionFileAccessOptions) => {
    try {
      const rawUrl = submission.file_url || "";
      const isDirectUrl = /^https?:\/\//i.test(rawUrl);
      if (isDirectUrl) {
        window.open(rawUrl, "_blank", "noopener,noreferrer");
        void logAcademicAccessEvent({
          actorId: user?.id,
          actorRole: profile?.role ?? null,
          institutionId: profile?.institution_id ?? null,
          eventType: "submission_file_opened",
          resourceType: options?.resourceType || "submission_file",
          resourceId: submission.id,
          assignmentId: submission.assignment_id,
          submissionId: submission.id,
          moderationCaseId: options?.moderationCaseId ?? null,
          metadata: {
            source: options?.source || "submission_file_action",
            fileName: submission.file_name,
            fileType: submission.file_type,
          },
        });
        return;
      }

      const { data, error } = await supabase.storage
        .from("submissions")
        .createSignedUrl(rawUrl, 60);

      if (error || !data?.signedUrl) {
        throw error ?? new Error("Could not create signed URL");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      void logAcademicAccessEvent({
        actorId: user?.id,
        actorRole: profile?.role ?? null,
        institutionId: profile?.institution_id ?? null,
        eventType: "submission_file_opened",
        resourceType: options?.resourceType || "submission_file",
        resourceId: submission.id,
        assignmentId: submission.assignment_id,
        submissionId: submission.id,
        moderationCaseId: options?.moderationCaseId ?? null,
        metadata: {
          source: options?.source || "submission_file_action",
          fileName: submission.file_name,
          fileType: submission.file_type,
        },
      });
    } catch (error) {
      log.error("Failed to open submission file", error, {
        submissionId: submission.id,
      });
      toast.error("Could not open the file");
    }
  };

  return {
    openSubmissionFile,
  };
};
