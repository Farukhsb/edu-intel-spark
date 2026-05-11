# Academic Compliance and AI Governance

## Purpose

GradeAI is designed as an academic workflow and decision-support platform rather than a fully autonomous grading system.

The purpose of this document is to explain how the platform approaches responsible AI use, lecturer oversight, student protection, transparency, and institutional governance considerations.

The goal is to support academic judgement, not replace it.

## Human-in-the-Loop Grading

GradeAI uses AI to support lecturers during assessment workflows.

AI-generated outputs are intended as draft academic support rather than final decisions.

The platform is designed so that lecturers can:

- review draft grades
- edit scores
- revise feedback
- approve outcomes
- release results when institutionally appropriate

This means academic judgement remains with the lecturer.

## Lecturer Final Authority

GradeAI is designed around a controlled release model.

Important workflow stages are intentionally separated:

```text
submitted
  -> AI grading
  -> lecturer review
  -> approval
  -> release
```

Approval and release are separate actions.

This separation helps reduce the risk of students seeing incomplete, draft, or unreviewed outcomes.

Students should only see released grades and approved feedback.

## Transparency and Explainability

The platform attempts to make grading easier to inspect and review.

Features supporting transparency include:

- rubric-based grading rather than free-form scoring
- criterion-level feedback
- lecturer review before release
- moderation support for difficult or borderline cases
- stored grading metadata and workflow history
- student-facing explanation support after release

The intention is to make grading easier to understand and review rather than presenting AI outputs as unquestionable decisions.

## Academic Integrity Safeguards

Integrity workflows are intended as review aids.

Integrity signals may include:

- internal similarity between submissions
- AI-writing indicators
- overlap patterns requiring lecturer attention

These signals are not proof of misconduct.

The platform is designed to support lecturer review and academic judgement rather than automatic disciplinary action.

## Data Protection and Privacy Considerations

Because GradeAI may process student submissions, grades, and educational records, privacy and data protection considerations are important.

The platform is designed with the expectation that institutions may require:

- clear data retention rules
- role-based access controls
- secure authentication
- auditability
- institutional review of data flows
- compliance with UK GDPR or equivalent institutional policies

Sensitive academic data should not be publicly exposed, and student-facing access should remain role-bound and release-controlled.

## Role-Based Access and Security

The system uses role-based access patterns to separate permissions across:

- students
- lecturers
- moderators
- admins

Protected areas include:

- unreleased grades
- draft feedback
- moderation workflows
- integrity review outputs
- student support records

The platform also uses row-level access patterns and server-side role checks to reduce inappropriate access.

## Auditability

Academic decisions often need to be reviewable.

GradeAI therefore attempts to support auditability through:

- moderation records
- workflow states
- lecturer review actions
- approval and release separation
- stored grading metadata
- intervention and support history

This supports institutional quality assurance and moderation practices.

## Institutional Adoption Considerations

Universities may have additional governance requirements before adopting AI-assisted assessment tools.

Typical concerns may include:

- GDPR and student privacy
- data residency requirements
- academic integrity policy alignment
- model transparency
- lecturer accountability
- intellectual property concerns around student submissions
- acceptable AI use policies

Institutions may therefore require local policy review before live deployment.

## Current Limitations

GradeAI should currently be understood as an early controlled pilot rather than a mature institution-wide deployment.

Current limitations include:

- institutional compliance requirements vary between universities
- AI grading consistency can vary on borderline work
- some governance outcomes depend on deployment configuration and institutional policy
- lecturer review remains necessary for safe academic use

## Summary

GradeAI is intended to support academic workflows responsibly.

The platform is designed around:

- lecturer oversight
- human review before release
- transparency and explainability
- moderation support
- integrity review assistance
- role-based access
- auditability

The platform should be understood as a decision-support system for higher education rather than a replacement for academic judgement.