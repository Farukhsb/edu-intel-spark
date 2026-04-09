import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, BarChart3, Shield, MessageSquare, TrendingUp, Users, Sparkles, ArrowRight, CheckCircle, GraduationCap, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

  const handleDemo = (role: "lecturer" | "student") => {
    enterDemo(role);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
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

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 lg:py-32">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <Badge variant="secondary" className="text-sm px-4 py-1.5">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI-Powered Academic Intelligence
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Smarter Marking.{" "}
              <span className="text-primary">Deeper Insights.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              GradeAI transforms academic assessment with AI-powered grading, real-time analytics, 
              and personalised student feedback — helping lecturers mark faster and students learn better.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button size="lg" onClick={() => navigate("/auth")} className="text-base px-8">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => handleDemo("lecturer")} className="text-base px-8">
                <Zap className="mr-2 h-4 w-4" /> Try Demo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">No credit card required · Free for educators</p>
          </div>
        </div>
      </section>

      {/* Demo Mode Cards */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl font-bold">Explore the Platform</h2>
          <p className="text-muted-foreground mt-2">Try a live demo — no sign-up required</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 max-w-2xl mx-auto">
          <Card className="group cursor-pointer hover:shadow-lg transition-all hover:border-primary/40" onClick={() => handleDemo("lecturer")}>
            <CardContent className="p-6 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg">Lecturer Demo</h3>
              <p className="text-sm text-muted-foreground">View analytics, manage assignments, AI-grade submissions</p>
              <Badge variant="outline">Demo Mode</Badge>
            </CardContent>
          </Card>
          <Card className="group cursor-pointer hover:shadow-lg transition-all hover:border-primary/40" onClick={() => handleDemo("student")}>
            <CardContent className="p-6 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 group-hover:bg-secondary/20 transition-colors">
                <Users className="h-7 w-7 text-secondary" />
              </div>
              <h3 className="font-display font-semibold text-lg">Student Demo</h3>
              <p className="text-sm text-muted-foreground">View grades, chat with AI assistant, improvement plans</p>
              <Badge variant="outline">Demo Mode</Badge>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold">Everything You Need</h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
              A comprehensive platform for AI-powered academic assessment, analytics, and student support.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Card key={i} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6 space-y-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="font-display text-3xl font-bold">Why Educators Choose GradeAI</h2>
              <p className="text-muted-foreground leading-relaxed">
                Built by academics, for academics. GradeAI understands the nuances of university 
                marking, rubric alignment, and the importance of consistent, constructive feedback.
              </p>
              <div className="space-y-3">
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success shrink-0" />
                    <span className="text-sm font-medium">{b}</span>
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
              ].map((s, i) => (
                <Card key={i}>
                  <CardContent className="p-6 text-center">
                    <p className="text-3xl font-bold font-display text-primary">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary/5 py-20">
        <div className="mx-auto max-w-2xl px-4 text-center space-y-6">
          <h2 className="font-display text-3xl font-bold">Ready to Transform Your Assessment?</h2>
          <p className="text-muted-foreground">
            Join educators who are already saving hours on marking while providing better feedback.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Start Free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => handleDemo("lecturer")}>
              Try Demo First
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-display font-semibold">GradeAI</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2025 GradeAI. AI-Powered Academic Intelligence.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
