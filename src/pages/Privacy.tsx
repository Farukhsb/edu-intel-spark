import { Link } from "react-router-dom";
import { ArrowLeft, Brain } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageMetadata } from "@/lib/seo";

const privacySections = [
  {
    title: "What GradeAI stores",
    body:
      "GradeAI stores account details, assignment records, submissions, grades, workflow actions, and audit history required to support teaching, student, and administrative functions within the platform.",
  },
  {
    title: "How uploaded work is used",
    body:
      "Student submissions are used within the platform for grading, moderation, academic integrity review, feedback explanation, and institutional reporting. Submitted work is not made publicly available through the platform.",
  },
  {
    title: "Where AI is used",
    body:
      "AI is used to support grading, feedback explanation, and academic risk analysis. Academic outcomes remain subject to human review, moderation, approval, and release.",
  },
  {
    title: "External services",
    body:
      "GradeAI may use approved external services for AI processing, email delivery, analytics, error monitoring, and optional code similarity checking. These services should be configured by the institution or platform administrator before live use.",
  },
  {
    title: "Student work and AI processing",
    body:
      "Uploaded submissions may be processed by AI services to support grading, feedback drafting, explanation, and integrity review. AI output is advisory and should be reviewed by an educator before it is used in an academic decision.",
  },
  {
    title: "Who can see what",
    body:
      "Lecturers can view teaching and marking data relating to the work they manage. Students can view only released results and support content intended for them. Administrative users can view institution-level reporting and governance information.",
  },
  {
    title: "Data rights",
    body:
      "Users may ask for correction, access, or deletion of personal data, subject to institutional academic record policies and legal retention requirements.",
  },
  {
    title: "Automated decision-making",
    body:
      "GradeAI is designed as a decision-support tool. It should not be used to make fully automated final academic decisions about grades, misconduct, progression, or student support.",
  },
  {
    title: "Retention and pilot status",
    body:
      "GradeAI is currently being presented as a pilot academic platform. Data should be retained only for as long as it is required for teaching, review, governance, and evaluation of the pilot activity.",
  },
  {
    title: "Questions or corrections",
    body:
      "If you require a record to be corrected, or if you wish to ask how your data is being used within the pilot, please contact the teaching or platform administrator responsible for your account.",
  },
] as const;

const Privacy = () => {
  usePageMetadata({
    title: "Privacy Notice | GradeAI",
    description:
      "Read how GradeAI handles academic workflow data, student submissions, AI-supported assessment, and pilot retention expectations.",
    path: "/privacy",
    robots: "noindex,follow",
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-display text-xl font-bold">GradeAI</p>
              <p className="text-sm text-muted-foreground">Privacy notice</p>
            </div>
          </div>
          <Button asChild variant="ghost">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Privacy notice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
            <p>
              This page sets out, in plain language, what GradeAI holds, why that information is held, and how academic workflow data is used during the pilot.
            </p>
            <p>
              It is intended as a practical notice for lecturers, students, and administrative users of the platform. It does not replace any fuller institutional privacy or data protection documentation that may also apply.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6 border-amber-300/70 bg-amber-50/70">
          <CardHeader>
            <CardTitle className="text-lg">Pilot data retention note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-slate-700">
            <p>
              GradeAI is being presented as a pilot platform. Academic records, submissions, grades, workflow history,
              and audit data should not be kept indefinitely by default.
            </p>
            <p>
              Retention and deletion periods should be agreed with the institution responsible for the pilot before live
              use. If no separate agreement applies, pilot data should be reviewed and removed once teaching, marking,
              governance, and pilot evaluation activity are complete.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {privacySections.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="text-lg">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7 text-muted-foreground">{section.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Privacy;
