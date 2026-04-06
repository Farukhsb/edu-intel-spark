import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Bot, Eye, FileSearch, Shield, ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const DEMO_OVERVIEW = [
  { label: "Submissions Scanned", value: "1,247", icon: FileSearch },
  { label: "Flagged for Review", value: "23", icon: AlertTriangle },
  { label: "AI-Content Detected", value: "14", icon: Bot },
  { label: "Cleared", value: "1,210", icon: Shield },
];

const DEMO_FLAGGED = [
  { student: "Anonymous #47", module: "CS301", aiProbability: 89, styleMismatch: 76, structuralScore: 82, riskLevel: "high", flags: ["AI-generated probability high", "Writing style inconsistent"] },
  { student: "Anonymous #112", module: "CS205", aiProbability: 72, styleMismatch: 65, structuralScore: 58, riskLevel: "high", flags: ["Vocabulary complexity jump", "Structural patterns match AI"] },
  { student: "Anonymous #203", module: "CS301", aiProbability: 54, styleMismatch: 42, structuralScore: 61, riskLevel: "medium", flags: ["Moderate AI indicators"] },
  { student: "Anonymous #88", module: "CS102", aiProbability: 38, styleMismatch: 55, structuralScore: 35, riskLevel: "low", flags: ["Style shift noted", "Likely legitimate"] },
];

const AcademicIntegrity = () => {
  const { isDemo } = useAuth();
  const [overview, setOverview] = useState(DEMO_OVERVIEW);
  const [flagged, setFlagged] = useState(DEMO_FLAGGED);
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (isDemo) return;
    const fetchData = async () => {
      try {
        const subsSnap = await getDocs(collection(db, "submissions"));
        const totalScanned = subsSnap.size;
        const gradesSnap = await getDocs(collection(db, "grades"));
        let flaggedCount = 0;
        gradesSnap.docs.forEach(d => {
          const data = d.data();
          if (data.ai_score != null && data.ai_score < 30) flaggedCount++;
        });
        setOverview([
          { label: "Submissions Scanned", value: totalScanned.toString(), icon: FileSearch },
          { label: "Flagged for Review", value: flaggedCount.toString(), icon: AlertTriangle },
          { label: "AI-Content Detected", value: Math.floor(flaggedCount * 0.6).toString(), icon: Bot },
          { label: "Cleared", value: (totalScanned - flaggedCount).toString(), icon: Shield },
        ]);
      } catch (err) {
        console.error("Failed to fetch integrity data:", err);
      }
      setLoading(false);
    };
    fetchData();
  }, [isDemo]);

  const riskColor = (level: string) => { if (level === "high") return "destructive"; if (level === "medium") return "secondary"; return "outline"; };
  const scoreColor = (score: number) => { if (score >= 70) return "text-destructive"; if (score >= 50) return "text-warning"; return "text-success"; };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
            <span className="text-sm text-muted-foreground">Viewing demo integrity data</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overview.map((stat) => (
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base">Flagged Submissions</CardTitle>
          </div>
          <CardDescription>Submissions requiring academic integrity review</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {flagged.map((sub, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{sub.student}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{sub.module}</span>
                </div>
                <Badge variant={riskColor(sub.riskLevel) as any}>{sub.riskLevel} risk</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "AI Probability", value: sub.aiProbability },
                  { label: "Style Mismatch", value: sub.styleMismatch },
                  { label: "Structural Score", value: sub.structuralScore },
                ].map((metric) => (
                  <div key={metric.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{metric.label}</span>
                      <span className={`font-bold ${scoreColor(metric.value)}`}>{metric.value}%</span>
                    </div>
                    <Progress value={metric.value} className="h-1.5" />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sub.flags.map((f, j) => (
                  <Badge key={j} variant="outline" className="text-xs">{f}</Badge>
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
