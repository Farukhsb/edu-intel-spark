import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModerationCaseView } from "@/lib/moderationWorkflow";
import {
  cleanupModerationDashboardMocks,
  renderModerationDashboard,
} from "@/test/helpers/renderModerationDashboard";

const baseCase = {
  moderationCase: {
    id: "case-1",
    submission_id: "submission-1",
    assignment_id: "assignment-1",
    grade_id: "grade-1",
    lecturer_id: "lecturer-1",
    first_marker_id: "lecturer-1",
    moderator_id: null,
    status: "moderation_pending",
    trigger_flags: [],
    trigger_summary: null,
    confidence_score: 0.62,
    integrity_risk_score: null,
    ai_score_snapshot: 61,
    first_marker_score: 67,
    moderator_score: null,
    final_agreed_score: null,
    final_agreed_feedback: null,
    approved_at: null,
    moderated_at: null,
    created_at: "2026-04-22T10:00:00.000Z",
    updated_at: "2026-04-22T10:00:00.000Z",
  },
  grade: {
    id: "grade-1",
    submission_id: "submission-1",
    ai_score: 61,
    ai_feedback: "AI feedback",
    ai_breakdown: [],
    assignment_type: null,
    created_at: "2026-04-22T10:00:00.000Z",
    final_feedback: null,
    final_score: null,
    grading_confidence: 0.62,
    grading_metadata: {},
    lecturer_feedback: "Lecturer feedback",
    lecturer_score: 67,
    reviewed_at: null,
    reviewed_by: null,
  },
  firstMarker: {
    id: "lecturer-1",
    full_name: "Dr. Ada Lecturer",
    email: "lecturer@gradeai.test",
    role: "lecturer",
    avatar_url: null,
    cohort_id: null,
    department_name: "Computer Science",
    department_id: null,
    must_change_password: false,
    created_at: "2026-04-22T10:00:00.000Z",
    updated_at: "2026-04-22T10:00:00.000Z",
  },
  moderator: null,
  integrityReview: null,
  reviews: [],
  auditLog: [],
} satisfies Omit<ModerationCaseView, "submission" | "assignment">;

describe("ModerationDashboard integration", () => {
  afterEach(() => {
    cleanup();
    cleanupModerationDashboardMocks();
  });

  it("shows fallback moderation text and disables review when submission is unavailable", async () => {
    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      cases: [
        {
          ...baseCase,
          submission: null,
          assignment: null,
        },
      ],
    });

    const caseRow = await screen.findByTestId("moderation-case-case-1", {}, { timeout: 15000 });
    const openButton = within(caseRow).getByTestId("moderation-review-open-case-1");

    expect(caseRow).toHaveTextContent("Student record unavailable");
    expect(caseRow).toHaveTextContent("Assignment");
    expect(openButton).toBeDisabled();
  }, 20000);

  it("shows live moderation text and enables review when submission and assignment are available", async () => {
    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      cases: [
        {
          ...baseCase,
          submission: {
            id: "submission-1",
            assignment_id: "assignment-1",
            student_name: "Sarah Student",
            student_email: "sarah@student.test",
            student_id: "student-1",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-1/assignment-1/essay.pdf",
            status: "moderation_pending",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-1",
          },
          assignment: {
            id: "assignment-1",
            title: "Policy Case Study",
            description: "Policy analysis",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL305",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
      ],
    });

    const caseRow = await screen.findByTestId("moderation-case-case-1", {}, { timeout: 15000 });
    const openButton = within(caseRow).getByTestId("moderation-review-open-case-1");

    expect(caseRow).toHaveTextContent("Sarah Student");
    expect(caseRow).toHaveTextContent("Policy Case Study");
    expect(openButton).toBeEnabled();
  }, 20000);

  it("shows moderation evidence context instead of only scores and notes", async () => {
    await renderModerationDashboard({
      auth: {
        user: { id: "moderator-1", email: "moderator@gradeai.test" },
        profile: { id: "moderator-1", role: "lecturer" },
      },
      cases: [
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            moderator_id: "moderator-1",
            status: "moderation_in_progress",
            integrity_risk_score: 61,
          },
          submission: {
            id: "submission-1",
            assignment_id: "assignment-1",
            student_name: "Sarah Student",
            student_email: "sarah@student.test",
            student_id: "student-1",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-1/assignment-1/essay.pdf",
            status: "moderation_in_progress",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-1",
          },
          assignment: {
            id: "assignment-1",
            title: "Policy Case Study",
            description: "Policy analysis",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL305",
            rubric: [
              {
                criterion: "Argument quality",
                description: "Use evidence to defend the policy position.",
                max_score: 40,
              },
            ],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
          integrityReview: {
            id: "integrity-1",
            submission_id: "submission-1",
            lecturer_id: "lecturer-1",
            review_type: "plagiarism_screen",
            decision: "review_required",
            evidence_summary: "High overlap with one source paragraph.",
            lecturer_note: "Check whether the citation is adequate.",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          } as never,
          grade: {
            ...baseCase.grade,
            ai_feedback: "AI found a solid structure but weak evidence.",
            lecturer_feedback: "Marker noted the same weakness in supporting evidence.",
            ai_breakdown: [
              {
                criterion: "Argument quality",
                score: 24,
                max_score: 40,
                evidence_snippet: "The policy claim is stated, but evidence is thin.",
                confidence_score: 0.64,
                review_required: true,
              },
            ],
          },
        },
      ],
    });

    const caseRow = await screen.findByTestId("moderation-case-case-1", {}, { timeout: 15000 });
    fireEvent.click(within(caseRow).getByTestId("moderation-review-open-case-1"));

    const dialog = await screen.findByTestId("moderation-review-dialog");
    expect(within(dialog).getByText("Submission Evidence")).toBeInTheDocument();
    expect(within(dialog).getByText("Open submission file")).toBeInTheDocument();
    expect(within(dialog).getByText("Rubric")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Argument quality").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Marking Evidence")).toBeInTheDocument();
    expect(within(dialog).getByText("AI rationale")).toBeInTheDocument();
    expect(within(dialog).getByText("First marker rationale")).toBeInTheDocument();
    expect(within(dialog).getByText("Integrity Context")).toBeInTheDocument();
    expect(within(dialog).getByText("High overlap with one source paragraph.")).toBeInTheDocument();
    expect(within(dialog).getByText("AI breakdown")).toBeInTheDocument();
  }, 20000);

  it("filters the queue into assigned, approval, escalated, and release-ready views", async () => {
    await renderModerationDashboard({
      auth: {
        user: { id: "moderator-1", email: "moderator@gradeai.test" },
        profile: { id: "moderator-1", role: "lecturer" },
      },
      cases: [
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-assigned",
            moderator_id: "moderator-1",
            status: "moderation_in_progress",
          },
          submission: {
            id: "submission-assigned",
            assignment_id: "assignment-1",
            student_name: "Assigned Student",
            student_email: "assigned@student.test",
            student_id: "student-1",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-1/assignment-1/essay.pdf",
            status: "moderation_in_progress",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-1",
          },
          assignment: {
            id: "assignment-1",
            title: "Assigned Case",
            description: "Assigned case",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL305",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-approval",
            lecturer_id: "moderator-1",
            moderator_id: "moderator-2",
            status: "moderated",
            final_agreed_score: 67,
          },
          submission: {
            id: "submission-approval",
            assignment_id: "assignment-2",
            student_name: "Approval Student",
            student_email: "approval@student.test",
            student_id: "student-2",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-2/assignment-2/essay.pdf",
            status: "moderated",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-2",
          },
          assignment: {
            id: "assignment-2",
            title: "Approval Case",
            description: "Approval case",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "moderator-1",
            max_score: 100,
            module_code: "POL306",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-escalated",
            lecturer_id: "moderator-1",
            moderator_id: "moderator-2",
            status: "escalated",
          },
          submission: {
            id: "submission-escalated",
            assignment_id: "assignment-3",
            student_name: "Escalated Student",
            student_email: "escalated@student.test",
            student_id: "student-3",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-3/assignment-3/essay.pdf",
            status: "escalated",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-3",
          },
          assignment: {
            id: "assignment-3",
            title: "Escalated Case",
            description: "Escalated case",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "moderator-1",
            max_score: 100,
            module_code: "POL307",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-ready",
            lecturer_id: "moderator-1",
            moderator_id: "moderator-2",
            status: "moderated",
            final_agreed_score: 68,
            approved_at: "2026-04-22T11:00:00.000Z",
          },
          submission: {
            id: "submission-ready",
            assignment_id: "assignment-4",
            student_name: "Ready Student",
            student_email: "ready@student.test",
            student_id: "student-4",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-4/assignment-4/essay.pdf",
            status: "approved",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-4",
          },
          assignment: {
            id: "assignment-4",
            title: "Ready Case",
            description: "Ready case",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "moderator-1",
            max_score: 100,
            module_code: "POL308",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
      ],
    });

    await screen.findByTestId("moderation-case-case-assigned", {}, { timeout: 15000 });

    fireEvent.click(screen.getByTestId("moderation-filter-assigned_to_me"));
    expect(screen.getByTestId("moderation-case-case-assigned")).toBeInTheDocument();
    expect(screen.queryByTestId("moderation-case-case-approval")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("moderation-filter-awaiting_my_approval"));
    expect(screen.getByTestId("moderation-case-case-approval")).toBeInTheDocument();
    expect(screen.queryByTestId("moderation-case-case-assigned")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("moderation-filter-escalated"));
    expect(screen.getByTestId("moderation-case-case-escalated")).toBeInTheDocument();
    expect(screen.queryByTestId("moderation-case-case-approval")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("moderation-filter-ready_for_release"));
    expect(screen.getByTestId("moderation-case-case-ready")).toBeInTheDocument();
    expect(screen.queryByTestId("moderation-case-case-escalated")).not.toBeInTheDocument();
  }, 20000);

  it("searches moderation cases by student, assignment, and moderator context", async () => {
    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      cases: [
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-search-1",
            moderator_id: "moderator-1",
          },
          submission: {
            id: "submission-search-1",
            assignment_id: "assignment-1",
            student_name: "Leah Search",
            student_email: "leah@student.test",
            student_id: "student-1",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-1/assignment-1/essay.pdf",
            status: "moderation_pending",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-1",
          },
          assignment: {
            id: "assignment-1",
            title: "Comparative Politics Essay",
            description: "Essay",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL305",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
          moderator: {
            id: "moderator-1",
            full_name: "Morgan Moderator",
            email: "moderator@gradeai.test",
            role: "lecturer",
            avatar_url: null,
            cohort_id: null,
            department_id: null,
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          } as never,
        },
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-search-2",
          },
          submission: {
            id: "submission-search-2",
            assignment_id: "assignment-2",
            student_name: "Noah Different",
            student_email: "noah@student.test",
            student_id: "student-2",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-2/assignment-2/essay.pdf",
            status: "moderation_pending",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-2",
          },
          assignment: {
            id: "assignment-2",
            title: "International Law Memo",
            description: "Memo",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "LAW301",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
      ],
    });

    await screen.findByTestId("moderation-case-case-search-1", {}, { timeout: 15000 });

    fireEvent.change(screen.getByTestId("moderation-queue-search"), {
      target: { value: "morgan moderator" },
    });
    expect(screen.getByTestId("moderation-case-case-search-1")).toBeInTheDocument();
    expect(screen.queryByTestId("moderation-case-case-search-2")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("moderation-queue-search"), {
      target: { value: "international law" },
    });
    expect(screen.getByTestId("moderation-case-case-search-2")).toBeInTheDocument();
    expect(screen.queryByTestId("moderation-case-case-search-1")).not.toBeInTheDocument();
  }, 20000);

  it("shows owner follow-up summaries grouped by assignment for release-ready and escalated cases", async () => {
    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      cases: [
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-owner-ready",
            assignment_id: "assignment-1",
            lecturer_id: "lecturer-1",
            status: "moderated",
            approved_at: "2026-04-22T11:00:00.000Z",
          },
          submission: {
            id: "submission-owner-ready",
            assignment_id: "assignment-1",
            student_name: "Ready Student",
            student_email: "ready@student.test",
            student_id: "student-1",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-1/assignment-1/essay.pdf",
            status: "approved",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-1",
          },
          assignment: {
            id: "assignment-1",
            title: "Assignment Alpha",
            description: "Alpha",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL305",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-owner-escalated-alpha",
            assignment_id: "assignment-1",
            lecturer_id: "lecturer-1",
            status: "escalated",
          },
          submission: {
            id: "submission-owner-escalated-alpha",
            assignment_id: "assignment-1",
            student_name: "Escalated Student Alpha",
            student_email: "escalated-alpha@student.test",
            student_id: "student-2",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-2/assignment-1/essay.pdf",
            status: "escalated",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-2",
          },
          assignment: {
            id: "assignment-1",
            title: "Assignment Alpha",
            description: "Alpha",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL305",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-owner-escalated-beta",
            assignment_id: "assignment-2",
            lecturer_id: "lecturer-1",
            status: "escalated",
          },
          submission: {
            id: "submission-owner-escalated-beta",
            assignment_id: "assignment-2",
            student_name: "Escalated Student Beta",
            student_email: "escalated-beta@student.test",
            student_id: "student-3",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-3/assignment-2/essay.pdf",
            status: "escalated",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-3",
          },
          assignment: {
            id: "assignment-2",
            title: "Assignment Beta",
            description: "Beta",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL306",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-other-owner-ready",
            assignment_id: "assignment-3",
            lecturer_id: "lecturer-2",
            status: "moderated",
            approved_at: "2026-04-22T11:00:00.000Z",
          },
          submission: {
            id: "submission-other-owner-ready",
            assignment_id: "assignment-3",
            student_name: "Other Owner Student",
            student_email: "other-owner@student.test",
            student_id: "student-4",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-4/assignment-3/essay.pdf",
            status: "approved",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-4",
          },
          assignment: {
            id: "assignment-3",
            title: "Assignment Gamma",
            description: "Gamma",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-2",
            max_score: 100,
            module_code: "POL307",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
      ],
    });

    const summary = await screen.findByTestId("moderation-owner-assignment-summary", {}, { timeout: 15000 });
    expect(within(summary).getByTestId("moderation-owner-assignment-assignment-1")).toHaveTextContent(
      "Assignment Alpha",
    );
    expect(within(summary).getByTestId("moderation-owner-assignment-assignment-1")).toHaveTextContent(
      "Ready for release: 1 | Escalated disputes: 1",
    );
    expect(within(summary).getByTestId("moderation-owner-assignment-assignment-2")).toHaveTextContent(
      "Assignment Beta",
    );
    expect(within(summary).getByTestId("moderation-owner-assignment-assignment-2")).toHaveTextContent(
      "Ready for release: 0 | Escalated disputes: 1",
    );
    expect(within(summary).queryByTestId("moderation-owner-assignment-assignment-3")).not.toBeInTheDocument();
  }, 20000);

  it("lets the owner focus the queue on one assignment from the follow-up summary", async () => {
    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      cases: [
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-focus-alpha-ready",
            assignment_id: "assignment-1",
            lecturer_id: "lecturer-1",
            status: "moderated",
            approved_at: "2026-04-22T11:00:00.000Z",
          },
          submission: {
            id: "submission-focus-alpha-ready",
            assignment_id: "assignment-1",
            student_name: "Alpha Ready",
            student_email: "alpha-ready@student.test",
            student_id: "student-1",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-1/assignment-1/essay.pdf",
            status: "approved",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-1",
          },
          assignment: {
            id: "assignment-1",
            title: "Assignment Alpha",
            description: "Alpha",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL305",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-focus-alpha-escalated",
            assignment_id: "assignment-1",
            lecturer_id: "lecturer-1",
            status: "escalated",
          },
          submission: {
            id: "submission-focus-alpha-escalated",
            assignment_id: "assignment-1",
            student_name: "Alpha Escalated",
            student_email: "alpha-escalated@student.test",
            student_id: "student-2",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-2/assignment-1/essay.pdf",
            status: "escalated",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-2",
          },
          assignment: {
            id: "assignment-1",
            title: "Assignment Alpha",
            description: "Alpha",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL305",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-focus-beta-escalated",
            assignment_id: "assignment-2",
            lecturer_id: "lecturer-1",
            status: "escalated",
          },
          submission: {
            id: "submission-focus-beta-escalated",
            assignment_id: "assignment-2",
            student_name: "Beta Escalated",
            student_email: "beta-escalated@student.test",
            student_id: "student-3",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-3/assignment-2/essay.pdf",
            status: "escalated",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-3",
          },
          assignment: {
            id: "assignment-2",
            title: "Assignment Beta",
            description: "Beta",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL306",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
      ],
    });

    await screen.findByTestId("moderation-owner-assignment-summary", {}, { timeout: 15000 });

    fireEvent.click(screen.getByTestId("moderation-owner-assignment-open-assignment-1"));

    expect(screen.getByTestId("moderation-case-case-focus-alpha-ready")).toBeInTheDocument();
    expect(screen.getByTestId("moderation-case-case-focus-alpha-escalated")).toBeInTheDocument();
    expect(screen.queryByTestId("moderation-case-case-focus-beta-escalated")).not.toBeInTheDocument();
    expect(screen.getByTestId("moderation-clear-assignment-focus")).toBeInTheDocument();
    expect(screen.getByText(/Focused on assignment:/)).toHaveTextContent("Assignment Alpha");

    fireEvent.click(screen.getByTestId("moderation-clear-assignment-focus"));

    expect(screen.getByTestId("moderation-case-case-focus-beta-escalated")).toBeInTheDocument();
  }, 20000);

  it("jumps from the owner summary straight into ready or escalated cases for one assignment", async () => {
    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      cases: [
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-jump-alpha-ready",
            assignment_id: "assignment-1",
            lecturer_id: "lecturer-1",
            status: "moderated",
            approved_at: "2026-04-22T11:00:00.000Z",
          },
          submission: {
            id: "submission-jump-alpha-ready",
            assignment_id: "assignment-1",
            student_name: "Alpha Ready",
            student_email: "alpha-ready@student.test",
            student_id: "student-1",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-1/assignment-1/essay.pdf",
            status: "approved",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-1",
          },
          assignment: {
            id: "assignment-1",
            title: "Assignment Alpha",
            description: "Alpha",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL305",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-jump-alpha-escalated",
            assignment_id: "assignment-1",
            lecturer_id: "lecturer-1",
            status: "escalated",
          },
          submission: {
            id: "submission-jump-alpha-escalated",
            assignment_id: "assignment-1",
            student_name: "Alpha Escalated",
            student_email: "alpha-escalated@student.test",
            student_id: "student-2",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-2/assignment-1/essay.pdf",
            status: "escalated",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-2",
          },
          assignment: {
            id: "assignment-1",
            title: "Assignment Alpha",
            description: "Alpha",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL305",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-jump-beta-escalated",
            assignment_id: "assignment-2",
            lecturer_id: "lecturer-1",
            status: "escalated",
          },
          submission: {
            id: "submission-jump-beta-escalated",
            assignment_id: "assignment-2",
            student_name: "Beta Escalated",
            student_email: "beta-escalated@student.test",
            student_id: "student-3",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-3/assignment-2/essay.pdf",
            status: "escalated",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-3",
          },
          assignment: {
            id: "assignment-2",
            title: "Assignment Beta",
            description: "Beta",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL306",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
      ],
    });

    await screen.findByTestId("moderation-owner-assignment-summary", {}, { timeout: 15000 });

    fireEvent.click(screen.getByTestId("moderation-owner-assignment-ready-assignment-1"));
    expect(screen.getByTestId("moderation-case-case-jump-alpha-ready")).toBeInTheDocument();
    expect(screen.queryByTestId("moderation-case-case-jump-alpha-escalated")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("moderation-owner-assignment-escalated-assignment-1"));
    expect(screen.getByTestId("moderation-case-case-jump-alpha-escalated")).toBeInTheDocument();
    expect(screen.queryByTestId("moderation-case-case-jump-alpha-ready")).not.toBeInTheDocument();
    expect(screen.queryByTestId("moderation-case-case-jump-beta-escalated")).not.toBeInTheDocument();
  }, 20000);

  it("opens the assignment release workflow from ready moderation cases", async () => {
    const navigateSpy = vi.fn();

    await renderModerationDashboard({
      auth: {
        user: { id: "lecturer-1", email: "lecturer@gradeai.test" },
        profile: { id: "lecturer-1", role: "lecturer" },
      },
      navigateSpy,
      cases: [
        {
          ...baseCase,
          moderationCase: {
            ...baseCase.moderationCase,
            id: "case-release-alpha",
            assignment_id: "assignment-1",
            lecturer_id: "lecturer-1",
            status: "moderated",
            approved_at: "2026-04-22T11:00:00.000Z",
          },
          submission: {
            id: "submission-release-alpha",
            assignment_id: "assignment-1",
            student_name: "Release Ready Student",
            student_email: "release@student.test",
            student_id: "student-1",
            file_name: "essay.pdf",
            file_type: "application/pdf",
            file_url: "student-1/assignment-1/essay.pdf",
            status: "approved",
            submitted_at: "2026-04-22T09:00:00.000Z",
            uploaded_by: "student-1",
          },
          assignment: {
            id: "assignment-1",
            title: "Assignment Alpha",
            description: "Alpha",
            due_date: "2026-04-20T09:00:00.000Z",
            file_url: null,
            lecturer_id: "lecturer-1",
            max_score: 100,
            module_code: "POL305",
            rubric: [],
            status: "published",
            created_at: "2026-04-22T10:00:00.000Z",
            updated_at: "2026-04-22T10:00:00.000Z",
          },
        },
      ],
    });

    await screen.findByTestId("moderation-owner-assignment-summary", {}, { timeout: 15000 });

    fireEvent.click(screen.getByTestId("moderation-owner-assignment-release-assignment-1"));
    expect(navigateSpy).toHaveBeenCalledWith("/dashboard/assignments/assignment-1?source=moderation&focus=release-ready");

    fireEvent.click(screen.getByTestId("moderation-open-release-case-release-alpha"));
    expect(navigateSpy).toHaveBeenCalledWith("/dashboard/assignments/assignment-1?source=moderation&focus=release-ready");
  }, 20000);
});
