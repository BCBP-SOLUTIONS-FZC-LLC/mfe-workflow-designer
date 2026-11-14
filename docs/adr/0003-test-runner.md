# ADR 0003 — Keep Rstest

## Status

Accepted

## Decision

Tests stay on Rstest. Vitest depends on Vite. This remote was moved off Vite so the production build is Rsbuild only.

Unit and screen tests stay in `/test`, which is the layout used by the other remotes. They are not compiled into the remote bundle.

Playwright is not added in this pass. The critical studio journeys are covered by the React Testing Library suite.

## Consequences

The constitution's Vitest and `src/tests` lines are deferred until the platform picks one runner for every remote.
