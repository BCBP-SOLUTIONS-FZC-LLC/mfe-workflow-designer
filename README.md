# mfe-workflow-designer

Design, version, validate, and publish BPMN workflows with visual modeling, reusable modules, starters, assignment rules, and secure connector credentials.

Workflow studio remote for the BCBP shell. Module Federation name **`workflows`**. The shell loads `remoteEntry.js` and mounts `./App`. Sign-in stays in the shell. The platform SDK is a peer: the remote build does not bundle it. bpmn-js stays in this bundle.

## Routes

Mounted under `/t/:slug/workflows/*`:

| Screen | Path |
|---|---|
| D1 Workflow list | `/t/:slug/workflows` |
| D2 Overview | `/t/:slug/workflows/:workflowId` |
| D2 Versions, Diff, Nodes, Usage | `…/versions`, `…/diff`, `…/nodes`, `…/usage` |
| D3 BPMN editor | `/t/:slug/workflows/:workflowId/editor` |
| D4 Module library | `/t/:slug/workflows/modules` |
| D5 Starter gallery | `/t/:slug/workflows/starters` |

Standalone `npm run dev` redirects `/` to `/workflows`. Dev server: `http://localhost:5005`. The image listens on **8080**.

## What the screens do

- **List.** Name, key, status, active version, draft, validity, stage binding, and publication. Filters for search, status, draft, and validity. Create a blank workflow, start from the gallery, or upload BPMN. Clone and archive from the row.
- **Detail.** Overview, version history, a structural diff, human-step assignments, and running instances. Open the editor, publish, export BPMN, promote a version, or save a published version as a starter.
- **Editor.** Allowed-element palette (user, send, receive, connector, subprocess, call activity, department lane, message and error boundaries) on a bpmn-js canvas. Properties cover stage, default person, SLA, boundaries, module version, mappings, and connector inputs and outputs. Errors pin to the element. Publishing requires a start, an end, a connected task, and a default person on every user, send, receive, and connector task. Drafts autosave with a record version. A lock notice blocks editing. A publish conflict asks you to reload the server record.
- **Credentials.** Connector secrets are entered in the secure form and kept in the vault. They are not written into the BPMN XML or the version document.
- **Modules.** Platform-global and tenant modules, with versions, contract, assignment keys, messages, error codes, and dependency status. Publish a version or archive.
- **Starters.** Categorized diagrams with preview and Use this starter.

## Local setup

Node **22** or newer. `@bcbp-solutions-fzc-llc/*` is installed from GitHub Packages, so `NODE_AUTH_TOKEN` must be a token with `read:packages` (`gh auth token` after `gh auth refresh -s read:packages`).

```bash
npm ci
npm run dev
```

Open `http://localhost:5005`. Logout without an `onLogout` prop uses the platform SDK: the shell's sign-out when the shell provides it, otherwise `auth.signInUrl` from `/config/runtime.json` (`http://localhost:5001` in `config/runtime.local.json`).

| Command | What it does |
|---|---|
| `npm run dev` | Rsbuild on port 5005 (HMR off, so `remoteEntry.js` stays a container) |
| `npm run build` | `tsc`, the remote and standalone bundles, and `dist/remote-manifest-entry.json` |
| `npm test` | Rstest once |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint, including the platform SDK rules |

## Observability

Studio actions are Tier 3 metrics (`portal_workflows_actions_total`) recorded through the platform SDK. The inventory, recording rules, alert and SLO proposals, and the runbook are in [docs/observability/metrics.md](docs/observability/metrics.md). No platform-shared or domain-shared metric was added: the registry has none for this studio, and a new shared name needs registry approval first.

## Federation

`rsbuild.config.ts` builds two environments into `dist/`. The `remote` environment uses `@bcbp-solutions-fzc-llc/webpack-preset` (`role: 'remote'`, name `workflows`) and exposes `./App`. React, React DOM, and the platform SDK are shell singletons. The `standalone` environment bundles the SDK and loads `/config/runtime.json` before rendering. bpmn-js stays in this bundle.
