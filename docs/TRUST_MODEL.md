# GradeAI Trust Model

## Purpose

GradeAI handles academic workflows where trust matters. A grade, a moderation decision, an integrity signal, or a student support flag can affect how a lecturer responds to a student. Because of that, the platform cannot treat safety as an afterthought.

This document explains the trust model behind GradeAI in plain language. It sets out who should see what, when they should see it, and how the platform protects academic judgement, student visibility, moderation, external review, and safe failure behaviour.

The aim is simple: GradeAI should help lecturers work faster and see clearer evidence, but it should never bypass proper academic oversight.

## Core Principle

AI supports the workflow. It does not own the decision.

GradeAI can help structure marking, surface risk patterns, summarise evidence, and support feedback generation. But the final academic responsibility stays with the lecturer or authorised academic reviewer.

That principle shapes the whole system:

- AI output is treated as provisional until reviewed
- lecturers can review, edit, approve, or override AI-assisted outputs
- students only see released feedback
- moderation can gate work before final release
- external examiner exports should only include appropriate governed records
- risk signals are prompts for human review, not automatic decisions about students

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

These tests are not only about increasing coverage numbers. They are there to protect the rules that make GradeAI safe to review and safer to pilot.

## Current Limitations

This trust model describes the direction and current safeguards of the project. GradeAI is still a fast-moving prototype and should not be presented as a finished institution-wide system.

Important areas for continued hardening include:

- stricter TypeScript configuration
- reducing remaining `any` usage
- stronger schema validation for AI and API responses
- structured logging for production debugging and audit trails
- broader live-environment testing
- deeper permissions and RLS validation after migration changes
- more end-to-end tests across lecturer, student, moderator, admin, and external examiner flows

## Closing Note

GradeAI is built around a simple idea: academic technology should make evidence clearer without weakening academic judgement.

The platform can assist with marking, feedback, integrity review, analytics, support signals, and exports. But the trust model keeps the important boundaries clear: lecturers decide, students see only released outcomes, moderation gates sensitive decisions, and failure states should be safe rather than confusing or revealing.

That is what makes GradeAI more than an AI grading interface. It is an attempt to build academic workflow software that respects the reality of teaching, review, governance, and student support.