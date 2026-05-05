# GradeAI MOSS Runner

This directory contains the standalone backend service for running Stanford MOSS behind a private API.

It is designed to stay separate from GradeAI itself:

- Node.js + Express
- `POST /run-moss`
- `GET /health`
- `x-api-key` authentication
- multipart uploads via `multer`
- JSON submission payloads from GradeAI's backend
- official Stanford `moss` Perl script stored in `./moss`
- Docker image suitable for Railway, Render, or a small VPS Docker host

## Required environment variables

```text
MOSS_USER_ID=your_moss_user_id
GRADEAI_API_SECRET=replace_with_a_long_random_secret
NODE_ENV=production
```

Optional:

```text
PORT=8788
MOSS_RUNNER_TIMEOUT_MS=30000
MOSS_MAX_MATCHES=10
```

## Local development

1. Install dependencies:

```powershell
cd tools/moss-runner
npm install
```

2. Create a local env file:

```powershell
Copy-Item .env.example .env
```

3. Fill in:

- `MOSS_USER_ID`
- `GRADEAI_API_SECRET`

4. Start the service:

```powershell
npm start
```

The server will listen on:

```text
http://127.0.0.1:8788
```

## How GradeAI talks to this service

GradeAI's `check-plagiarism` Edge Function calls this runner over HTTPS using:

- `POST /run-moss`
- header `x-api-key: <GRADEAI_API_SECRET>`
- JSON payload containing assignment metadata and extracted code text

On the GradeAI side, the matching secrets are:

```text
MOSS_PROVIDER_ENABLED=true
MOSS_RUNNER_URL=https://your-runner/run-moss
MOSS_RUNNER_API_SECRET=the_same_value_as_GRADEAI_API_SECRET
MOSS_RUNNER_TIMEOUT_MS=30000
```

## API

### Health check

```http
GET /health
```

Response:

```json
{
  "ok": true,
  "service": "gradeai-moss-runner"
}
```

### Run MOSS

```http
POST /run-moss
x-api-key: your secret
Content-Type: multipart/form-data
```

Form fields:

- `language` (required)
- `comment` (optional)
- `files` (required, repeat this field for each uploaded file)

Response:

```json
{
  "reportUrl": "http://moss.stanford.edu/results/...",
  "report_url": "http://moss.stanford.edu/results/...",
  "fileCount": 3,
  "findings": []
}
```

GradeAI can also call the same endpoint with JSON:

```json
{
  "assignment_id": "assignment-123",
  "language": "python",
  "submissions": [
    {
      "submission_id": "submission-a",
      "file_name": "student-a.py",
      "student_name": "Student A",
      "student_email": "a@example.com",
      "source_text": "print('hello')"
    },
    {
      "submission_id": "submission-b",
      "file_name": "student-b.py",
      "student_name": "Student B",
      "student_email": "b@example.com",
      "source_text": "print('hello')"
    }
  ]
}
```

## Railway deployment

Railway is the simplest stable host for this runner because it supports standard container builds without needing a Worker-specific runtime.

1. Push this service to a private GitHub repo.
2. In Railway, create a new project from that repo.
3. Add these environment variables:

```text
MOSS_USER_ID=your_real_stanford_moss_id
GRADEAI_API_SECRET=your_long_random_secret
NODE_ENV=production
MOSS_RUNNER_TIMEOUT_MS=30000
MOSS_MAX_MATCHES=10
```

4. Deploy.
5. Use the generated public URL, for example:

```text
https://your-runner.up.railway.app
```

6. Verify:

```text
https://your-runner.up.railway.app/health
```

Then point GradeAI at:

```text
MOSS_RUNNER_URL=https://your-runner.up.railway.app/run-moss
```

## Hosting note

This repo still contains the optional `worker.ts` and `wrangler.jsonc` files from an earlier Cloudflare Containers attempt, but the working deployed path is Railway. Treat the Railway setup above as the canonical host configuration unless you intentionally decide to revisit a Worker-container deployment later.

## Docker

Build locally:

```powershell
cd tools/moss-runner
docker build -t gradeai-moss-runner .
```

Run locally:

```powershell
docker run --rm -p 8788:8788 `
  -e MOSS_USER_ID=your_moss_user_id `
  -e GRADEAI_API_SECRET=your_secret `
  -e NODE_ENV=production `
  gradeai-moss-runner
```

## Notes

- The service never logs uploaded file contents.
- Temporary request files are deleted after each request.
- Raw MOSS process output is not returned to the client.
- Keep this repo private because it contains the Stanford `moss` script.
