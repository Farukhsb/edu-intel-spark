# Dependency Risk Report

This note records what we found when reviewing `npm audit` for the current GradeAI codebase.

It is not a claim that every dependency issue is solved. It is a record that the audit output was reviewed, the safe path was taken where possible, and the higher-risk toolchain changes were deliberately deferred instead of being applied blindly.

## Summary

`npm audit` reported dependency vulnerabilities in the project.

We intentionally did **not** run `npm audit fix --force`.

That matters because the forced path would upgrade major development tools like `jsdom`, `vite`, and possibly related `vitest` packages. Those packages sit at the centre of the build and test stack, so changing them automatically would create unnecessary risk.

The safer path was used first:

```bash
npm audit fix
```

After that, the remaining issues were all in development-only tooling rather than the shipped application runtime.

## What Was Fixed Safely

The earlier audit chain that included `protobufjs` had a safe, non-breaking fix path through `npm audit fix`.

That class of issue is the type we want to fix immediately when the lockfile can be updated without forcing major toolchain changes.

## What Still Remains

After the safe audit path, the remaining findings were:

### 1. `@tootallnate/once`

This vulnerability is not coming from GradeAI application code.

It is coming in through the testing stack:

- `jsdom`
- `http-proxy-agent`
- `@tootallnate/once`

This means it is a **development-only** dependency path.

`npm audit` recommends a forced fix that would move `jsdom` to a newer major version. That is not something we want to do casually on the main branch.

### 2. `esbuild`

This issue is also not coming from GradeAI application logic.

It is coming in through the frontend toolchain:

- `vite`
- `vite-node`
- `vitest`
- `esbuild`

This is also a **development-only** issue.

The advisory is relevant to the development server, not the built production bundle that gets deployed to users.

`npm audit` recommends a forced fix that would jump to a newer major Vite release. That is a real toolchain upgrade and should be handled in a controlled branch with compatibility testing.

## Why `npm audit fix --force` Was Not Used

`npm audit fix --force` was intentionally avoided.

The reason is simple: it would fix the audit warnings by upgrading core development tools across major versions, but it could also break:

- the build pipeline
- the test environment
- plugin compatibility
- local developer workflows

That is not a good trade if the remaining items are dev-only and can be handled in a planned upgrade cycle instead.

## Risk Position

Current position:

- safe non-breaking audit fixes: applied where available
- remaining issues: dev-only tooling
- production application code: unchanged
- database and backend logic: unchanged

This means the unresolved items are better understood as **toolchain maintenance work**, not unreviewed production defects.

## Operational Note

Because one of the remaining advisories affects the development server path, the dev server should not be exposed on untrusted networks.

In practice:

- use the dev server on trusted local machines
- avoid treating the dev server as an internet-facing service
- handle Vite toolchain upgrades in a separate controlled maintenance branch

## Recommended Next Steps

1. Keep the current safe fixes in place.
2. Track `jsdom` upgrade work in a dedicated maintenance branch.
3. Track `vite` and `vitest` upgrade work in a separate controlled toolchain branch.
4. Re-run:

```bash
npm run typecheck
npm run test
npm run build
```

after each planned toolchain upgrade rather than bundling all audit-driven changes together.

## Validation

After the dependency review work on this branch:

- `npm run typecheck` passed
- `npm run test` passed
- `npm run build` passed
