import type { Profile } from "@/contexts/AuthContext";

export interface LecturerOverviewPdfSubmission {
  student_name: string | null;
  assignment_title: string;
  score: number | null;
  max_score: number;
  status: string;
  submitted_at: string;
}

export interface LecturerOverviewPdfStats {
  totalSubmissions: number;
  gradedCount: number;
  avgScore: number | null;
}

interface ExportLecturerOverviewPdfArgs {
  profile: Pick<Profile, "full_name"> | null;
  stats: LecturerOverviewPdfStats;
  recent: LecturerOverviewPdfSubmission[];
  formatStatusLabel: (status: string) => string;
  safeToLocaleDate: (value: string | null | undefined) => string;
}

export async function exportLecturerOverviewPdf({
  profile,
  stats,
  recent,
  formatStatusLabel,
  safeToLocaleDate,
}: ExportLecturerOverviewPdfArgs) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("GradeAI - Grade Report", 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
  doc.text(`Lecturer: ${profile?.full_name || "-"}`, 14, 34);
  doc.text(
    `Total Submissions: ${stats.totalSubmissions} | Graded: ${stats.gradedCount} | Avg: ${stats.avgScore ?? "-"}%`,
    14,
    40
  );

  autoTable(doc, {
    startY: 48,
    head: [["Student", "Assignment", "Score", "Max", "Status", "Date"]],
    body: recent.map((submission) => [
      submission.student_name || "Unknown",
      submission.assignment_title,
      submission.score != null ? String(submission.score) : "-",
      String(submission.max_score),
      formatStatusLabel(submission.status),
      safeToLocaleDate(submission.submitted_at),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 65, 122] },
  });

  doc.save("grades_report.pdf");
}
