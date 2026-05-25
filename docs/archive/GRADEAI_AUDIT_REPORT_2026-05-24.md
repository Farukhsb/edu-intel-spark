# GradeAI Audit Report (May 24, 2026)

## Scope

- Repository-wide static review of project structure, scripts, and key operational docs.
- Baseline quality checks:
  - `npm run lint`
  - `npm run typecheck`
  - `npm audit --omit=dev`

## Executive Summary

The codebase is mature and thoughtfully documented, with strong separation
across frontend, Supabase edge functions, and migration history. The most
immediate improvement was to restore a clean TypeScript baseline. That issue has
since been fixed on `main`.

## Findings

### 1. TypeScript baseline was broken at audit time (high priority)

- **Evidence**: `npm run typecheck` failed with `TS2322` in `src/lib/roles.ts`.
- **Impact**: Increased risk of role-parsing regressions reaching production and weakened CI confidence.
- **Recommendation**:
  - Keep strict type narrowing in role parsers.
  - Add a focused unit test for `parseAppRole` for `undefined`, `null`, invalid strings, and valid roles.
- **Follow-up**:
  - Fixed on `main` in commit `3bc8531` (`Fix role parser type narrowing`).

### 2. Security audit workflow is fragile in this environment (medium priority)

- **Evidence**: `npm audit --omit=dev` returned `403 Forbidden` from the npm advisory bulk endpoint.
- **Impact**: Leaves security triage dependent on environment/network policy and may hide actionable CVEs.
- **Recommendation**:
  - Add a fallback security workflow in CI (for example, GitHub Dependabot alerts plus scheduled lockfile checks).
  - Document expected behavior and fallback process in `docs/TESTING.md` or `docs/OPERATIONAL_RUNBOOK.md`.
- **Follow-up**:
  - Documented on `main` in commit `e5602b9` (`Clarify testing and operational docs`).

### 3. Large and security-sensitive SQL migration surface (medium priority)

- **Evidence**: substantial migration footprint under `supabase/migrations/`.
- **Impact**: Drift risk and policy/regression complexity for RLS and security-definer functions.
- **Recommendation**:
  - Add a lightweight migration index that tags each migration by concern (RLS, grants, auth, analytics).
  - Add a periodic policy snapshot check to validate expected role capabilities after migration runs.

### 4. Good documentation footprint, but audit artifacts are distributed (low/medium priority)

- **Evidence**: security and architecture docs exist across `docs/` and `docs/archive/`.
- **Impact**: New contributors may miss which guidance is current versus historical.
- **Recommendation**:
  - Add a `docs/CURRENT_STATE_INDEX.md` linking to canonical, active docs for security, deployment, testing, and architecture.
  - Explicitly label archived docs as superseded where applicable.
- **Follow-up**:
  - `docs/CURRENT_STATE_INDEX.md` added on `main` in commit `e5602b9`.

## Suggested 30-Day Improvement Plan

1. **Week 1**: enforce clean typecheck in CI branch protection and add role-parser tests.
2. **Week 2**: add security audit fallback process plus docs update.
3. **Week 3**: produce migration concern index and policy snapshot checklist.
4. **Week 4**: consolidate active versus archive documentation navigation.

## Notes

This audit intentionally focused on repository-level reliability and operational
risk reduction opportunities rather than feature-level UX changes.
