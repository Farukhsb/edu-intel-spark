# Academic Compliance and AI Governance

## Why this matters

The hardest part of GradeAI is not just getting the software to work. The harder question is whether a university would feel comfortable using it around student work, grades, feedback, and academic integrity.

This file sets out the main governance issues I am designing around. It is not a claim that GradeAI is already approved for institution-wide use. At the current stage, it should be treated as a controlled pilot that still needs institutional review before wider rollout.

## Basic position

GradeAI should not be used as an automatic marker that replaces a lecturer.

The safer position is:

> AI can help prepare draft grading evidence, but the lecturer remains responsible for the academic decision.

That is the assumption behind the workflow.

## Lecturer control

The grading flow is deliberately staged:

```text
submitted
  -> AI grading
  -> lecturer review
  -> approval
  -> release
```

The important part is that approval and release are not the same thing.

A lecturer may approve something internally before it is ready for the student to see. This gives room for moderation, checking, or further review.

Students should only see released outcomes, not raw AI drafts or internal review notes.

## What the AI is allowed to do

In the current design, AI is used to support the lecturer by producing draft material such as:

- a suggested score
- rubric-level comments
- feedback wording
- integrity or similarity signals
- explanations that help students understand released feedback

These outputs should be treated as material for review, not as final academic authority.

## Academic integrity

Integrity checks are sensitive because a false accusation can seriously affect a student.

GradeAI should therefore treat integrity results as signals for review, not proof of misconduct.

The system can help identify things like unusual similarity or writing patterns, but a person still needs to look at the work and decide what the evidence means.

The language in the product and documentation should avoid making automatic misconduct claims.

## Data and privacy

GradeAI may handle student submissions, grades, feedback, emails, and support notes. That makes privacy a central issue, not an optional extra.

Before wider use, an institution would likely want clear answers on:

- what data is stored
- where it is stored
- who can access it
- how long it is kept
- how deletion would work
- whether any student data is sent to external AI providers
- what happens to uploaded files
- how audit logs are protected

For a controlled pilot, the priority is to keep access narrow, avoid real sensitive data where possible, and make the data flow easy to explain.

## Role boundaries

The system separates users into roles such as student, lecturer, moderator, and admin.

The main rule is that each role should only see what it needs to do its job.

Examples:

- students should not see unreleased grades
- students should not see draft AI feedback
- moderators should only see the cases assigned to them
- admins should have oversight without becoming hidden markers
- lecturer access should be tied to their own assignments and students

These boundaries need to be tested regularly because they are more important than most UI features.

## Audit trail

Academic decisions need to be reviewable later.

That means GradeAI should keep enough history to answer questions such as:

- who reviewed the submission
- what was approved
- when it was released
- whether it was moderated
- what integrity evidence existed
- whether a support intervention was recorded

The aim is not to log everything forever. The aim is to keep the right evidence so a decision can be explained if challenged.

## Data residency and external providers

One concern raised by academics is where student data goes, especially if AI providers are involved.

For institutional use, GradeAI would need a clear deployment and data-processing position. That may include:

- using approved regions
- avoiding unnecessary transfer of student identifiers
- limiting what text is sent to model providers
- documenting provider terms
- supporting anonymisation or pseudonymisation where practical

This is not fully solved by code alone. It also depends on the institution's policy and deployment choices.

## Current limits

GradeAI is still an early controlled pilot.

The main limitations are:

- it has not gone through a full university procurement or compliance process
- AI grading can still be inconsistent on borderline work
- data protection requirements will differ between institutions
- some safeguards depend on correct deployment configuration
- lecturers still need to review the output carefully

These limits should be stated clearly. Overclaiming here would make the project less credible, not more.

## Practical rule for the project

The product should keep following this rule:

> AI can assist, but a human must remain responsible for academic judgement, release, and misconduct decisions.

That is the safest way to position GradeAI at this stage.