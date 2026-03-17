import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Bot, Eye, FileSearch, Shield, ShieldAlert } from "lucide-react";

const integrityOverview = [
  { label: "Submissions Scanned", value: "1,247", icon: FileSearch },
  { label: "Flagged for Review", value: "23", icon: AlertTriangle },
  { label: "AI-Content Detected", value: "14", icon: Bot },
  { label: "Cleared", value: "1,210", icon: Shield },
];

const flaggedSubmissions = [
  {
    student: "Anonymous #47",
    module: "CS301",
    aiProbability: 89,
    styleMismatch: 76,
    structuralScore: 82,
    riskLevel: "high",
    flags: ["AI-generated probability high", "Writing style inconsistent with prior work"],
  },
  {
    student: "Anonymous #112",
    module: "CS205",
    aiProbability: 72,
    styleMismatch: 65,
    structuralScore: 58,
    riskLevel: "high",
    flags: ["Vocabulary complexity jump", "Structural patterns match AI output"],
  },
  {
    student: "Anonymous #203",
    module: "CS301",
    aiProbability: 54,
    styleMismatch: 42,
    structuralScore: 61,
    riskLevel: "medium",
    flags: ["Moderate AI indicators", "Some structural inconsistencies"],
  },
  {
    student: "Anonymous #88",
    module: "CS102",
    aiProbability: 38,
    styleMismatch: 55,
    structuralScore: 35,
    riskLevel: "low",
    flags: ["Style shift noted", "Likely legitimate improvement"],
  },
];

const AcademicIntegrity = () => {
  const riskColor = (level: string) => {
    if (level === "high") return "destructive";
    if (level === "medium") return "secondary";
    return "outline";
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return "text-destructive";
    if (score >= 50) return "text-warning";
    return "text-success";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overview stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {integrityOverview.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Flagged Submissions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base">Flagged Submissions</CardTitle>
          </div>
          <CardDescription>Submissions requiring academic integrity review</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {flaggedSubmissions.map((sub, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{sub.student}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{sub.module}</span>
                </div>
                <Badge variant={riskColor(sub.riskLevel) as any}>
                  {sub.riskLevel} risk
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">AI Probability</span>
                    <span className={`font-bold ${scoreColor(sub.aiProbability)}`}>{sub.aiProbability}%</span>
                  </div>
                  <Progress value={sub.aiProbability} className="h-1.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Style Mismatch</span>
                    <span className={`font-bold ${scoreColor(sub.styleMismatch)}`}>{sub.styleMismatch}%</span>
                  </div>
                  <Progress value={sub.styleMismatch} className="h-1.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Structural Score</span>
                    <span className={`font-bold ${scoreColor(sub.structuralScore)}`}>{sub.structuralScore}%</span>
                  </div>
                  <Progress value={sub.structuralScore} className="h-1.5" />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {sub.flags.map((f, j) => (
                  <Badge key={j} variant="outline" className="text-xs">
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcademicIntegrity;
