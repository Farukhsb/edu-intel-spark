import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import type {
  AssignmentOption,
  DraftState,
  GradeImportResponse,
  ImportScope,
  NewAssignmentDraft,
} from "./types";

export type HybridGradeImportDialogController = ReturnType<typeof useHybridGradeImportDialog>;

export function useHybridGradeImportDialog(
  assignments: AssignmentOption[],
  defaultMode: "csv" | "image",
) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"csv" | "image">(defaultMode);
  const [importScope, setImportScope] = useState<ImportScope>(
    assignments.length > 0 ? "existing_assignment" : "new_assignment",
  );
  const [assignmentId, setAssignmentId] = useState("");
  const [draft, setDraft] = useState<DraftState>({ csvText: "", csvFileName: "", imageFiles: [] });
  const [newAssignment, setNewAssignment] = useState<NewAssignmentDraft>({
    title: `Imported grades - ${new Date().toISOString().slice(0, 10)}`,
    moduleCode: "",
    maxScore: "100",
    dueDate: "",
    description: "",
  });
  const [preview, setPreview] = useState<GradeImportResponse | null>(null);
  const [committed, setCommitted] = useState<GradeImportResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === assignmentId) ?? assignments[0] ?? null,
    [assignmentId, assignments],
  );

  useEffect(() => {
    if (!open) return;
    if (importScope === "existing_assignment" && !assignmentId && assignments.length > 0) {
      setAssignmentId(assignments[0].id);
    }
  }, [assignmentId, assignments, importScope, open]);

  useEffect(() => {
    if (!open) {
      setMode(defaultMode);
      setImportScope(assignments.length > 0 ? "existing_assignment" : "new_assignment");
      setAssignmentId(assignments[0]?.id ?? "");
      setDraft({ csvText: "", csvFileName: "", imageFiles: [] });
      setNewAssignment({
        title: `Imported grades - ${new Date().toISOString().slice(0, 10)}`,
        moduleCode: "",
        maxScore: "100",
        dueDate: "",
        description: "",
      });
      setPreview(null);
      setCommitted(null);
      setErrorMessage(null);
    }
  }, [assignments, defaultMode, open]);

  const activeFiles = mode === "csv" ? [] : draft.imageFiles;
  const usingExistingAssignment = importScope === "existing_assignment";
  const selectedNewAssignmentMaxScore = Number(newAssignment.maxScore) || 100;
  const canPreview = usingExistingAssignment
    ? Boolean(selectedAssignment) && (mode === "csv" ? draft.csvText.trim().length > 0 : activeFiles.length > 0)
    : Boolean(newAssignment.title.trim()) &&
      Boolean(newAssignment.moduleCode.trim()) &&
      Number.isFinite(selectedNewAssignmentMaxScore) &&
      selectedNewAssignmentMaxScore > 0 &&
      (mode === "csv" ? draft.csvText.trim().length > 0 : activeFiles.length > 0);
  const hasAcceptedRows = Boolean(preview?.rows.some((row) => row.accepted));
  const confirmLabel = preview
    ? `Import ${preview.summary.rowsAccepted} grade${preview.summary.rowsAccepted === 1 ? "" : "s"}`
    : "Import grades";

  const buildBody = (confirm: boolean) => {
    if (mode === "csv") {
      if (!draft.csvText.trim()) {
        throw new Error("Paste or upload CSV content first.");
      }
      const baseBody: Record<string, unknown> = {
        confirm,
        importMethod: "csv" as const,
        createMissingSubmissions: true,
        csvText: draft.csvText.trim(),
        sourceFileName: draft.csvFileName || "grades.csv",
        importScope,
      };

      if (usingExistingAssignment) {
        if (!selectedAssignment) {
          throw new Error("Select an assignment before importing.");
        }
        return {
          ...baseBody,
          assignmentId: selectedAssignment.id,
        };
      }

      return {
        ...baseBody,
        newAssignmentTitle: newAssignment.title.trim(),
        newAssignmentModuleCode: newAssignment.moduleCode.trim(),
        newAssignmentMaxScore: selectedNewAssignmentMaxScore,
        newAssignmentDueDate: newAssignment.dueDate || null,
        newAssignmentDescription: newAssignment.description.trim() || null,
      };
    }

    if (draft.imageFiles.length === 0) {
      throw new Error("Upload one or more images first.");
    }

    const formData = new FormData();
    formData.set("confirm", String(confirm));
    formData.set("importMethod", "image");
    formData.set("createMissingSubmissions", "true");
    formData.set("importScope", importScope);

    if (usingExistingAssignment) {
      if (!selectedAssignment) {
        throw new Error("Select an assignment before importing.");
      }
      formData.set("assignmentId", selectedAssignment.id);
    } else {
      formData.set("newAssignmentTitle", newAssignment.title.trim());
      formData.set("newAssignmentModuleCode", newAssignment.moduleCode.trim());
      formData.set("newAssignmentMaxScore", String(selectedNewAssignmentMaxScore));
      if (newAssignment.dueDate) {
        formData.set("newAssignmentDueDate", newAssignment.dueDate);
      }
      if (newAssignment.description.trim()) {
        formData.set("newAssignmentDescription", newAssignment.description.trim());
      }
    }

    draft.imageFiles.forEach((file) => {
      formData.append("file", file, file.name);
    });

    return formData;
  };

  const invokeImport = async (confirm: boolean) => {
    const { data, error } = await supabase.functions.invoke("import-grades", {
      body: buildBody(confirm),
    });

    if (error) {
      throw error;
    }
    return data as GradeImportResponse;
  };

  const readFileText = async (file: File) => file.text();

  const handleCsvFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setDraft({
      csvText: await readFileText(file),
      csvFileName: file.name,
      imageFiles: [],
    });
    setMode("csv");
    setPreview(null);
    setCommitted(null);
    setErrorMessage(null);
    event.target.value = "";
  };

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setDraft({
      csvText: "",
      csvFileName: "",
      imageFiles: files,
    });
    setMode("image");
    setPreview(null);
    setCommitted(null);
    setErrorMessage(null);
    event.target.value = "";
  };

  const handlePreview = async () => {
    if (usingExistingAssignment && !selectedAssignment) {
      toast.error("Choose an assignment first.");
      return;
    }

    if (!canPreview) {
      if (usingExistingAssignment) {
        toast.error(mode === "csv" ? "Add CSV content first." : "Upload image files first.");
      } else {
        toast.error("Fill in the new assignment details and add the CSV or image first.");
      }
      return;
    }

    setLoadingPreview(true);
    setErrorMessage(null);
    try {
      const data = await invokeImport(false);
      if (!data || typeof data !== "object" || !Array.isArray((data as GradeImportResponse).rows)) {
        throw new Error("Import preview returned an unexpected response.");
      }

      setPreview(data as GradeImportResponse);
      setCommitted(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import preview failed";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) {
      toast.error("Preview the import before confirming it.");
      return;
    }

    if (!hasAcceptedRows) {
      toast.error("There are no valid rows to import.");
      return;
    }

    setLoadingCommit(true);
    setErrorMessage(null);
    try {
      const data = await invokeImport(true);
      if (!data || typeof data !== "object" || (data as GradeImportResponse).committed !== true) {
        throw new Error("Import confirmation returned an unexpected response.");
      }

      setCommitted(data as GradeImportResponse);
      setPreview(data as GradeImportResponse);
      toast.success("Grade import completed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Grade import failed";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingCommit(false);
    }
  };

  return {
    open,
    setOpen,
    mode,
    setMode,
    importScope,
    setImportScope,
    assignmentId,
    setAssignmentId,
    draft,
    setDraft,
    newAssignment,
    setNewAssignment,
    selectedAssignment,
    preview,
    setPreview,
    committed,
    setCommitted,
    loadingPreview,
    loadingCommit,
    errorMessage,
    setErrorMessage,
    canPreview,
    hasAcceptedRows,
    confirmLabel,
    usingExistingAssignment,
    selectedNewAssignmentMaxScore,
    handleCsvFileChange,
    handleImageFileChange,
    handlePreview,
    handleCommit,
  };
}
