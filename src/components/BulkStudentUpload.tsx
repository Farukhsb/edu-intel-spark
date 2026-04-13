import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ParsedStudent {
  rowNumber: number;
  name: string;
  email: string;
  cohort_id: string;
  department_id: string;
  valid: boolean;
  error?: string;
}

interface UploadResult {
  name: string;
  email: string;
  password?: string;
  success: boolean;
  error?: string;
}

export const BulkStudentUpload = () => {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedStudent[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) { toast.error("Please upload a CSV file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10MB)"); return; }
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { toast.error("CSV must have a header row and at least one data row"); return; }

      const header = lines[0].toLowerCase().split(",").map(h => h.trim());
      const nameIdx = header.findIndex(h => h.includes("name"));
      const emailIdx = header.findIndex(h => h.includes("email"));
      const cohortIdx = header.findIndex(h => h.includes("cohort") || h.includes("level") || h.includes("year"));
      const deptIdx = header.findIndex(h => h.includes("department") || h.includes("dept"));

      if (emailIdx === -1) { toast.error("CSV must have an 'email' column"); return; }

      const seenEmails = new Set<string>();
      const students: ParsedStudent[] = lines.slice(1).map((line, index) => {
        const cols = line.split(",").map(c => c.trim());
        const email = cols[emailIdx] || "";
        const name = nameIdx >= 0 ? cols[nameIdx] : "";
        const cohort = cohortIdx >= 0 ? cols[cohortIdx] : "";
        const dept = deptIdx >= 0 ? cols[deptIdx] : "";

        const normalizedEmail = email.toLowerCase();
        const errors: string[] = [];
        if (!email || !email.includes("@")) errors.push("Invalid email");
        if (!name) errors.push("Missing name");
        if (normalizedEmail && seenEmails.has(normalizedEmail)) errors.push("Duplicate email in file");
        if (normalizedEmail) seenEmails.add(normalizedEmail);

        return {
          rowNumber: index + 2,
          name,
          email,
          cohort_id: cohort,
          department_id: dept,
          valid: errors.length === 0,
          error: errors.join(", "),
        };
      });

      setParsed(students);
      setStep("preview");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleUpload = async () => {
    const valid = parsed.filter(s => s.valid);
    if (valid.length === 0) { toast.error("No valid students to upload"); return; }
    setUploading(true);
    let uploadResults: UploadResult[] = [];

    try {
      const { data, error } = await supabase.functions.invoke("bulk-create-students", {
        body: {
          students: valid.map((student) => ({
            name: student.name,
            email: student.email,
            cohort_id: student.cohort_id,
            department_id: student.department_id,
          })),
        },
      });

      if (error) throw error;
      uploadResults = data?.results || [];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bulk upload failed";
      toast.error(message);
      setUploading(false);
      return;
    }

    setResults(uploadResults);
    setStep("done");
    setUploading(false);
    const successCount = uploadResults.filter(r => r.success).length;
    if (successCount > 0) toast.success(`${successCount} student(s) created`);
    if (uploadResults.some(r => !r.success)) toast.error(`${uploadResults.filter(r => !r.success).length} failed`);
  };

  const downloadCredentials = () => {
    const successful = results.filter(r => r.success);
    if (successful.length === 0) { toast.error("No successful accounts to export"); return; }
    const csv = "Name,Email,Temporary Password\n" + successful.map(r => `"${r.name}","${r.email}","${r.password}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `student_credentials_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const csv = "name,email,cohort,department\nJohn Doe,john@uni.ac.uk,200,Computer Science\nJane Smith,jane@uni.ac.uk,300,Mathematics";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFileName("");
    setParsed([]);
    setResults([]);
    setStep("upload");
  };

  const validCount = parsed.filter(s => s.valid).length;
  const invalidRows = parsed.filter(s => !s.valid);
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Upload className="mr-2 h-3.5 w-3.5" /> Bulk Upload Students</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Student Upload</DialogTitle>
          <DialogDescription>Create student accounts from a CSV, review issues, then export credentials once.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            { id: "upload", label: "1. Upload" },
            { id: "preview", label: "2. Review" },
            { id: "done", label: "3. Export" },
          ].map((item) => (
            <div
              key={item.id}
              className={`rounded-md border px-3 py-2 text-center ${
                step === item.id
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        {step === "upload" && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Before you upload</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>Use one row per student.</li>
                <li>Required columns: name, email.</li>
                <li>Optional columns: cohort, department.</li>
                <li>Duplicate emails in the same file will be blocked.</li>
              </ul>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Need a starter file?</p>
                <p className="text-xs text-muted-foreground">Download the template and fill in your student list.</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-3.5 w-3.5" /> Template
              </Button>
            </div>
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">CSV with columns: name, email, cohort, department</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              <Button onClick={() => fileRef.current?.click()}>Select CSV File</Button>
              <p className="text-xs text-muted-foreground">Max file size: 10MB</p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{fileName || "CSV preview"}</p>
                  <p className="text-xs text-muted-foreground">Review the import summary before creating accounts.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>Choose Another File</Button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Rows</p>
                  <p className="text-lg font-semibold">{parsed.length}</p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Ready</p>
                  <p className="text-lg font-semibold text-success">{validCount}</p>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Blocked</p>
                  <p className="text-lg font-semibold text-destructive">{invalidRows.length}</p>
                </div>
              </div>
            </div>

            {invalidRows.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">Fix these rows before re-uploading</p>
                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {invalidRows.map((student) => (
                    <p key={`${student.rowNumber}-${student.email}`}>
                      Row {student.rowNumber}: {student.error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border p-2">
              {parsed.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-muted/50">
                  <div className="flex items-center gap-2">
                    {s.valid ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    <span className="text-xs text-muted-foreground">#{s.rowNumber}</span>
                    <span>{s.name || "-"}</span>
                    <span className="text-muted-foreground">{s.email}</span>
                  </div>
                  {s.error && <span className="text-xs text-destructive">{s.error}</span>}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={uploading} className="flex-1">
                {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating accounts...</> : `Create ${validCount} Student Account${validCount === 1 ? "" : "s"}`}
              </Button>
              <Button variant="outline" onClick={reset}>Start Over</Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-2xl font-semibold text-success">{successCount}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-2xl font-semibold text-destructive">{failureCount}</p>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>Important:</strong> Download the credentials CSV now. Temporary passwords are only shown in this session.
            </div>
            <Button onClick={downloadCredentials} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Download Credentials CSV
            </Button>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border p-2">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-muted/50">
                  <div className="flex items-center gap-2">
                    {r.success ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    <span>{r.name}</span>
                    <span className="text-muted-foreground">{r.email}</span>
                  </div>
                  {r.error && <span className="text-xs text-destructive truncate max-w-[200px]">{r.error}</span>}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} className="flex-1">Upload Another File</Button>
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
