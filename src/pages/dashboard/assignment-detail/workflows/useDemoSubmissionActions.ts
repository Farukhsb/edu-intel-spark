import { useRef, type ChangeEvent } from "react";
import { toast } from "sonner";

import type { useSubmissionActions } from "./useSubmissionActions";

type SubmissionActions = ReturnType<typeof useSubmissionActions>;

interface UseDemoSubmissionActionsArgs {
  assignmentId: string | null;
}

export const useDemoSubmissionActions = (_args: UseDemoSubmissionActionsArgs): SubmissionActions => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const blockDemoAction = (message: string) => (e?: ChangeEvent<HTMLInputElement>) => {
    if (e) {
      e.target.value = "";
    }
    toast.info(message);
  };

  const handleStudentSubmit = async (e: ChangeEvent<HTMLInputElement>) => {
    blockDemoAction("Submission upload is disabled in demo mode")(e);
  };

  const handleBulkUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    blockDemoAction("Bulk upload is disabled in demo mode")(e);
  };

  return {
    bulkInputRef,
    fileInputRef,
    handleBulkUpload,
    handleStudentSubmit,
    uploading: false,
    uploadProgress: 0,
  } satisfies SubmissionActions;
};
