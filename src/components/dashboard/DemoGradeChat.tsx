import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Brain, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildDemoGradeResponse, type ExplainGradeBreakdown } from "@/pages/dashboard/explain-grade/helpers";

type ChatMsg = { role: "user" | "assistant"; content: string };

const INITIAL_ASSISTANT_MESSAGE: ChatMsg = {
  role: "assistant",
  content:
    "Hello! I'm your AI Grade Assistant. I can help you understand your grades, identify improvement areas, and provide specific guidance on raising your marks. What would you like to know?",
};

type DemoGradeChatProps = {
  submissionId: string;
  gradeBreakdown: ExplainGradeBreakdown;
};

export const DemoGradeChat = ({ submissionId, gradeBreakdown }: DemoGradeChatProps) => {
  const [messages, setMessages] = useState<ChatMsg[]>([INITIAL_ASSISTANT_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([INITIAL_ASSISTANT_MESSAGE]);
    setInputValue("");
  }, [submissionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg: ChatMsg = { role: "user", content: inputValue };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputValue("");
    setMessages([...updatedMessages, { role: "assistant", content: buildDemoGradeResponse(userMsg.content, gradeBreakdown) }]);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Ask About Your Grade</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex h-80 flex-col">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-2">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Ask about your grade..."
              onKeyDown={(event) => event.key === "Enter" && void handleSend()}
            />
            <Button size="icon" onClick={() => void handleSend()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
