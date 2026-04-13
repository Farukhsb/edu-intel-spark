import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsonError, requireUser } from "../_shared/auth.ts";
import { createChatCompletion, getModel } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireUser(req);
    const { messages, gradeContext } = await req.json() as {
      messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
      gradeContext: unknown;
    };
    const chatModel = getModel("OPENAI_CHAT_MODEL", "gpt-5.4-mini");

    const systemPrompt = `You are GradeAI, a supportive academic grade assistant for university students. You use the Socratic method to help students reflect on their work and understand their grades.

Current grade context:
${JSON.stringify(gradeContext, null, 2)}

Guidelines:
- Use the Socratic method: ask guiding questions instead of giving direct answers
- Instead of "Your essay lacked structure", ask "What do you think was the strongest part of your argument?"
- Instead of "You lost marks on testing", ask "How did you decide which test cases to include?"
- Help students discover insights about their work through reflection
- Reference specific components from their grade breakdown
- Be encouraging and supportive
- Use markdown formatting for clarity
- Keep responses focused and under 300 words
- If asked about topics outside grade explanation, politely redirect`;

    const response = await createChatCompletion({
      model: chatModel,
      messages: [
        { role: "developer", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("OpenAI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("explain-grade error:", e);
    return jsonError(e, corsHeaders);
  }
});
