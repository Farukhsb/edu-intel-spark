import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, BarChart3, Brain, GraduationCap, Sparkles, Users, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePageMetadata } from "@/lib/seo";

const Demo = () => {
  const navigate = useNavigate();
  const { enterDemo } = useAuth();

  usePageMetadata({
    title: "GradeAI Demo | Choose Your Workspace",
    description: "Open the staff or synthetic student demo workspace to explore GradeAI without a live account.",
    path: "/demo",
    robots: "noindex,follow",
  });

  const openDemo = (role: "lecturer" | "student") => {
    enterDemo(role);
    navigate("/demo/dashboard");
  };

  const openCohortSignalDemo = () => {
    navigate("/cohortsignal-demo");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">GradeAI Demo</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/")}>
              Back to site
            </Button>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 lg:py-28">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <Badge variant="secondary" className="px-4 py-1.5 text-sm">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Live product walkthrough
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Choose a demo workspace
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Open a staff or synthetic test view with synthetic data. No sign-up required.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
          <Card className="group cursor-pointer transition-all hover:border-primary/40 hover:shadow-lg" onClick={() => openDemo("lecturer")}>
            <CardContent className="space-y-4 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <h2 className="font-display text-lg font-semibold">Staff Demo</h2>
              <p className="text-sm text-muted-foreground">
                View at-risk students, intervention logging, and the tutor workflow.
              </p>
              <Button className="w-full">
                Open staff demo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="group cursor-pointer transition-all hover:border-emerald-400/50 hover:shadow-lg" onClick={openCohortSignalDemo}>
            <CardContent className="space-y-4 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 transition-colors group-hover:bg-emerald-500/20">
                <BarChart3 className="h-7 w-7 text-emerald-700" />
              </div>
              <div className="space-y-1">
                <h2 className="font-display text-lg font-semibold">CohortSignal Heatmap</h2>
                <p className="text-sm text-muted-foreground">
                  Lecturer early-warning view for risk bands, filters, and intervention logging.
                </p>
              </div>
              <Button variant="outline" className="w-full">
                Open heatmap demo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="group cursor-pointer transition-all hover:border-secondary/40 hover:shadow-lg" onClick={() => openDemo("student")}>
            <CardContent className="space-y-4 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 transition-colors group-hover:bg-secondary/20">
                <Users className="h-7 w-7 text-secondary" />
              </div>
              <h2 className="font-display text-lg font-semibold">Synthetic Test View</h2>
              <p className="text-sm text-muted-foreground">
                Test the learner surface without using live data.
              </p>
              <Button variant="outline" className="w-full">
                Open synthetic view <Zap className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Demo;
