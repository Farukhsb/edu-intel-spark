# GradeAI Presentation Script

## 2-Minute Version

GradeAI is an academic intelligence platform designed to support university marking workflows.

The problem it addresses is straightforward: marking is slow, repetitive, and often difficult to audit. Lecturers are expected to grade consistently, justify decisions against a rubric, review academic integrity concerns, and still release feedback on time.

This project does not try to replace lecturer judgement. Instead, it places AI inside a controlled workflow.

The system takes a submission, extracts usable text, grades it against a rubric, validates the structure of the AI response, applies fairness and consistency checks, and then returns the result for lecturer review before approval and release.

One of the key technical decisions in the project was to avoid treating AI output as automatically trustworthy. For example, fairness recalibration is now blocked for off-topic or wrong-task submissions, so non-relevant work cannot be raised into a passing band just because the writing sounds competent.

The platform also includes academic integrity review, moderation support, and an audit trail, so the process around the mark is visible rather than hidden.

Technically, the system uses React on the frontend, Supabase for auth, database, storage, and Edge Functions, and an LLM integration for grading and explanation features.

My contribution covered both design and implementation: I built the workflow, grading controls, validation layers, and frontend integration.

The main impact of the project is that it shows how AI can be used to reduce marking workload while keeping transparency, lecturer control, and academic accountability in place.
