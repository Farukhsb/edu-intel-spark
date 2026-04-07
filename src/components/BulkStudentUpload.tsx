import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

interface ParsedStudent {
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
  password: string;
  success: boolean;
  error?: string;
}

export const BulkStudentUpload = () => {
  const [open, setOpen] = useState(false);
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

      const students: ParsedStudent[] = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim());
        const email = cols[emailIdx] || "";
        const name = nameIdx >= 0 ? cols[nameIdx] : "";
        const cohort = cohortIdx >= 0 ? cols[cohortIdx] : "";
        const dept = deptIdx >= 0 ? cols[deptIdx] : "";

        const errors: string[] = [];
        if (!email || !email.includes("@")) errors.push("Invalid email");
        if (!name) errors.push("Missing name");

        return { name, email, cohort_id: cohort, department_id: dept, valid: errors.length === 0, error: errors.join(", ") };
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
    const uploadResults: UploadResult[] = [];

    for (const student of valid) {
      const tempPassword = `GradeAI_${Math.random().toString(36).slice(2, 10)}`;
      try {
        const cred = await createUserWithEmailAndPassword(auth, student.email, tempPassword);
        await updateProfile(cred.user, { displayName: student.name });
        await setDoc(doc(db, "users", cred.user.uid), {
          full_name: student.name,
          email: student.email,
          role: "student",
          avatar_url: null,
          cohort_id: student.cohort_id || null,
          department_id: student.department_id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { merge: true });
        uploadResults.push({ name: student.name, email: student.email, password: tempPassword, success: true });
      } catch (err: any) {
        uploadResults.push({ name: student.name, email: student.email, password: tempPassword, success: false, error: err.message });
      }
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
    a.href = url; a.download = "student_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => { setParsed([]); setResults([]); setStep("upload"); };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Upload className="mr-2 h-3.5 w-3.5" /> Bulk Upload Students</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Student Upload</DialogTitle>
          <DialogDescription>Upload a CSV to create student accounts</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 pt-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-3.5 w-3.5" /> Download Template
            </Button>
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">CSV with columns: name, email, cohort, department</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              <Button onClick={() => fileRef.current?.click()}>Select CSV File</Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <Badge variant="default">{parsed.filter(s => s.valid).length} valid</Badge>
              {parsed.some(s => !s.valid) && <Badge variant="destructive">{parsed.filter(s => !s.valid).length} invalid</Badge>}
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {parsed.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-muted/50">
                  <div className="flex items-center gap-2">
                    {s.valid ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    <span>{s.name || "—"}</span>
                    <span className="text-muted-foreground">{s.email}</span>
                  </div>
                  {s.error && <span className="text-xs text-destructive">{s.error}</span>}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={uploading} className="flex-1">
                {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : `Create ${parsed.filter(s => s.valid).length} Students`}
              </Button>
              <Button variant="outline" onClick={reset}>Cancel</Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <Badge variant="default">{results.filter(r => r.success).length} created</Badge>
              {results.some(r => !r.success) && <Badge variant="destructive">{results.filter(r => !r.success).length} failed</Badge>}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>Important:</strong> Download the credentials CSV below and share it with your students. Passwords are only available now and cannot be retrieved later.
            </div>

            <Button onClick={downloadCredentials} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Download Credentials CSV
            </Button>

            <div className="max-h-48 overflow-y-auto space-y-1">
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
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full">Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
