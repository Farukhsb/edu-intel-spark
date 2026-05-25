import { Link } from "react-router-dom";
import { ArrowLeft, Brain } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageMetadata } from "@/lib/seo";

const termsSections = [
  {
    title: "Controlled pilot use",
    body:
      "GradeAI is currently offered as a controlled pilot platform for academic workflow testing, evaluation, and limited institutional use. It should be treated as a pilot service rather than a finished enterprise system.",
  },
  {
    title: "Decision-support only",
    body:
      "AI grading, integrity signals, feedback drafting, and student-support insights are decision-support tools. They do not replace lecturer judgement, moderation, approval, release, or formal institutional decision-making.",
  },
  {
    title: "Acceptable use",
    body:
      "Users must not use GradeAI for cheating, misuse of academic records, harassment, unlawful activity, security abuse, or attempts to bypass institutional controls. Institutions remain responsible for deciding who is authorised to access the platform.",
  },
  {
    title: "What the platform processes",
    body:
      "GradeAI may process user account details, student submissions, grades, workflow status, feedback, audit history, and academic integrity signals to support teaching, moderation, student support, and governance workflows.",
  },
  {
    title: "Review before final use",
    body:
      "Platform outputs should be reviewed by lecturers or authorised staff before being treated as final academic outcomes. A generated mark, feedback note, or integrity flag should not be treated as final without human review.",
  },
  {
    title: "Deletion requests",
    body:
      "Data deletion or anonymisation requests may be made by an institution administrator or another authorised user, subject to academic record retention, governance, and legal obligations.",
  },
  {
    title: "Pilot-stage warranty position",
    body:
      "At pilot stage, GradeAI is provided without enterprise warranty, uptime commitment, or guaranteed institutional fitness. Institutions should evaluate the platform carefully before relying on it for live operational use.",
  },
] as const;

const Terms = () => {
  usePageMetadata({
    title: "Terms of Service | GradeAI",
    description:
      "Read the GradeAI pilot terms covering acceptable use, AI decision-support boundaries, data handling, and pilot-stage service expectations.",
    path: "/terms",
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
              <p className="text-sm text-muted-foreground">Terms of service</p>
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
            <CardTitle>Terms of service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
            <p>
              These terms explain, in plain language, how GradeAI should be used during the current pilot stage.
              They are intended for lecturers, students, administrators, and institutional reviewers considering
              the platform for controlled academic use.
            </p>
            <p>
              They do not replace institutional regulations, academic misconduct procedures, or local governance
              requirements that may also apply.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {termsSections.map((section) => (
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

export default Terms;
