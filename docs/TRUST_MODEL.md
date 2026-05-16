# GradeAI Trust Model

## Purpose

GradeAI handles academic workflows where trust matters. A grade, a moderation decision, an integrity signal, or a student support flag can affect how a lecturer responds to a student. Because of that, the platform cannot treat safety as an afterthought.

This document explains the trust model behind GradeAI in plain language. It sets out who should see what, when they should see it, and how the platform protects academic judgement, student visibility, moderation, external review, AI response handling, and safe failure behaviour.

The aim is simple: GradeAI should help lecturers work faster and see clearer evidence, but it should never bypass proper academic oversight.

## Core Principle

AI supports the workflow. It does not own the decision.

GradeAI can help structure marking, surface risk patterns, summarise evidence, and support feedback generation. But the final academic responsibility stays with the lecturer or authorised academic reviewer.

That principle shapes the whole system:

- AI output is treated as provisional until reviewed
- AI and Edge Function responses are validated before they are trusted
- lecturers can review, edit, approve, or override AI-assisted outputs
- students only see released feedback
- moderation can gate work before final release
- external examiner exports should only include appropriate governed records
- risk signals are prompts for human review, not automatic decisions about students
- failures should fall back safely instead of exposing raw technical details or misleading academic data

## What GradeAI Trusts And Does Not Trust

GradeAI does not assume that every runtime response is safe just because it came from an internal function or AI service.

The system treats the following as untrusted until validated or checked:

- AI grading responses
- grade breakdown payloads
- explanation and tutoring responses
- plagiarism and integrity response payloads
- parsed JSON from stored records
- Supabase or Edge Function responses that may drift over time
- environment configuration used by the frontend

This matters because academic systems should not render, save, or export malformed data. If an AI response changes shape, if an Edge Function returns an unexpected payload, or if a stored breakdown is malformed, GradeAI should fail safely rather than treating that data as a valid academic outcome.

The rule is:

> External or runtime data must be checked before it is used in a decision, shown to a user, or saved as trusted academic information.

## Assessment Lifecycle

GradeAI follows a staged assessment lifecycle.

```text
submitted
  -> ai_grading
  -> ai_graded
  -> first_review / under_review
  -> approved
  -> released
```

Moderated work can move through an additional path:

```text
first_review
  -> moderation_pending
  -> moderation_in_progress
  -> moderated / escalated
  -> approved
  -> released
```

These stages matter because they decide what different users are allowed to see.

For example, a submission may be marked by AI and even reviewed internally, but that does not automatically mean the student should see it. In GradeAI, `approved` and `released` are deliberately separate. Approval means the work has passed an internal review step. Release means the feedback is ready to be shown to the student.

## Student Visibility Rules

Students should only see academic feedback when it has reached the correct stage.

GradeAI follows these rules:

- students can submit work for open assignments
- students should not see provisional AI grading
- students should not see approved-but-unreleased feedback
- students only see grades and explanations after release
- student-facing grade explanation views should use released submissions only

This distinction is important. A lecturer may approve a grade internally but still need to complete moderation, resolve an integrity concern, or check feedback wording before releasing it.

The student-facing explanation flow is therefore protected by released-only visibility. This prevents students from seeing feedback too early or seeing information that is still part of an internal academic process.

## Lecturer Review Rules

Lecturers remain the main decision-makers in the assessment workflow.

GradeAI is designed to help lecturers by reducing repetitive work and presenting structured evidence. It does not remove lecturer judgement.

Lecturers can:

- review AI-assisted marks and feedback
- check criterion-level scoring
- inspect confidence and integrity signals
- edit feedback before approval
- override marks where needed
- decide whether a submission should be approved, moderated, returned, escalated, or released

This is important because academic marking often involves context that a model should not decide alone. The system should support the lecturer, not replace them.

## AI And API Validation Rules

GradeAI uses Zod schemas to validate high-risk runtime payloads before those payloads are rendered, saved, or used in workflow decisions.

Current validation covers:

- AI grading response payloads
- criterion-level grade breakdown structures
- explanation and tutoring responses
- plagiarism and integrity response payloads
- the current batch response shape returned by the plagiarism/integrity Edge Function

The validation is applied at the boundary. For example, raw Edge Function results are checked before grade fields are saved, and stored grade breakdowns are checked before they are rendered to students.

Where legacy or alias fields exist, normalisation happens inside schema/helper paths rather than in UI code first. The canonical shape is then validated again. This helps the app support real-world payload differences without weakening the trust boundary.

If validation fails, the system should not render partial academic results as if they are trusted. Instead, it should use a safe fallback, preserve existing state where appropriate, and log enough safe context to help with debugging.

## Moderation Rules

Moderation is treated as a separate layer of academic control.

A moderation workflow may be triggered by:

- low confidence in AI-assisted grading
- high integrity risk
- large difference between AI and lecturer judgement
- borderline marks
- programme or institutional moderation requirements

The moderation layer is designed to protect the final decision. It gives reviewers a controlled space to agree, adjust, return, escalate, or approve work before release.

Moderated work should remain gated until the moderation decision is complete. This helps protect students from seeing provisional outcomes and helps institutions maintain a clearer audit trail.

## External Examiner Export Rules

External examiner exports are governance workflows. They should not behave like ordinary data downloads.

GradeAI should only include records that are appropriate for review. Draft, provisional, or unreleased records should not appear in external examiner exports.

The export workflow is therefore governed by status filtering. Exportable data should come from submissions that are in appropriate reviewed states, such as moderated, approved, or released, depending on the purpose of the export.

This matters because external examiners are reviewing formal academic evidence. Exporting the wrong records could create confusion, expose unfinished decisions, or weaken confidence in the platform.

## Student Support And Risk Signal Rules

GradeAI uses assessment activity to help lecturers spot students who may need support earlier.

These signals can include:

- missed or late submissions
- falling marks
- repeated weaknesses against rubric criteria
- low completion patterns
- high-risk trends across assignments

These signals are not final judgements about a student. They are prompts for a lecturer or support team to review the situation.

A risk flag should mean:

> This student may need attention. Please review the evidence.

It should not mean:

> The system has made a final decision about this student.

That distinction is important. Students may be struggling for many reasons, and the platform should support careful human follow-up rather than automate sensitive academic or pastoral decisions.

## Data Boundary Rules

GradeAI must protect student information. A lecturer or student should not accidentally see another student’s records because of a routing issue, stale state, or failed request.

The platform is designed around these data-boundary expectations:

- student profile views should match the intended route and student context
- student-facing views should not show another student’s feedback
- failed requests should not leave stale sensitive data visible
- empty states should be safe and clear
- tests should cover route-mismatch and visibility boundary cases where possible

This is especially important in academic systems because student records, grades, feedback, and support notes are sensitive.

## Rate Limiting And Abuse Protection

Some GradeAI workflows are expensive because they can trigger AI marking, explanation generation, or integrity analysis. These workflows need protection from accidental loops, repeated clicks, or deliberate abuse.

Rate limiting is applied to the high-cost Edge Functions:

- `grade-submission`
- `check-plagiarism`
- `explain-grade`

The limiter uses the authenticated user ID where available. If that is not available, it falls back to request IP, then to a conservative anonymous bucket. When the limit is exceeded, the function returns HTTP `429` with a safe response body and a `Retry-After` header.

The response does not expose internal implementation details. Logging is intentionally minimal and avoids student content, submissions, grades, private feedback, prompts, and document text.

The current limiter is process-local and in-memory. That is acceptable for prototype use and controlled testing, but it is not full distributed production protection yet. Wider rollout should move those high-cost limits into a persistent/shared store or combine them with provider-level controls.

## Environment Configuration Rules

GradeAI validates frontend environment configuration explicitly rather than assuming required values exist.

The app validates key environment variables such as:

- Supabase URL
- Supabase publishable key
- app environment
- optional Sentry configuration
- optional PostHog configuration

Invalid configuration fails early with a clear error that names the problematic variable without exposing secret values.

This helps avoid confusing runtime failures where the app loads but authentication, monitoring, or backend communication fails later because of a missing or malformed environment value.

Test-mode environment values are normalised safely for Vitest and CI, while real app environments remain limited to the expected deployment modes.

## Logging And Observability Rules

GradeAI uses structured logging so production debugging does not become a source of data leakage.

The logging approach separates development-only logs from production-safe error reporting:

- debug and info logs are development-only
- warnings are kept controlled
- errors can route through the existing Sentry capture path where appropriate
- logged context is sanitised before it is sent through raw logs or reporting

The logger is designed not to log sensitive academic fields such as:

- student submissions
- grades
- private feedback
- AI prompts
- document text
- secrets or environment values

This matters because academic data can be sensitive even when it looks like ordinary application state. Logs should help diagnose problems without turning into another place where private assessment data is stored.

## Error And Failure Safety

Real systems fail. Network requests can timeout. Supabase can return an error. An Edge Function can fail. A component can crash.

GradeAI should fail safely.

That means:

- users should see a clear fallback instead of a broken screen
- raw runtime error messages should not be shown to users
- stack traces and technical details should not appear in the user interface
- failed requests should not display misleading academic data
- failed requests should not expose stale, provisional, or partial sensitive information
- toast or error messages should help the user understand that something went wrong without revealing internals

This is why the app includes error boundary and network failure tests. The goal is not just to prove that the happy path works. The goal is to prove that the system behaves responsibly when something goes wrong.

## Integrity Review Rules

Academic integrity signals should be explainable and separated clearly.

GradeAI separates different kinds of signals so lecturers can interpret them properly:

- cited overlap
- uncited overlap
- reference-section material
- internal peer overlap
- external source overlap
- AI-writing suspicion
- document extraction quality issues

The system should avoid treating all overlap as misconduct. For example, a properly cited quotation is different from uncited copying, and a reference list should not be scored the same way as body text.

Integrity review should support lecturer judgement. It should not make automatic misconduct decisions.

## Audit And Traceability

Trust also depends on being able to understand what happened.

GradeAI is designed to keep important workflow steps inspectable:

- who reviewed a submission
- whether AI output was edited
- whether a lecturer overrode a mark
- whether moderation was required
- what final score was agreed
- when feedback was released
- what support action was logged
- whether a response failed validation
- whether a high-cost function was rate limited

This kind of traceability matters for quality assurance, external review, and responsible rollout.

## Testing Evidence

The trust model is backed by automated tests across the main high-risk areas of the platform.

Current automated coverage includes:

- lecturer overview dashboard behaviour
- student-facing grade explanation states
- released-only student visibility
- student profile and intervention states
- route-mismatch protection for student data boundaries
- external examiner export preview and download behaviour
- governed-record filtering for export workflows
- application error boundary fallback behaviour
- network and API failure paths
- AI grading and grade breakdown validation
- explanation and integrity response validation
- rate limit behaviour for high-cost function protection
- environment parsing and test-mode normalisation
- structured logger behaviour and safe context handling

These tests are not only about increasing coverage numbers. They are there to protect the rules that make GradeAI safe to review and safer to pilot.

## Current Limitations

This trust model describes the direction and current safeguards of the project. GradeAI is still a fast-moving prototype and should not be presented as a finished institution-wide system.

Important areas for continued hardening include:

- gradually tightening TypeScript configuration further
- reducing any remaining low-risk `any` usage
- broader live scenario coverage beyond the role, load, and integrity checks already completed
- deeper permissions and RLS validation after migration changes
- more end-to-end tests across lecturer, student, moderator, admin, and external examiner flows
- longer-term load and usage validation once real users are involved

## Closing Note

GradeAI is built around a simple idea: academic technology should make evidence clearer without weakening academic judgement.

The platform can assist with marking, feedback, integrity review, analytics, support signals, and exports. But the trust model keeps the important boundaries clear: lecturers decide, students see only released outcomes, moderation gates sensitive decisions, AI responses are validated before use, high-cost functions are rate limited, and failure states should be safe rather than confusing or revealing.

That is what makes GradeAI more than an AI grading interface. It is an attempt to build academic workflow software that respects the reality of teaching, review, governance, and student support.
