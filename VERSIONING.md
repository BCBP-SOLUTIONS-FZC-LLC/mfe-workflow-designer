# Versioning and releases

This repository is a **deployed micro-frontend remote**, not an npm library other apps install. `package.json` is `"private": true`. Its `name` (`mfe-workflow-designer`) is an identifier. What gets versioned is the **remote bundle** (`remoteEntry.js` and the manifest entry) and, when an operator builds it, the **container image** described by the `Dockerfile`. Versions will be published with Git tags and described in [CHANGELOG.md](./CHANGELOG.md).

This document follows the SemVer layout of [web-shell `VERSIONING.md`](https://github.com/BCBP-SOLUTIONS-FZC-LLC/web-shell/blob/main/VERSIONING.md). This repo does not yet have `release.yml`, image signing, or a support window.

## Semantic versioning (SemVer)

We use [SemVer 2.0.0](https://semver.org/): `MAJOR.MINOR.PATCH` (for example `v1.2.3`).

| Bump | When you change | Examples |
|---|---|---|
| **MAJOR** | Breaking change in the runtime contract below | Renaming the remote (`workflows`) or its container global, changing the exposed module away from `./App`, dropping a route the shell or a bookmark depends on, requiring a new permission, writing connector secrets into BPMN or storage |
| **MINOR** | New backward-compatible capability | A new studio screen that does not remove an existing path, a new optional filter, an SDK minor the shell already provides |
| **PATCH** | Backward-compatible fix | A publish-rule fix, a diagram placement fix, a dependency bump with no contract change, a documentation correction |

### What counts as the runtime contract

| In scope (SemVer applies) | Out of scope (may change without MAJOR) |
|---|---|
| Remote name `workflows`, expose `./App`, container `__platform_mfe_workflows` | Internal folders under `src/` |
| Shell route `/t/:slug/workflows/*` and the standalone paths under `/workflows` | Copy, theme class names, fixture workflow names |
| SDK peer `@bcbp-solutions-fzc-llc/frontend-sdk` `1.0.0-alpha.6`. React, React DOM, the OTel API, and the SDK are shell singletons | Patch-level upgrades inside those ranges. bpmn-js stays inside this bundle and is not a shared singleton |
| `ownerDomain` `portal` on the manifest entry | The fixture seed's sample people and departments |
| Writes require `update:tender` and a workspace that is not read-only | The in-memory shape of the Zustand stores |
| Connector secrets are absent from BPMN, from `storage('workflows')`, and from metric labels | How the properties form lays out the secret field |
| Metric name `portal_workflows_actions_total` and its `action` and `outcome` labels | Help text wording, as long as the inventory page and the code stay identical |
| Image listen port **8080**, `GET /healthz` (plain `ok`), `GET /remoteEntry.js` | nginx comments |
| `package.json` `version` once a tag exists. It must match the Git tag without the `v` | The npm package name. It is not published |

`/config/runtime.json` is public. Do not put secrets in it.

### Guarantees

- **Pre-`v1.0.0` (current status):** `package.json` is `0.0.0` and no tag exists. Per [SemVer §4](https://semver.org/#spec-item-4), anything may change. The table above still says what is more disruptive than what.
- **MAJOR (once `v1` ships):** breaking contract changes ship as `v2.0.0` with migration notes in the CHANGELOG.
- **MINOR:** the shell can keep loading `./App` without a shell change, unless the new capability needs a new manifest field.
- **PATCH:** drop-in replacement of `remoteEntry.js` for the same manifest entry.

## Supported releases

| Version | Status | Notes |
|---|---|---|
| `0.0.0` | **Unreleased** | Everything in [CHANGELOG § Unreleased](CHANGELOG.md). No image tag |

There is no support window. Nothing is deployed from a tag.

## Consume a build

Do not add this repository as an npm dependency. The shell loads `workflows` from `/remotes/manifest.json`. For local development the shell's `config/remotes.local.json` points at `http://localhost:5005/remoteEntry.js` with `ownerDomain` `portal`.

Build the remote:

```bash
npm ci
npm run build
```

`dist/remoteEntry.js` is the container. `dist/remote-manifest-entry.json` is the object an environment pastes into the shell manifest under the key `workflows`.

The `Dockerfile` produces an nginx image on port **8080**. No workflow in this repo publishes that image.

## Maintainer release process

When the first tag is cut:

1. Merge the release to `main`.
2. Move `[Unreleased]` in `CHANGELOG.md` to `## [X.Y.Z] - YYYY-MM-DD`.
3. Set `package.json` `version` to `X.Y.Z` (no `v` prefix).
4. Run the local gate:

   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

5. Create an annotated tag `vX.Y.Z` and push it.

There is no `release.yml` yet, so the tag does not build or sign an image by itself. An operator builds the `Dockerfile` or publishes `dist/` until that workflow exists. Say so in the CHANGELOG section for that version.

## Compatibility matrix

| mfe-workflow-designer | Node (CI / image) | React | Platform SDK | Shell |
|---|---|---|---|---|
| Unreleased (`0.0.0`) | 22 / 26 | `^19.0.0` (strict singleton from the shell) | `1.0.0-alpha.6` peer | web-shell that mounts remote `workflows` at `/t/:slug/workflows/*` and allows origin `http://localhost:5005` in local runtime config |

## Related files

| File | Purpose |
|---|---|
| [CHANGELOG.md](./CHANGELOG.md) | History. `[Unreleased]` until the first tag |
| [README.md](./README.md) | What the studio is |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layers, catalogue, federation |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Local setup and how to extend the studio |
| [docs/pipeline/README.md](./docs/pipeline/README.md) | The CI job |
| [docs/observability/metrics.md](./docs/observability/metrics.md) | The Tier 3 counter |
| [Dockerfile](./Dockerfile) | Digest-pinned Node builder and nginx runtime |
| [package.json](./package.json) | Package version. Must match the Git tag when one is cut |
