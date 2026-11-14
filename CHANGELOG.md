# Changelog

All notable changes to this remote are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning is [SemVer](https://semver.org/) and is described in [VERSIONING.md](./VERSIONING.md).

`package.json` `version` is `0.0.0`. No Git tag has been cut. `[Unreleased]` is everything on this branch. Cutting a release, once a release workflow exists, moves this section to `## [X.Y.Z] - YYYY-MM-DD`.

## [Unreleased]

### Added

- **Workflow studio remote.** List, detail, BPMN editor, module library, and starter gallery. Module Federation name `workflows`, expose `./App`, dev server port 5005. The shell mounts it at `/t/:slug/workflows/*`.
- **Rsbuild production build.** The platform SDK is a peer. React, React DOM, the OTel API, and the SDK are shell singletons. bpmn-js stays in this bundle. HMR is off so `remoteEntry.js` stays a container.
- **Rstest.** Unit and screen tests live in `test/`. The project does not depend on Vite.
- **Tier 3 metric** `portal_workflows_actions_total`. The inventory is [docs/observability/metrics.md](docs/observability/metrics.md). No platform-shared or domain-shared metric was added.
- **Workspace persistence.** The catalogue is saved with SDK `storage('workflows')`. Connector secrets are omitted from storage and from BPMN. An upload that is not a BPMN process is rejected. New elements are placed on the diagram.
- **Authorization.** Writes require `update:tender` and a workspace that is not read-only. A member with only `read:tender` can look. Create stays disabled.
- **Layered source.** `app`, `presentation`, `application`, `domain`, `infrastructure`, and `shared`. Storage goes through `StudioRepository`. Palette edits, review, upload, and export go through application use cases. Validation rules return catalog codes.
- **Catalogue cache and client UI.** TanStack Query holds the catalogue over the repository. Zustand holds list filters, search, gallery selection, the open diagram, and the version diff. Banner notices are catalog keys translated in the layout.
- **Local commit hook.** `.githooks/pre-commit`, installed with `npm run hooks:install`, refuses secret files, checks workflow hygiene and the Dockerfile digest pin, then typechecks.
- **Project docs and repo hygiene.** [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), [CONTRIBUTING.md](CONTRIBUTING.md), [VERSIONING.md](VERSIONING.md), and [docs/](docs/README.md), following `web-shell`. Also `.gitattributes`, `CODEOWNERS`, Dependabot, issue and pull request templates, a security policy, and a changelog check on pull requests.

### Known gaps

- **No workflow HTTP API.** The catalogue is the fixture seed plus SDK storage. A signed-out standalone reload drops created workflows because storage no-ops for the anonymous namespace.
- **No credential vault.** Secrets exist only in the open page's memory.
- **No release workflow.** Nothing in this repo tags an image, signs it, or opens a GitHub Release. `package.json` stays `0.0.0` until the first tag.
- **CI is typecheck, lint, and `npm test`.** There is no coverage percentage gate, image scan, or Playwright job ([ADR 0003](docs/adr/0003-test-runner.md)).
- **`platform-design-system` is not in this registry.** Buttons stay in `presentation/components/ui.tsx` ([ADR 0002](docs/adr/0002-platform-sdk.md)).
- **CI Node is 22. The image builder is Node 26.**

### Current architecture notes

- A static remote. The production process is nginx on 8080 (uid 101). No API server in this repository.
- The shell owns sign-in. This remote reads the SDK for the user, permissions, storage, copy, and metrics.
- Writes use `update:tender` and `useReadOnly()`, the same permission family as drafting. There is no `update:workflow` permission.
- Connector secrets are never labels on a metric and never fields in stored JSON or BPMN.
