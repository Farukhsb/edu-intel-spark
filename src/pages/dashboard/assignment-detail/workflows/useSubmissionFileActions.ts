import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { log } from "@/lib/logger";
import type { AssignmentDetailSubmission } from "@/pages/dashboard/assignment-detail/types";

interface UseSubmissionFileActionsResult {
  openSubmissionFile: (submission: AssignmentDetailSubmission) => Promise<void>;
}

export const useSubmissionFileActions = (): UseSubmissionFileActionsResult => {
  const openSubmissionFile = async (submission: AssignmentDetailSubmission) => {
    try {
      const rawUrl = submission.file_url || "";
      const isDirectUrl = /^https?:\/\//i.test(rawUrl);
      if (isDirectUrl) {
        window.open(rawUrl, "_blank", "noopener,noreferrer");
        return;
      }

      const { data, error } = await supabase.storage
        .from("submissions")
        .createSignedUrl(rawUrl, 60);

      if (error || !data?.signedUrl) {
        throw error ?? new Error("Could not create signed URL");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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
