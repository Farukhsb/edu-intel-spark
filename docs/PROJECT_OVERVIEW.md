# GradeAI Project Overview

## Project Overview

GradeAI was built to reduce the time lecturers spend marking assignments while improving consistency, transparency, and reviewability.

The project focuses on a practical problem in higher education: marking is repetitive, time-consuming, and difficult to audit when large numbers of submissions are involved. Many existing AI marking tools produce a score, but do not make the reasoning process clear enough for academic use.

GradeAI takes a workflow-first approach. Instead of treating AI output as a final decision, the system places AI inside a structured academic process:

- rubric-based grading
- evidence-backed feedback
- academic integrity review
- lecturer review before approval
- explicit release controls
- auditability through stored grading and moderation history

The goal is to support academic judgement, not replace it.

## Project Origin And Technical Ownership

GradeAI began as a rapid prototype while I was experimenting with AI-assisted development tools. I initially used Lovable to test the product concept quickly and explore whether an AI-assisted academic workflow could be useful for lecturers.

As the idea developed, I recognised the limitations of relying on a generated prototype. I moved the project into a GitHub-controlled full-stack codebase and took responsibility for the architecture, implementation, database model, authentication, Supabase integration, Edge Functions, AI workflow, testing, documentation, CI pipeline, and deployment process.

That transition was important because GradeAI needed to become more than a visual prototype. It needed clear role boundaries, secure data access, human-in-the-loop review, AI response validation, academic integrity safeguards, and a controlled release workflow.

## Risk Controls And Trust Safeguards

The system includes several controls to reduce the risk of unreliable or misleading AI output.

- Rubric-based grading: marks are generated against assignment criteria rather than free-form impressions.
- Backend validation: grading responses are checked for structural consistency before they are saved.
- Fairness recalibration: score adjustments only apply when the submission is relevant to the assignment brief.
- Relevance gate: off-topic or wrong-task submissions are blocked from being boosted into passing bands.
- Lecturer review: AI output is not treated as final; staff can review, edit, approve, or override marks.
- Moderation support: the workflow supports further review where required.
- Audit trail: grading metadata and review decisions are stored so the process can be inspected later.

These controls matter because the project is not simply generating feedback with AI. It is trying to make AI usable inside a real academic decision process.

## Architecture Summary

At a high level, the system works as follows:

```text
React frontend
  -> Supabase Auth / Database / Storage
  -> Edge Functions
  -> AI model layer
  -> validated grading and integrity results
  -> lecturer review workflow
```

Main grading flow:

```text
submission
  -> document extraction
  -> rubric-based AI grading
  -> backend validation
  -> fairness and consistency checks
  -> lecturer review
  -> approval
  -> release
```

## My Contribution

My work on the project included both system design and implementation.

- Designed the end-to-end assessment workflow.
- Built the AI grading pipeline around rubric-based marking rather than a single black-box score.
- Implemented fairness validation and recalibration controls.
- Added relevance gating so off-topic work cannot be boosted into passing bands.
- Built academic integrity review flows and supporting Edge Function logic.
- Added request-boundary validation and safer response handling for Edge Functions.
- Built lecturer and student dashboard workflows in the React frontend.
- Improved auditability through grading metadata, moderation support, and workflow state handling.

## Limitations

The project is stronger than a prototype UI, but it still has practical limitations.

- AI judgement can still vary on borderline work, even with validation and caching.
- Document extraction quality can limit grading and integrity analysis for poor scans or malformed files.
- The platform still depends on lecturer oversight for final academic judgement.
- Some operational assurance depends on deployment configuration, not code alone.
- Test execution in restricted environments can be limited by local sandboxing constraints.

## Future Work

The next improvements should focus on reliability and operational depth rather than adding more visible features.

- Expand automated test coverage for Edge Function grading and integrity cases.
- Add more assignment-specific relevance checking for specialist modules.
- Improve extraction quality handling for difficult PDFs and scanned documents.
- Add clearer lecturer-facing explanations for recalibration and review flags.
- Extend benchmarking with more real marking examples across modules.

## Impact

Even in its current form, the project demonstrates clear practical value.

- reduces lecturer marking workload
- improves consistency of first-pass AI marking
- keeps a human decision point before grades are released
- makes grading decisions easier to inspect and explain
- supports moderation and academic integrity review in the same workflow
