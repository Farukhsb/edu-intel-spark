import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { ComponentProps, ReactNode } from "react";
import { ArrowRight, CheckCircle2, FileSpreadsheet, Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getHybridGradeImportTemplateHref, isHybridGradeImportEnabled } from "@/lib/hybridImport";
import { safeFormatDate } from "@/lib/date";

type AssignmentOption = {
  id: string;
  title: string;
  module_code: string | null;
  max_score: number;
  due_date: string | null;
  status: string;
};

type GradeImportIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

type GradeImportPreviewRow = {
  rowNumber: number;
  studentName: string;
  studentEmail: string | null;
  score: number;
  maxScore: number;
  submissionDate: string | null;
  notes: string | null;
  rubricBreakdown: Array<Record<string, unknown>>;
  normalizedScore: number;
  matchedSubmissionId: string | null;
  submissionAction: "match" | "create";
  accepted: boolean;
  issues: GradeImportIssue[];
};

type GradeImportPreviewSummary = {
  rowsProcessed: number;
  rowsAccepted: number;
  rowsRejected: number;
  matchedExistingSubmissions: number;
  createdSyntheticSubmissions: number;
  rowsWithWarnings: number;
};

type GradeImportResponse = {
  success: boolean;
  committed: boolean;
  assignmentId: string;
  importMethod: "csv" | "image";
  summary: GradeImportPreviewSummary;
  rows: GradeImportPreviewRow[];
  rejectedRows: Array<{
    rowNumber: number;
    studentName: string;
    studentEmail: string | null;
    issues: GradeImportIssue[];
  }>;
  importId?: string;
};

type DraftState = {
  csvText: string;
  csvFileName: string;
  imageFiles: File[];
};

const importModeLabels: Record<"csv" | "image", { title: string; subtitle: string; icon: ReactNode }> = {
  csv: {
    title: "CSV upload",
    subtitle: "Primary path for reliable bulk imports.",
    icon: <FileSpreadsheet className="h-4 w-4" />,
  },
  image: {
    title: "Photo / image",
    subtitle: "Secondary path for screenshots or paper marks.",
    icon: <ImageIcon className="h-4 w-4" />,
  },
};

const formatDueLabel = (value: string | null) => {
  if (!value) return "No due date";
  return safeFormatDate(value, "PPP") ?? value;
};

export const HybridGradeImportDialog = ({
  assignments,
  triggerLabel = "Import Grades",
  triggerVariant = "outline",
  triggerSize = "default",
  triggerClassName,
  defaultMode = "csv",
}: {
  assignments: AssignmentOption[];
  triggerLabel?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
  triggerClassName?: string;
  defaultMode?: "csv" | "image";
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"csv" | "image">(defaultMode);
  const [assignmentId, setAssignmentId] = useState("");
  const [draft, setDraft] = useState<DraftState>({ csvText: "", csvFileName: "", imageFiles: [] });
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
    if (!assignmentId && assignments.length > 0) {
      setAssignmentId(assignments[0].id);
    }
  }, [assignmentId, assignments, open]);

  useEffect(() => {
    if (!open) {
      setMode(defaultMode);
      setAssignmentId(assignments[0]?.id ?? "");
      setDraft({ csvText: "", csvFileName: "", imageFiles: [] });
      setPreview(null);
      setCommitted(null);
      setErrorMessage(null);
    }
  }, [assignments, defaultMode, open]);

  if (!isHybridGradeImportEnabled()) {
    return null;
  }

  const activeFiles = mode === "csv" ? [] : draft.imageFiles;
  const canPreview = Boolean(selectedAssignment) && (mode === "csv" ? draft.csvText.trim().length > 0 : activeFiles.length > 0);
  const hasAcceptedRows = Boolean(preview?.rows.some((row) => row.accepted));
  const confirmLabel = preview
    ? `Import ${preview.summary.rowsAccepted} grade${preview.summary.rowsAccepted === 1 ? "" : "s"}`
    : "Import grades";

  const buildBody = (confirm: boolean) => {
    if (!selectedAssignment) {
      throw new Error("Select an assignment before importing.");
    }

    if (mode === "csv") {
      if (!draft.csvText.trim()) {
        throw new Error("Paste or upload CSV content first.");
      }

      return {
        assignmentId: selectedAssignment.id,
        confirm,
        importMethod: "csv" as const,
        createMissingSubmissions: true,
        csvText: draft.csvText.trim(),
        sourceFileName: draft.csvFileName || "grades.csv",
      };
    }

    if (draft.imageFiles.length === 0) {
      throw new Error("Upload one or more images first.");
    }

    const formData = new FormData();
    formData.append("assignmentId", selectedAssignment.id);
    formData.append("confirm", String(confirm));
    formData.append("importMethod", "image");
    formData.append("createMissingSubmissions", "true");
    for (const file of draft.imageFiles) {
      formData.append("file", file, file.name);
    }
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
    if (!selectedAssignment) {
      toast.error("Choose an assignment first.");
      return;
    }

    if (!canPreview) {
      toast.error(mode === "csv" ? "Add CSV content first." : "Upload image files first.");
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

  const renderPreview = () => {
    if (!preview) {
      return (
        <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
          {mode === "csv"
            ? "Upload or paste a CSV, then preview the import."
            : "Upload image files, then preview the extracted rows."}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{preview.summary.rowsProcessed} rows scanned</Badge>
          <Badge variant="outline" className="border-success/30 bg-success/5 text-success">
            {preview.summary.rowsAccepted} accepted
          </Badge>
          <Badge variant="outline" className="border-warning/30 bg-warning/5 text-warning">
            {preview.summary.rowsWithWarnings} with warnings
          </Badge>
          <Badge variant="outline" className="border-destructive/30 bg-destructive/5 text-destructive">
            {preview.summary.rowsRejected} rejected
          </Badge>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((row) => (
                <TableRow key={row.rowNumber}>
                  <TableCell className="align-top font-medium">{row.rowNumber}</TableCell>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <p className="font-medium">{row.studentName || "Unnamed student"}</p>
                      <p className="text-xs text-muted-foreground">{row.studentEmail || "No email"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <p className="font-medium">{row.normalizedScore.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {Number.isFinite(row.score)
                          ? `${row.score}/${row.maxScore}`
                          : row.rubricBreakdown.length > 0
                            ? "Weighted from rubric columns"
                            : "No raw score provided"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant={row.accepted ? "outline" : "destructive"}>
                      {row.accepted ? "Accepted" : "Needs review"}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    {row.issues.length > 0 ? (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {row.issues.map((issue) => (
                          <li
                            key={issue.code}
                            className={cn(issue.severity === "error" ? "text-destructive" : "text-warning")}
                          >
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-muted-foreground">No issues</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={triggerClassName}>
          <Upload className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import Grades</DialogTitle>
          <DialogDescription>
            Upload grades from a CSV or photo so dashboards, risk insights, and interventions update immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 1</p>
                    <p className="text-sm font-semibold">Choose target assignment and import source</p>
                  </div>
                  <Badge variant="outline">{preview ? "Preview ready" : "Draft"}</Badge>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hybrid-grade-import-assignment">Assignment</Label>
                  <Select value={assignmentId} onValueChange={setAssignmentId}>
                    <SelectTrigger id="hybrid-grade-import-assignment">
                      <SelectValue placeholder="Select an assignment" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignments.map((assignment) => (
                        <SelectItem key={assignment.id} value={assignment.id}>
                          {assignment.title}
                          {assignment.module_code ? ` (${assignment.module_code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAssignment ? (
                    <p className="text-xs text-muted-foreground">
                      Max score {selectedAssignment.max_score}. {formatDueLabel(selectedAssignment.due_date)}.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No assignments available for this account.</p>
                  )}
                </div>
              </div>

              <Tabs value={mode} onValueChange={(value) => setMode(value as "csv" | "image")} className="space-y-3">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="csv" className="gap-2">
                    {importModeLabels.csv.icon}
                    CSV
                  </TabsTrigger>
                  <TabsTrigger value="image" className="gap-2">
                    {importModeLabels.image.icon}
                    Photo
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="csv" className="space-y-3">
                  <div className="rounded-xl border bg-background/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{importModeLabels.csv.title}</p>
                        <p className="text-xs text-muted-foreground">{importModeLabels.csv.subtitle}</p>
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <a href={getHybridGradeImportTemplateHref()} download>
                          Download template
                        </a>
                      </Button>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="hybrid-grade-import-csv-file">Upload CSV file</Label>
                        <Input
                          id="hybrid-grade-import-csv-file"
                          accept=".csv,text/csv"
                          type="file"
                          onChange={handleCsvFileChange}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hybrid-grade-import-csv-text">CSV content</Label>
                        <Textarea
                          id="hybrid-grade-import-csv-text"
                          value={draft.csvText}
                          onChange={(event) => setDraft((current) => ({ ...current, csvText: event.target.value }))}
                          placeholder="student_name,student_email,score,max_score,submission_date,notes,rubric_analysis_score,rubric_analysis_weight"
                          className="min-h-[180px]"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="image" className="space-y-3">
                  <div className="rounded-xl border bg-background/80 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{importModeLabels.image.title}</p>
                      <p className="text-xs text-muted-foreground">{importModeLabels.image.subtitle}</p>
                    </div>

                    <label
                      htmlFor="hybrid-grade-import-image-file"
                      className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                      <div className="mt-3 space-y-1">
                        <p className="text-sm font-medium">Drop images here or tap to browse</p>
                        <p className="text-xs text-muted-foreground">
                          Best effort OCR only. Always review the preview before confirming.
                        </p>
                      </div>
                    </label>
                    <Input
                      id="hybrid-grade-import-image-file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      type="file"
                      className="sr-only"
                      onChange={handleImageFileChange}
                    />

                    {draft.imageFiles.length > 0 ? (
                      <div className="mt-4 rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">Selected files</p>
                        <ul className="mt-2 space-y-1">
                          {draft.imageFiles.map((file) => (
                            <li key={`${file.name}-${file.size}`}>{file.name}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="rounded-xl border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                CSV is the primary path. Images are a convenience path with best-effort extraction and mandatory review.
                Rubric columns are supported for weighted imports when you need criterion-level scores.
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/80">
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 2</p>
                <p className="text-sm font-semibold">Preview and confirm</p>
              </div>

              <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Preview required</Badge>
                  <Badge variant="outline">No auto-commit</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  The system will show matched rows, synthetic rows, and issues before anything is written.
                </p>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Template</p>
                    <p className="text-xs text-muted-foreground">Download a starter CSV to keep the import format consistent.</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={getHybridGradeImportTemplateHref()} download>
                      Download
                    </a>
                  </Button>
                </div>
              </div>

              {errorMessage ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              ) : null}

              {selectedAssignment ? (
                <div className="rounded-xl border bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Target</p>
                  <p className="mt-1 text-sm font-semibold">{selectedAssignment.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedAssignment.module_code ? `${selectedAssignment.module_code} · ` : ""}
                    Max score {selectedAssignment.max_score} · {selectedAssignment.status}
                  </p>
                </div>
              ) : null}

              {preview ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{preview.summary.rowsProcessed} rows scanned</Badge>
                    <Badge variant="outline" className="border-success/30 bg-success/5 text-success">
                      {preview.summary.rowsAccepted} accepted
                    </Badge>
                    <Badge variant="outline" className="border-warning/30 bg-warning/5 text-warning">
                      {preview.summary.rowsWithWarnings} with warnings
                    </Badge>
                    <Badge variant="outline" className="border-destructive/30 bg-destructive/5 text-destructive">
                      {preview.summary.rowsRejected} rejected
                    </Badge>
                  </div>

                  <div className="overflow-hidden rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Issues</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.rows.map((row) => (
                          <TableRow key={row.rowNumber}>
                            <TableCell className="align-top font-medium">{row.rowNumber}</TableCell>
                            <TableCell className="align-top">
                              <div className="space-y-1">
                                <p className="font-medium">{row.studentName || "Unnamed student"}</p>
                                <p className="text-xs text-muted-foreground">{row.studentEmail || "No email"}</p>
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="space-y-1">
                                <p className="font-medium">{row.normalizedScore.toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {row.score}/{row.maxScore}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant={row.accepted ? "outline" : "destructive"}>
                                {row.accepted ? "Accepted" : "Needs review"}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top">
                              {row.issues.length > 0 ? (
                                <ul className="space-y-1 text-xs text-muted-foreground">
                                  {row.issues.map((issue) => (
                                    <li
                                      key={issue.code}
                                      className={cn(issue.severity === "error" ? "text-destructive" : "text-warning")}
                                    >
                                      {issue.message}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-xs text-muted-foreground">No issues</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
                  {mode === "csv"
                    ? "Paste or upload CSV content, then preview the import."
                    : "Upload one or more images, then preview the extracted rows."}
                </div>
              )}

              {committed ? (
                <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    <p className="text-sm font-medium">Import completed</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {committed.summary.rowsAccepted} rows imported and {committed.summary.createdSyntheticSubmissions} synthetic submissions created.
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handlePreview}
                  disabled={loadingPreview || loadingCommit || !canPreview}
                  className="min-w-[140px]"
                >
                  {loadingPreview ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Previewing
                    </>
                  ) : (
                    <>
                      Preview import
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCommit}
                  disabled={loadingPreview || loadingCommit || !preview || !hasAcceptedRows}
                  className="min-w-[140px]"
                >
                  {loadingCommit ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing
                    </>
                  ) : (
                    <>
                      {confirmLabel}
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {selectedAssignment ? `Importing into ${selectedAssignment.title}.` : "Select an assignment to start."}
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
