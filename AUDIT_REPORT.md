# Repository Audit Report - GradeAI (edu-intel-spark)

**Audit Date:** April 24, 2026  
**Audit Type:** Current-state code quality, security, and repository hygiene review  
**Status:** Generally healthy with actionable improvements needed

---

## Executive Summary

GradeAI is a well-structured React + TypeScript + Supabase application with a healthy production build and a broad assessment workflow surface area. The codebase is in a materially better state after recent hygiene fixes. The main active concerns are loose TypeScript usage, missing validation in some input and AI-response paths, test coverage gaps, inconsistent logging patterns, and branch divergence between the audited working branch and `origin/main`.

**Overall Health Score: 7.6/10**

---

## Table of Contents

1. [Critical Issues](#critical-issues)
2. [High Priority Issues](#high-priority-issues)
3. [Medium Priority Issues](#medium-priority-issues)
4. [Resolved Issues](#resolved-issues)
5. [Architecture & Design](#architecture--design)
6. [Security Assessment](#security-assessment)
7. [Code Quality](#code-quality)
8. [Testing Coverage](#testing-coverage)
9. [Dependencies & Build](#dependencies--build)
10. [Recommendations](#recommendations)
11. [Metrics Summary](#metrics-summary)

---

## Critical Issues

No active critical issues were confirmed in this audit pass.

---

## High Priority Issues

### 1. 45+ `any` Type Instances Across the Codebase

**Severity:** High  
**Files:** 8+ high-impact files

**Detailed breakdown:**

| File | Count | Specific Lines | Impact |
|------|-------|----------------|--------|
| [AssignmentDetail.tsx](src/pages/dashboard/AssignmentDetail.tsx) | 11 | 106, 128, 157, 297, 330, 498, 567, 659, 802, 1569, 1598 | Grade breakdown, rubric typing |
| [ExplainGrade.tsx](src/pages/dashboard/ExplainGrade.tsx) | 4 | 99, 103, 119, 120 | Array types, iteration |
| [supabase/functions/_shared/openai.ts](supabase/functions/_shared/openai.ts) | 5 | 48, 54-57 | Response extraction |
| [LearningOutcomes.tsx](src/pages/dashboard/LearningOutcomes.tsx) | 3 | 85, 87, 324 | Badge variant casting |
| [src/components/ui/chart.tsx](src/components/ui/chart.tsx) | 2 | 94, 232 | Chart configuration |
| [src/test/](src/test/) | 2+ | Various | Mock data types |

**Example problem:**

```typescript
// Current
rubric: data.rubric as any[] | null,
breakdown: g.ai_breakdown as any[],

// Better
interface RubricCriterion {
  criterion: string;
  max_score: number;
  score?: number;
  feedback?: string;
}

interface GradeBreakdown {
  criterion: string;
  score: number;
  feedback: string;
}
```

**Impact:**
- weaker editor support
- greater refactor risk
- more runtime-shape assumptions in grading and dashboard flows

**Recommendation:**
1. Define shared data contracts in a central type module.
2. Remove `any` from the grading/dashboard path first.
3. Turn on or strengthen lint enforcement for explicit `any`.

---

### 2. Missing Input Validation

**Severity:** High  
**Files:** [src/components/BulkStudentUpload.tsx](src/components/BulkStudentUpload.tsx), [supabase/functions/check-plagiarism/index.ts](supabase/functions/check-plagiarism/index.ts)

**Issue:** Some CSV parsing, document extraction results, and AI/API response paths still rely on shape assumptions instead of explicit schema validation.

**Examples:**
- CSV parsing uses string manipulation without strong row validation
- document extraction output is processed without full runtime type checking
- AI/API payload handling still trusts expected shapes too early

**Recommendation:** Use the existing `zod` dependency more systematically for user input and external-response validation.

---

## Medium Priority Issues

### 1. Error Handling Type Safety

**Severity:** Medium

**Issue:** Error handling remains inconsistent across async flows, with some paths still reducing unknown failures to generic messages too early.

**Example:**

```typescript
catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
}
```

**Recommendation:** Standardize error normalization so network, response, parser, and runtime errors produce clearer telemetry and user-facing diagnostics.

---

### 2. Test Coverage Gaps

**Severity:** Medium

**Current state:**
- unit/integration coverage exists
- Playwright E2E coverage exists
- missing broader coverage for several dashboard pages
- missing deeper component integration tests
- missing more explicit error-path testing

**Uncovered areas include:**
- [LecturerOverview.tsx](src/pages/dashboard/LecturerOverview.tsx)
- [AccreditationDashboard.tsx](src/pages/dashboard/AccreditationDashboard.tsx)
- [ExternalExaminerExport.tsx](src/pages/dashboard/ExternalExaminerExport.tsx)
- student-facing explanation/profile paths
- failure and boundary scenarios

**Note:** `npm test` could not be fully validated in this sandbox because Vitest config loading hit `spawn EPERM`.

---

### 3. Logging and Observability Improvements

**Severity:** Medium

**Issue:** Logging exists in important paths, but patterns are inconsistent and not yet structured enough for reliable operational tracing.

**Current gaps:**
- no centralized structured logging approach
- limited request/response correlation for backend operations
- limited performance instrumentation

**Recommendation:** Standardize log structure and context fields before production-scale operational review.

---

### 4. Branch Divergence Note

**Severity:** Medium

**Issue:** The audited branch and `origin/main` are not currently aligned.

**Current state at audit time:**
- `cohort-recommendations-rpc-audit` has one commit not on `origin/main`
- `origin/main` has newer commits not present on the audited branch

**Impact:**
- audit conclusions depend on which branch is treated as canonical
- documentation and operational claims can drift across branches

**Recommendation:** Reconcile the branch state before treating a single audit report as the definitive project-wide position.

---

## Resolved Issues

### 1. Hardcoded PostHog Fallback Key Removed

**File:** [src/lib/posthog.ts](src/lib/posthog.ts#L12)  
**Status:** Resolved

The hardcoded PostHog fallback key was removed. Analytics now initialize only when `VITE_POSTHOG_KEY` is configured, and development mode shows a safe warning instead of silently using fallback credentials.

### 2. Temporary SQL Files Deleted

**Status:** Resolved

Temporary admin profile validation SQL files were removed from the repository and are no longer active audit items.

### 3. Unsafe `JSON.parse()` Protected With `try/catch`

**File:** [src/components/DashboardLayout.tsx](src/components/DashboardLayout.tsx#L150-L165)  
**Status:** Resolved

The local-storage parsing path now falls back safely when stored JSON is malformed, so this is no longer an active reliability issue.

---

## Architecture & Design

### Strengths

1. **Component organization**
   - Clear separation between feature components and UI primitives
   - Consistent dashboard layout structure
   - Good use of React composition patterns

2. **State management**
   - TanStack Query is used appropriately for server state
   - Context use is restrained and purposeful
   - Local state is used where global coordination is unnecessary

3. **Database and backend boundaries**
   - Supabase and Edge Functions provide clear boundaries for sensitive operations
   - RLS enforces important access rules at the database layer

4. **Assessment workflow scope**
   - The application covers grading, moderation, integrity review, reporting, and student-facing flows in a coherent product shape

### Ongoing concerns

1. **Business logic spread**
   - Important rules are split across frontend, backend functions, and database policy layers
   - This raises drift risk if rule changes are not documented centrally

2. **Validation boundaries**
   - Some external-response and upload paths still trust shape too early

---

## Security Assessment

### Security Strengths

| Item | Status | Notes |
|------|--------|-------|
| Secrets in code | PASS | No secret-like strings were confirmed in the current audit pass |
| `.env` handling | PASS | `.gitignore` covers `.env`, `.env.*`, `.supabase/`, and temp paths |
| Frontend env use | PASS | Frontend-safe `VITE_` variables remain in `.env.example` |
| Backend secrets | PASS | Backend secrets are documented as Supabase Secrets |
| RLS policies | PASS | Access control is enforced in the database layer |
| JWT/session handling | PASS | Supabase Auth remains the auth boundary |
| XSS prevention | PASS | No broad unsafe rendering pattern was surfaced in this audit pass |

### Security Concerns

1. **Demo mode behavior**
   - Safe in the current design, but should remain clearly documented

2. **Upload and extraction surfaces**
   - File and extracted-content paths should continue to receive careful validation attention

---

## Code Quality

The codebase is readable overall and split into sensible product areas. The largest quality drag remains type looseness in several high-impact files. The next most important improvement is better runtime validation around untrusted input and external responses.

---

## Testing Coverage

The repo has meaningful testing infrastructure, including Vitest and Playwright. The main gap is breadth rather than complete absence. More dashboard coverage and more failure-path testing would materially improve confidence in grading and reporting workflows.

---

## Dependencies & Build

- `npm run build` passed during this audit
- dependency versions appear broadly modern from the working tree
- no immediate dependency hygiene emergency was identified in this pass

---

## Recommendations

1. Remove high-impact `any` usage from grading and dashboard flows first.
2. Add stronger schema validation for uploads, extraction results, and AI/API responses.
3. Expand test coverage around dashboard behavior and error scenarios.
4. Standardize logging and error normalization for traceability.
5. Reconcile the audit branch with `origin/main` so the repo has one clear audit baseline.

---

## Metrics Summary

| Area | Status | Notes |
|------|--------|-------|
| Build | Healthy | `npm run build` passed |
| Tests in sandbox | Blocked | `npm test` hit `spawn EPERM` during Vitest config loading |
| Security hygiene | Good | No secret-like strings confirmed in tracked files during this audit |
| Type safety | Needs work | 45+ `any` usages remain |
| Validation | Needs work | Runtime validation is still incomplete in some flows |
| Observability | Moderate | Logging exists but is not yet standardized |
| Branch alignment | Needs attention | Audited branch and `origin/main` differ |
