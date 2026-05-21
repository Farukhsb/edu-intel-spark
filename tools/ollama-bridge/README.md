# GradeAI Ollama Bridge

This directory contains an optional standalone bridge for self-hosted Ollama.

It is intentionally separate from the main Supabase functions so the existing OpenAI workflow stays untouched unless you explicitly choose to integrate this service later.

Current design:

- Node.js + Express
- `GET /health`
- `GET /models`
- `POST /chat`
- optional `x-api-key` authentication
- forwards requests to an Ollama server you run separately

This is the same separation principle used for the private MOSS runner:

- GradeAI core stays stable
- external services are optional
- local/self-hosted infrastructure is isolated from the main deployment path

## What this bridge does

It accepts a small OpenAI-like chat payload from a trusted caller and forwards it to Ollama's `/api/chat` endpoint.

Expected request body:

```json
{
  "model": "qwen2.5:7b",
  "messages": [
    { "role": "system", "content": "You are a helpful academic assistant." },
    { "role": "user", "content": "Summarize this rubric." }
  ],
  "temperature": 0,
  "top_p": 1,
  "format": {
    "type": "json_schema"
  }
}
```

## What this bridge does not do

- It does not modify any Supabase function by itself
- It does not replace the current OpenAI path automatically
- It does not introduce Ollama into production unless you wire it in later

## Local setup

1. Install dependencies:

```powershell
cd tools/ollama-bridge
npm install
```

2. Create a local env file:

```powershell
Copy-Item .env.example .env
```

3. Update values as needed:

- `OLLAMA_BASE_URL`
- `OLLAMA_DEFAULT_MODEL`
- `GRADEAI_API_SECRET` if you want bridge authentication

4. Start the bridge:

```powershell
npm start
```

Default local URL:

```text
http://127.0.0.1:8790
```

## Endpoints

### Health

```http
GET /health
```

Response:

```json
{
  "ok": true,
  "service": "gradeai-ollama-bridge",
  "upstream": "ollama",
  "defaultModel": "qwen2.5:7b",
  "modelCount": 1,
  "models": ["qwen2.5:7b"]
}
```

### Models

```http
GET /models
```

If `GRADEAI_API_SECRET` is set, include:

```http
x-api-key: your secret
```

### Chat

```http
POST /chat
Content-Type: application/json
```

If `GRADEAI_API_SECRET` is set, include:

```http
x-api-key: your secret
```

Example:

```json
{
  "model": "qwen2.5:7b",
  "messages": [
    { "role": "user", "content": "Explain criterion-based marking in two sentences." }
  ]
}
```

## Quick verification

With the bridge running:

```powershell
curl.exe http://127.0.0.1:8790/health
```

Then:

```powershell
curl.exe -X POST http://127.0.0.1:8790/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Say hello.\"}]}"
```

## Docker

This folder includes a small `docker-compose.yml` for local bridge use.

Notes:

- the compose file assumes Ollama is reachable separately
- on Windows/macOS Docker Desktop, `host.docker.internal` is the usual bridge target
- for a remote Ollama machine, set `OLLAMA_BASE_URL` to that remote host instead

## Future integration

When you are ready to experiment again, the safe next step is:

1. keep the current OpenAI path unchanged
2. create a separate feature branch
3. make `llm-client.ts` or another adapter call this bridge only when explicitly enabled
4. test against non-production workflows first

That preserves the current working OpenAI deployment while giving you a clean place to experiment with self-hosted models.
