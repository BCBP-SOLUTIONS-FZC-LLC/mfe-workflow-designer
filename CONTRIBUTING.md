# Contributing

This is the workflow designer remote for the BCBP micro-frontend platform. This guide covers setup, how to extend the studio, tests, and the pull request process for `mfe-workflow-designer`.

Product behavior is in [README.md](./README.md). Module layout is in [ARCHITECTURE.md](./ARCHITECTURE.md). Image tags and the contract are in [VERSIONING.md](./VERSIONING.md).

## Prerequisites

- Node.js 22 or newer (CI uses 22; the image builder is Node 26)
- npm
- A GitHub token with `read:packages`, SSO-authorised for the organisation, exported as `NODE_AUTH_TOKEN`

`@bcbp-solutions-fzc-llc/frontend-sdk`, `webpack-preset`, and `eslint-plugin` are private packages on GitHub Packages. `.npmrc` maps the scope to `https://npm.pkg.github.com` and reads the token from `NODE_AUTH_TOKEN`. The token value is `${NODE_AUTH_TOKEN}`. Do not commit a real token.

## Development setup

```bash
git clone https://github.com/BCBP-SOLUTIONS-FZC-LLC/mfe-workflow-designer
cd mfe-workflow-designer
gh auth refresh -s read:packages
export NODE_AUTH_TOKEN=$(gh auth token)
npm ci
npm run hooks:install
npm run dev
```

On Windows PowerShell, set the token with `$env:NODE_AUTH_TOKEN = (gh auth token)`.

`npm run dev` serves `http://localhost:5005`. Open `/workflows`. The shell, when it is running on port 5001 with this remote in `config/remotes.local.json`, loads the same container at `/t/<slug>/workflows`.

| Command | What it does |
|---|---|
| `npm run dev` | Rsbuild on port 5005. HMR is off so `remoteEntry.js` stays a container |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, including the platform SDK rules |
| `npm test` | Rstest once. See [test/README.md](test/README.md) |
| `npm run test:coverage` | The same suite with coverage. There is no percentage gate |
| `npm run build` | `tsc`, both bundles, and `dist/remote-manifest-entry.json` |
| `npm run preview` | Preview the production build |
| `npm run hooks:install` | Copy `.githooks/pre-commit` into `.git/hooks` |

Run `hooks:install` again after `.githooks/pre-commit` changes. On each commit the hook refuses a staged `.env` or `docker.local.env`, rejects HTML entities and CRLF in the workflow, Dockerfile, nginx, and hook files, requires digest-pinned `FROM` lines, then runs `tsc --noEmit`. ESLint and Rstest stay in CI. Run `npm run lint` and `npm test` before a pull request. Git for Windows runs the hook with its Bash.

Local ports used with the shell: shell **5001**, dashboard **5002**, tenders **5003**, drafting **5004**, workflows **5005**. The production image listens on **8080**.

## Project layout

```
src/app/            composition root: bootstrap, routes, layout, catalogue provider
src/presentation/   pages, editor, client UI store, components, theme
src/application/    reducer, queries, use cases
src/domain/         entities, BPMN and publish rules, StudioRepository port
src/infrastructure/ SDK storage, runtime config, telemetry
src/shared/         app id and catalog lookup for non-components
test/               Rstest setup, fixtures, unit tests, screen journeys
docs/               ADRs, pipeline, observability inventory
.githooks/          pre-commit source
```

Presentation does not import `domain/`. Application does not import `app/`. Domain does not import React, the SDK runtime, or storage.

## Extending the studio

### Adding a screen

1. Add the page under `src/presentation/pages/` and a route in `src/app/routes/App.tsx`.
2. Call `useRouteTemplate` with the shell template (`/t/:slug/workflows/...`).
3. Read catalogue data from `useWorkflows`. Read filters and other UI from `src/presentation/state/studioUi.ts`.
4. Take words from `useT`. Add keys to `src/app/configuration/locales/en.json`. Double apostrophes inside ICU text.
5. Cover the path in `test/e2e/app-flows.test.tsx`.
6. A new public path is a contract change. Update the routes table in `README.md` and, if a host depends on it, [VERSIONING.md](VERSIONING.md).

### Adding a domain rule

1. Put a pure function in `src/domain/rules/`. No React and no SDK.
2. Return a catalog code, not an English sentence. Translate in `src/application/queries/issues.ts` or in the layout for a banner.
3. Add a case in `test/unit/domain.test.ts`.

### Adding a use case

1. Add it under `src/application/use-cases/`. Screens call the use case. They do not call domain rules directly.
2. Record a finished user action from the provider with `recordWorkflowAction` or `recordFromReducer`. Do not count autosave, dismiss, or credential keystrokes.
3. If the metric's `action` set changes, update `src/infrastructure/telemetry/metrics.ts` and [docs/observability/metrics.md](docs/observability/metrics.md) in the same change. The metrics test fails when they differ.

### Adding client UI state

List filters, header search, gallery selection, the open diagram, and the version diff live in `src/presentation/state/studioUi.ts`. Reset them from `resetStudioUi`, which `test/setup.ts` calls after each test. Do not put connector secrets in that store. Secrets stay on the catalogue in memory and are stripped before `storage()` writes.

### Persistence

`StudioRepository.save` must keep omitting `credentials` and the banner. Do not add a workflow HTTP client until a real API exists. Do not invent an `update:workflow` permission. Writes stay `update:tender` and not read-only, matching drafting.

## Pull requests

- Update [CHANGELOG.md](CHANGELOG.md) under `[Unreleased]` when behavior, the contract, or the image changes.
- Do not commit `.env`, `docker.local.env`, or a filled-in token. `.npmrc` must keep `${NODE_AUTH_TOKEN}`.
- Do not commit `.mf/`. It is generated module-federation diagnostics.
- The CI job runs `tsc`, `npm run lint`, and `npm test` on Node 22.
- A pull request that changes `src/`, the lockfile, the Dockerfile, nginx, Rsbuild, runtime config, or `index.html` must also update [CHANGELOG.md](CHANGELOG.md). `.github/workflows/changelog-check.yml` fails the pull request otherwise.
