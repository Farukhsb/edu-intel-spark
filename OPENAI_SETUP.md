# OpenAI Setup

The website now uses OpenAI through Supabase Edge Functions.

Do not put your OpenAI key in a `VITE_*` variable. That would expose it to the browser.

Set these Supabase secrets instead:

```bash
supabase secrets set OPENAI_API_KEY=your-openai-api-key
supabase secrets set OPENAI_CHAT_MODEL=gpt-4o-mini
supabase secrets set OPENAI_GRADING_MODEL=gpt-4o-mini
supabase secrets set OPENAI_INTEGRITY_MODEL=gpt-4o-mini
```

Redeploy the AI functions after setting the secrets:

```bash
supabase functions deploy explain-grade
supabase functions deploy grade-submission
supabase functions deploy check-plagiarism
```
