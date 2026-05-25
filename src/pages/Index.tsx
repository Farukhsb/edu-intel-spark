import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, BarChart3, Shield, MessageSquare, TrendingUp, Users, Sparkles, ArrowRight, CheckCircle, GraduationCap, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPublicLandingReadiness } from "@/lib/publicLanding";
import { usePageMetadata } from "@/lib/seo";

const features = [
  { icon: Brain, title: "AI-Powered Grading", description: "Rubric-based automated grading with detailed criterion-level feedback using advanced AI models." },
  { icon: BarChart3, title: "Cohort Analytics", description: "Track performance trends, grade distributions, and learning outcome achievement across modules." },
  { icon: Shield, title: "Academic Integrity", description: "Internal similarity detection engine flags potential plagiarism with severity scoring." },
  { icon: MessageSquare, title: "AI Grade Assistant", description: "Students can chat with AI to understand their grades and get personalized improvement guidance." },
  { icon: TrendingUp, title: "Performance Insights", description: "Identify at-risk students early with AI-powered intervention recommendations." },
  { icon: Users, title: "Institutional Reporting", description: "Accreditation-ready dashboards with department-level benchmarks and compliance metrics." },
];

const benefits = [
  "Reduce marking time by up to 70%",
  "Consistent, rubric-aligned feedback",
  "Real-time cohort performance tracking",
  "Early at-risk student identification",
  "Accreditation-ready analytics",
  "Secure academic integrity monitoring",
];

const Index = () => {
  const navigate = useNavigate();
  const { enterDemo } = useAuth();
  const readiness = getPublicLandingReadiness();

  usePageMetadata({
    title: "GradeAI | AI Academic Assessment and Analytics Platform",
    description:
      "GradeAI helps universities streamline marking, monitor cohort performance, strengthen academic integrity, and deliver clearer student feedback.",
    path: "/",
    robots: "index,follow",
  });

  const handleDemo = (role: "lecturer" | "student") => {
    enterDemo(role);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">GradeAI</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>Sign In</Button>
            <Button onClick={() => navigate("/auth")}>Get Started</Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 lg:py-32">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <Badge variant="secondary" className="px-4 py-1.5 text-sm">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI-Powered Academic Intelligence
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Smarter Marking.{" "}
              <span className="text-primary">Deeper Insights.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
              GradeAI transforms academic assessment with AI-powered grading, real-time analytics,
              and personalised student feedback, helping lecturers mark faster and students learn better.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
              <Button size="lg" onClick={() => navigate("/auth")} className="px-8 text-base">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => handleDemo("lecturer")} className="px-8 text-base">
                <Zap className="mr-2 h-4 w-4" /> Try Demo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">No credit card required - Free for educators</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <Card className="mb-10 border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <CardContent className="grid gap-4 p-6 md:grid-cols-3">
            <div className="rounded-lg border bg-background/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Platform Readiness</p>
              <p className="mt-2 text-sm font-semibold">{readiness.postureLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                GradeAI is structured around real academic workflow rather than disconnected AI utilities.
              </p>
            </div>
            <div className="rounded-lg border bg-background/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely challenge</p>
              <p className="mt-2 text-sm font-semibold">{readiness.likelyChallenge}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This is the operational gap the platform is designed to close for institutions and teaching teams.
              </p>
            </div>
            <div className="rounded-lg border bg-background/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next action</p>
              <p className="mt-2 text-sm font-semibold">{readiness.bestNextAction}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use the public entry points to inspect the workflow before committing to a live account.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mb-10 text-center">
          <h2 className="font-display text-2xl font-bold">Explore the Platform</h2>
          <p className="mt-2 text-muted-foreground">Try a live demo - no sign-up required</p>
        </div>
        <div className="mx-auto grid max-w-2xl gap-6 sm:grid-cols-2">
          <Card className="group cursor-pointer transition-all hover:border-primary/40 hover:shadow-lg" onClick={() => handleDemo("lecturer")}>
            <CardContent className="space-y-3 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold">Lecturer Demo</h3>
              <p className="text-sm text-muted-foreground">View analytics, manage assignments, AI-grade submissions</p>
              <Badge variant="outline">Demo Mode</Badge>
            </CardContent>
          </Card>
          <Card className="group cursor-pointer transition-all hover:border-primary/40 hover:shadow-lg" onClick={() => handleDemo("student")}>
            <CardContent className="space-y-3 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 transition-colors group-hover:bg-secondary/20">
                <Users className="h-7 w-7 text-secondary" />
              </div>
              <h3 className="font-display text-lg font-semibold">Student Demo</h3>
              <p className="text-sm text-muted-foreground">View grades, chat with AI assistant, improvement plans</p>
              <Badge variant="outline">Demo Mode</Badge>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold">Everything You Need</h2>
            <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
              A comprehensive platform for AI-powered academic assessment, analytics, and student support.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="transition-shadow hover:shadow-md">
                <CardContent className="space-y-3 p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-6">
              <h2 className="font-display text-3xl font-bold">Why Educators Choose GradeAI</h2>
              <p className="leading-relaxed text-muted-foreground">
                Built by academics, for academics. GradeAI understands the nuances of university
                marking, rubric alignment, and the importance of consistent, constructive feedback.
              </p>
              <div className="space-y-3">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 shrink-0 text-success" />
                    <span className="text-sm font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "70%", label: "Less Marking Time" },
                { value: "98%", label: "Feedback Accuracy" },
                { value: "3x", label: "Faster Turnaround" },
                { value: "24/7", label: "AI Available" },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="p-6 text-center">
                    <p className="font-display text-3xl font-bold text-primary">{stat.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-primary/5 py-20">
        <div className="mx-auto max-w-2xl space-y-6 px-4 text-center">
          <h2 className="font-display text-3xl font-bold">Ready to Transform Your Assessment?</h2>
          <p className="text-muted-foreground">
            Join educators who are already saving hours on marking while providing better feedback.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Start Free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => handleDemo("lecturer")}>
              Try Demo First
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-display font-semibold">GradeAI</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground sm:items-end">
            <p>(c) 2025 GradeAI. AI-Powered Academic Intelligence.</p>
            <div className="flex items-center gap-3">
              <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
                Privacy notice
              </Link>
              <Link to="/terms" className="underline underline-offset-4 hover:text-foreground">
                Terms of service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
