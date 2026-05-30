# Deployment Guide

## Supabase setup

This project now uses a clean, controlled Supabase setup.

The old Lovable-era migration history is no longer the active deployment target. The active deployment source is the current canonical migration chain under `supabase/migrations`.

All new migrations must use 14-digit timestamp prefixes in the filename.

Example format:

```text
YYYYMMDDHHMMSS_description.sql
```

## Frontend environment variables

Frontend env var names:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_ANON_KEY`

## Edge Function secrets

Edge Function secret names:

- `OPENAI_API_KEY`
- `OPENAI_GRADING_MODEL`
- `OPENAI_INTEGRITY_MODEL`
- `OPENAI_CHAT_MODEL`
- `EMAIL_NOTIFICATIONS_ENABLED`
- `APP_BASE_URL`
- `ENV`
- `RESEND_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `DOCLING_EXTRACTION_FALLBACK_ENABLED`
- `DOCLING_EXTRACTION_FALLBACK_URL`
- `DOCLING_EXTRACTION_FALLBACK_SECRET`
- `DOCLING_EXTRACTION_FALLBACK_TIMEOUT_MS` for the optional PDF extraction fallback

## Storage

Private storage bucket name:

- `submissions`

## Deploy commands

Run deployment in this order:

```bash
npx supabase db push --dry-run --linked --include-all
npx supabase db push --linked --include-all
npx supabase functions deploy
```

## Validation checklist

Run local validation:

```bash
npm run test
npm run build
npm run test:coverage
```

Then verify:

- login works
- profile loads
- upload works
- AI grading works
- explain-grade works
