import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Brain, ChevronDown, ChevronUp, MessageSquare, Send, Sparkles } from "lucide-react";

const gradeBreakdown = {
  assessment: "CS301 - Assignment 1: Data Structures",
  totalGrade: 68,
  band: "2:1",
  components: [
    { name: "Code Implementation", weight: 40, score: 75, maxScore: 100 },
    { name: "Algorithm Analysis", weight: 25, score: 58, maxScore: 100 },
    { name: "Documentation", weight: 15, score: 80, maxScore: 100 },
    { name: "Testing & Edge Cases", weight: 10, score: 50, maxScore: 100 },
    { name: "Code Style & Structure", weight: 10, score: 70, maxScore: 100 },
  ],
  improvementAreas: [
    {
      area: "Algorithm Analysis",
      currentBand: "2:2",
      nextBand: "2:1",
      pointsNeeded: 12,
      tips: [
        "Include Big-O analysis for all operations",
        "Compare your solution with at least two alternative approaches",
        "Add space complexity analysis alongside time complexity",
      ],
    },
    {
      area: "Testing & Edge Cases",
      currentBand: "2:2",
      nextBand: "2:1",
      pointsNeeded: 10,
      tips: [
        "Test with empty inputs and boundary values",
        "Include at least 5 edge case scenarios",
        "Document your test reasoning",
      ],
    },
  ],
};

type ChatMsg = { role: "user" | "assistant"; content: string };

const chatMessages: ChatMsg[] = [
  {
    role: "assistant",
    content: "Hello! I'm your AI Grade Assistant. I can help you understand your grades, identify improvement areas, and provide specific guidance on raising your marks. What would you like to know?",
  },
];

const ExplainGrade = () => {
  const [expandedArea, setExpandedArea] = useState<number | null>(0);
  const [messages, setMessages] = useState<ChatMsg[]>(chatMessages);
  const [inputValue, setInputValue] = useState("");

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const userMsg: ChatMsg = { role: "user", content: inputValue };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    // Mock AI response
    setTimeout(() => {
      const aiMsg: ChatMsg = {
        role: "assistant",
        content: `Great question! Looking at your submission for "${gradeBreakdown.assessment}", your Algorithm Analysis section scored 58%. The main areas to improve are:\n\n1. **Big-O Analysis**: You correctly identified O(n) for insertion but missed the amortized analysis for dynamic resizing\n2. **Comparative Analysis**: Including comparisons with hash tables would strengthen your answer\n3. **Space Complexity**: This was largely omitted from your analysis\n\nWould you like me to show you an example of how to structure a strong algorithm analysis section?`,
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Grade Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Grade Breakdown</CardTitle>
          </div>
          <CardDescription>{gradeBreakdown.assessment}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-4xl font-bold font-display">{gradeBreakdown.totalGrade}%</span>
            <Badge>{gradeBreakdown.band}</Badge>
          </div>
          <div className="space-y-3">
            {gradeBreakdown.components.map((c, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{c.name} ({c.weight}%)</span>
                  <span className="font-medium">{c.score}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      c.score >= 70 ? "bg-success" : c.score >= 50 ? "bg-primary" : "bg-destructive"
                    }`}
                    style={{ width: `${c.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Improvement Areas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to Improve</CardTitle>
          <CardDescription>Specific guidance to raise your grade band</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {gradeBreakdown.improvementAreas.map((area, i) => (
            <div key={i} className="rounded-lg border p-3">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setExpandedArea(expandedArea === i ? null : i)}
              >
                <div>
                  <span className="text-sm font-medium">{area.area}</span>
                  <p className="text-xs text-muted-foreground">
                    +{area.pointsNeeded} points to reach {area.nextBand}
                  </p>
                </div>
                {expandedArea === i ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {expandedArea === i && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  {area.tips.map((tip, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {tip}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* AI Chat */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Ask About Your Grade</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto pr-2">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.content.split("\n").map((line, j) => (
                      <p key={j} className={j > 0 ? "mt-1" : ""}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about your grade..."
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <Button size="icon" onClick={handleSend}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExplainGrade;
