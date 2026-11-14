# Changelog

## [Unreleased]

- Add the workflow designer remote: list, detail, BPMN editor, module library, and starter gallery.
- Build with Rsbuild and the platform preset, and take the platform SDK as a peer.
- Run tests with Rstest so the project no longer depends on Vite.
- Record finished studio actions as the Tier 3 metric `portal_workflows_actions_total`. Shared platform and domain metrics stay in the registry.
- Keep the catalogue in workspace storage without connector secrets, place new BPMN elements on the diagram, and refuse a file that is not a BPMN process.
- Allow writes for `update:tender` when the workspace is not read-only, and open standalone at `/workflows`.
- Move the studio into app, presentation, application, domain, and infrastructure layers. Storage goes through `StudioRepository`.
- Route palette edits, diagram review, starter preview, upload acceptance, and BPMN export through application use cases. Validation rules return catalog codes.
- Cache the catalogue with TanStack Query over `StudioRepository`. Keep list filters, search, gallery selection, the open diagram, and the version diff in Zustand. Banner notices are catalog keys translated in the layout.
- Point screens at application queries. Remove the layer re-export shims. Catalog lookup for non-components lives in `shared/copy`.
