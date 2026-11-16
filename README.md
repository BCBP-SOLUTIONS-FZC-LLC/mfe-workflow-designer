# mfe-workflow-designer

Design, version, validate, and publish BPMN workflows with visual modeling, reusable modules, starters, assignment rules, and secure connector credentials.

The workflow studio remote for the BCBP shell. Module Federation name **`workflows`**. The shell loads `remoteEntry.js` and mounts `./App`. Sign-in stays in the shell. The platform SDK is a peer: the remote build does not bundle it. bpmn-js stays in this bundle.

**Repository:** `github.com/BCBP-SOLUTIONS-FZC-LLC/mfe-workflow-designer`
**Runtime:** Node.js 22 (CI) · Node 26 (image builder) · Rsbuild 2 · React 19 · `@bcbp-solutions-fzc-llc/frontend-sdk` `1.0.0-alpha.6` · private package (`"private": true`) · nginx on port **8080**
**Contract:** Remote `workflows`, expose `./App`, container `__platform_mfe_workflows`. Versioning is in [VERSIONING.md](./VERSIONING.md).
**Design:** [ARCHITECTURE.md](./ARCHITECTURE.md), [docs/adr](./docs/adr/README.md). How to work in the repo: [CONTRIBUTING.md](./CONTRIBUTING.md).
**Status:** Unreleased (`0.0.0`). No Git tag and no published image yet.

---

## Mental model

| This remote owns | Lives elsewhere |
|---|---|
| Screens D1–D5 under `/t/:slug/workflows/*` | Sign-in, the session, and mounting the remote (`web-shell`) |
| BPMN editing, publish rules, modules, and starters | A workflow HTTP API. The catalogue is SDK storage plus the fixture seed |
| Connector secrets for the open page, in memory only | A credential vault. Secrets are not written into BPMN or storage |
| `portal_workflows_actions_total` | OTLP export and Core Web Vitals (the shell) |

Local development runs the studio at `http://localhost:5005`.

---

## Routes

Mounted under `/t/:slug/workflows/*`. Standalone `npm run dev` also serves `/workflows` and redirects `/` there.

| Screen | Path |
|---|---|
| D1 Workflow list | `/t/:slug/workflows` |
| D2 Overview | `/t/:slug/workflows/:workflowId` |
| D2 Versions, Diff, Nodes, Usage | `…/versions`, `…/diff`, `…/nodes`, `…/usage` |
| D3 BPMN editor | `/t/:slug/workflows/:workflowId/editor` |
| D4 Module library | `/t/:slug/workflows/modules` |
| D5 Starter gallery | `/t/:slug/workflows/starters` |

## What the screens do

- **List.** Name, key, status, active version, draft, validity, stage binding, and publication. Filters for search, status, draft, and validity. Create a blank workflow, start from the gallery, or upload BPMN. Clone and archive from the row.
- **Detail.** Overview, version history, a structural diff, human-step assignments, and running instances. Open the editor, publish, export BPMN, promote a version, or save a published version as a starter.
- **Editor.** Allowed-element palette (user, send, receive, connector, subprocess, call activity, department lane, message and error boundaries) on a bpmn-js canvas. Properties cover stage, default person, SLA, boundaries, module version, mappings, and connector inputs and outputs. Errors pin to the element. Publishing requires a start, an end, a connected task, and a default person on every user, send, receive, and connector task. Drafts autosave with a record version. A lock notice blocks editing. A publish conflict asks you to reload the server record.
- **Credentials.** Connector secrets are entered in the secure form and kept for the open page. They are not written into the BPMN XML or the version document.
- **Modules.** Platform-global and tenant modules, with versions, contract, assignment keys, messages, error codes, and dependency status. Publish a version or archive.
- **Starters.** Categorized diagrams with preview and Use this starter.

A member with only `read:tender` can look. Create and other writes need `update:tender` and a workspace that is not read-only.

## Federation

| Item | Value |
|---|---|
| Name | `workflows` |
| Expose | `./App` |
| Container | `__platform_mfe_workflows` |
| Dev entry | `http://localhost:5005/remoteEntry.js` |
| Manifest | `ownerDomain: portal` |
| Shared from the shell | `react`, `react-dom`, `@opentelemetry/api`, `frontend-sdk` |

`rsbuild.config.ts` builds a `remote` environment and a `standalone` environment into `dist/`. The remote build does not bundle the SDK. The standalone build loads `/config/runtime.json` before rendering.

## Local setup

Node **22** or newer. `@bcbp-solutions-fzc-llc/*` comes from GitHub Packages, so `NODE_AUTH_TOKEN` must be a token with `read:packages`.

```bash
gh auth refresh -s read:packages
export NODE_AUTH_TOKEN=$(gh auth token)
npm ci
npm run hooks:install
npm run dev
```

Open `http://localhost:5005`. Logout without an `onLogout` prop uses the platform SDK: the shell's sign-out when the shell provides it, otherwise `auth.signInUrl` from `/config/runtime.json`.

| Command | What it does |
|---|---|
| `npm run dev` | Rsbuild on port 5005 (HMR off) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, including the platform SDK rules |
| `npm test` | Rstest. Details in [test/README.md](test/README.md) |
| `npm run build` | `tsc`, both bundles, and `dist/remote-manifest-entry.json` |
| `npm run preview` | Preview the production build |
| `npm run hooks:install` | Install `.githooks/pre-commit` |

The image listens on **8080**. `GET /healthz` returns `ok`.

## Observability

Studio actions are the Tier 3 counter `portal_workflows_actions_total`, recorded through the platform SDK. The inventory is [docs/observability/metrics.md](docs/observability/metrics.md). Autosave is not counted. Connector secrets are not labels.

## Further reading

| Document | What it covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layers, catalogue, nginx |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to add a screen, a rule, or a metric |
| [VERSIONING.md](VERSIONING.md) | The runtime contract and how a tag will be cut |
| [CHANGELOG.md](CHANGELOG.md) | Unreleased changes and known gaps |
| [docs/README.md](docs/README.md) | ADRs, pipeline, metrics |
