# GradeAI Test Coverage Strategy

## Purpose

GradeAI handles assessment workflows, student submissions, grading, integrity review, moderation, and student support. Testing should therefore focus less on chasing a perfect coverage number and more on protecting the parts of the system where mistakes would cause real harm.

The goal is simple: make sure the most important academic workflows continue to work safely as the product changes.

## Testing Principle

Not every file needs the same level of testing.

A button colour or layout card does not need the same protection as grade release, moderation gating, student visibility, or role-based access. GradeAI should prioritise tests around trust, permissions, and academic workflow correctness.

## Coverage Target

The target should be:

```text
80%+ coverage for critical paths
```

This does not mean the whole repo must immediately reach 80%. It means the most important workflows should be tested well enough that regressions are caught before deployment.

## Critical Paths

These are the areas that should receive the highest test priority.

### 1. Authentication and role boundaries

Tests should confirm that users only see the areas they are supposed to see.

Important cases:
- students cannot access lecturer-only pages
- lecturers cannot see unrelated student data
- moderators only see assigned or authorised moderation cases
- admins use oversight views without accidentally bypassing academic workflow rules
- unauthenticated users are redirected correctly

### 2. Assignment and submission workflow

Tests should cover the normal assessment journey.

Important cases:
- lecturer creates an assignment
- rubric criteria are saved correctly
- students can submit work for open assignments
- closed or unavailable assignments cannot be submitted to incorrectly
- submissions appear in the correct lecturer view

### 3. AI grading review and release

This is one of the most important areas.

Tests should confirm:
- AI grading can create draft scores and feedback
- lecturers can review and edit output before approval
- students do not see provisional AI output
- approved grades are not automatically visible until released
- released grades and feedback become visible to the correct student
- lecturer overrides are preserved and shown correctly

### 4. Moderation gating

Moderation protects fairness and quality assurance, so it needs strong tests.

Important cases:
- moderation cases can be created
- assigned moderators can see the case
- unassigned users cannot see the case
- moderated work cannot be released too early
- final agreed marks are recorded correctly
- escalation and return actions preserve audit history

### 5. Academic integrity review

Integrity features should support careful review, not automatic accusation.

Tests should confirm:
- integrity checks save results correctly
- cited overlap, uncited overlap, reference sections, and internal peer overlap are handled separately where applicable
- limited extraction quality is shown as limited analysis rather than false confidence
- lecturers can review and save integrity decisions
- students are not shown private integrity review records unless intentionally exposed

### 6. Student visibility rules

This deserves its own focus because mistakes here could damage trust.

Tests should confirm:
- students only see their own records
- students only see released grades
- students do not see other students' work, feedback, or support records
- improvement plans only show appropriate student-facing content
- private lecturer notes remain private

### 7. Early support signals and intervention tracking

The early support feature should remain explainable and lecturer-led.

Tests should confirm:
- support signals are calculated from assessment patterns as expected
- low averages, declining trends, sudden drops, inconsistent grades, and expected next outcomes are handled correctly
- students below the support threshold are not shown unnecessarily
- intervention notes can be logged
- follow-up reminders can be created
- student-facing support messages avoid harsh automated judgement language

### 8. Communication and notifications

Where the app creates messages or reminders, tests should confirm:
- the right recipient is used
- message content is appropriate
- sensitive internal notes are not included by mistake
- support messages remain human and non-accusatory

## Recommended Test Types

### Unit tests

Use unit tests for pure logic and helper functions.

Good candidates:
- risk/support signal calculation
- grade distribution calculation
- recommendation rules
- integrity scoring helpers
- role helper functions
- validation functions
- date and formatting helpers

Unit tests should be fast and should not need Supabase.

### Integration tests

Use integration tests for workflows where multiple pieces work together.

Good candidates:
- assignment creation with rubric data
- submission loading with related grades
- lecturer review state changes
- intervention logging
- moderation case assembly
- integrity result persistence

These tests should mock Supabase where needed, unless the test is deliberately checking database behaviour.

### End-to-end tests

Use Playwright for the most important user journeys.

Recommended E2E flows:
- lecturer creates or opens an assignment, reviews a submission, approves and releases feedback
- student can see released feedback but not unreleased feedback
- moderation blocks premature release
- lecturer runs or reviews an integrity workflow
- lecturer opens early support signals and creates a follow-up action

E2E tests should be fewer in number but high value.

## What Should Not Be Over-Tested

Avoid spending too much time testing:
- static page text that changes often
- visual layout details already covered by screenshots or manual review
- simple wrapper components with no logic
- third-party UI components
- implementation details that do not affect user behaviour

The test suite should protect trust and workflow correctness, not become a burden that slows every small UI improvement.

## Minimum Coverage Gates

A practical staged target would be:

### Stage 1: Current prototype hardening

- unit tests for critical logic
- E2E smoke tests for lecturer and student visibility
- build must pass before deployment

### Stage 2: Pilot readiness

- 80%+ coverage for critical logic modules
- E2E coverage for grading, release, moderation, integrity, and student visibility
- documented manual smoke checklist for live environment

### Stage 3: Institutional readiness

- broader role-boundary testing
- RLS policy validation
- monitoring in production
- regression tests for reported pilot issues
- test coverage reviewed before each release

## Suggested Priority Order

Start with the tests that reduce the biggest risk.

1. Student visibility rules
2. Grade approval and release workflow
3. Role access boundaries
4. Moderation gating
5. Integrity review persistence
6. Early support signal calculation
7. Intervention and follow-up logging
8. Analytics and recommendation cards

## Coverage Reporting

Coverage reports should be used as a guide, not as a vanity metric.

A useful coverage report should answer:
- are the critical workflows protected?
- are the main calculation functions tested?
- are role boundaries covered?
- are student-facing visibility rules tested?
- are the known risky areas improving over time?

## Example Coverage Target Statement

GradeAI aims for at least 80% test coverage across critical academic workflow paths, including authentication boundaries, grade review and release, moderation, academic integrity review, student visibility, and early support signals. Overall repository coverage may be lower during active prototyping, but high-risk workflows should be tested before pilot use.

## Summary

GradeAI's testing strategy should focus on trust.

The most important question is not whether every file has a test. The important question is whether a change could accidentally expose student data, release unreviewed grades, bypass moderation, misrepresent integrity evidence, or create harsh automated support messages.

Those are the areas that need the strongest protection.
