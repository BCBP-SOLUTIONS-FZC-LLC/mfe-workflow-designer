# Workflow designer against the Frontend Architecture Constitution 1.0

Assessment of the unreleased remote (`package.json` `0.0.0`, SDK `1.0.0-alpha.6`). Decisions are in [docs/adr](../adr/README.md).

## Status

The studio is a domain remote. The shell owns sign-in and mounts `./App`. The layers, use cases, catalogue cache, and client UI store are in place. What remains is waiting on a platform package, a workflow API, or a shared test runner.

## 1. Assessment

| Constitution area | Status | Evidence |
|---|---|---|
| Domain ownership | Met | BPMN, versions, modules, and starters. No tender or contract rules |
| Project structure | Met | `src/app`, `presentation`, `application`, `domain`, `infrastructure`, `shared` |
| Dependency direction | Met | Screens call application queries and use cases. Domain rules do not import React or storage |
| Server state | Met, [ADR 0004](../adr/0004-server-state.md) | TanStack Query over `StudioRepository`. The repository is SDK storage, not HTTP |
| Client state | Met, [ADR 0004](../adr/0004-server-state.md) | Zustand for filters, search, gallery, the open diagram, and the version diff |
| API access | Open | No workflow HTTP API. Writes go through the storage port |
| Runtime configuration | Met | Standalone reads `/config/runtime.json` through the SDK |
| Module Federation | Met | Remote `workflows`, expose `./App`, shell singletons for React and the SDK |
| Authentication | Met, [ADR 0002](../adr/0002-platform-sdk.md) | The shell owns Keycloak. Writes use `update:tender` and `useReadOnly()` |
| Design system | Open, [ADR 0002](../adr/0002-platform-sdk.md) | `platform-design-system` is not in this registry. Buttons are local |
| Observability | Met | One Tier 3 counter. No second telemetry provider |
| Internationalisation | Met, [ADR 0002](../adr/0002-platform-sdk.md) | SDK catalog. Screens use `useT`. Other code uses `shared/copy` |
| Testing | Met for this runner, [ADR 0003](../adr/0003-test-runner.md) | Rstest in `test/`. Vitest and Playwright are not added |
| Deployment | Open | nginx image on 8080. No CloudFront workflow and no release workflow in this repo |

## 2. What was corrected

| Rule | What changed |
|---|---|
| Folder layout | Source moved into the constitution layers. `src/App.tsx` remains the expose shim |
| Screens calling domain rules | Palette, review, upload, and export go through application use cases |
| Validation text inside the domain | Rules return catalog codes |
| Banner text stored as English | Notices are catalog keys. The layout translates them |
| Secrets in the saved catalogue | `StudioRepository` omits credentials and the banner |
| Application importing the app shell | Catalog lookup for non-components lives in `shared/copy` |

## 3. Still open

| Item | Why it stays open |
|---|---|
| Workflow HTTP API | There is no service to call. The query key stays when one exists |
| `platform-design-system` | The package is not published here |
| Vitest and Playwright | Rstest stays so Vite stays out, until the platform picks one runner |
| Release pipeline | `web-shell` publishes a signed image from a tag. This repo's CI is typecheck, lint, and test |
| Architecture lint package | Layer direction is followed in source. This repo does not run dependency-cruiser |

## 4. Target dependency direction

Presentation calls the provider, application queries, and use cases. The provider runs the reducer and `StudioRepository`. Domain rules do not import React, fetch, or storage. Infrastructure implements the repository and reads runtime config. The SDK is the shared framework.
