# Local MOSS Runner

This runner is the optional backend companion for GradeAI's disabled-by-default MOSS bridge. It is separate from the Supabase Edge Function and must be started explicitly.

What it does:

- accepts `POST /moss`
- validates an optional bearer token
- writes comparable code submissions to a temporary workspace
- invokes the official MOSS Perl script
- parses the MOSS report URL and overlap rows
- returns normalized findings that `check-plagiarism` can persist into `public.integrity_findings`

What it does not do:

- it does not enable MOSS by itself
- it does not change the current plagiarism UI
- it does not replace `llm_legacy` or `internal_text_similarity`

## Prerequisites

- Perl installed and available on `PATH`
- access to the official `moss.pl` script
- a valid MOSS user id

## Runner environment

Create a local env file from `.env.example` and fill in the real values:

```text
MOSS_USER_ID=your_moss_user_id
MOSS_SCRIPT_PATH=C:\path\to\moss.pl
MOSS_RUNNER_BEARER_TOKEN=optional-shared-secret
MOSS_RUNNER_TIMEOUT_MS=30000
MOSS_MAX_MATCHES=10
PORT=8788
```

## Start locally

From `worktrees/main-check`:

```powershell
$env:MOSS_USER_ID="your_moss_user_id"
$env:MOSS_SCRIPT_PATH="C:\path\to\moss.pl"
$env:MOSS_RUNNER_BEARER_TOKEN="optional-shared-secret"
npm run moss:runner
```

The runner listens on:

```text
http://127.0.0.1:8788/moss
```

## Edge Function bridge settings

Only after the runner is reachable should you enable the bridge for `check-plagiarism`:

```text
MOSS_PROVIDER_ENABLED=true
MOSS_RUNNER_URL=http://127.0.0.1:8788/moss
MOSS_RUNNER_BEARER_TOKEN=optional-shared-secret
MOSS_RUNNER_TIMEOUT_MS=20000
```

Keep `MOSS_PROVIDER_ENABLED=false` unless you intentionally want code-similarity requests to call this runner.
