# Architecture

`workflows` is the workflow designer remote. The shell owns sign-in and mounts `./App` at `/t/:slug/workflows/*`. This package owns the screens, the fixture catalogue, and the bpmn-js modeler. `@bcbp-solutions-fzc-llc/frontend-sdk` is a peer dependency: the remote build takes the shell's copy, and the standalone page initializes it from `/config/runtime.json`. Workspace basename, dates, theme storage, copy, and render errors go through that SDK.

```
src/app/bootstrap                     standalone page and remote entry
src/app/routes/App.tsx                route table. src/App.tsx re-exports it for the remote
src/app/layouts                       shell chrome for this remote
src/app/providers                     catalogue provider. Writes go through StudioRepository
src/app/configuration                 catalog and message lookup
src/presentation/pages                D1 list, D2 detail, D3 editor, D4 modules, D5 starters
src/presentation/features/editor      bpmn-js canvas, palette, properties, credential form
src/presentation/components           buttons, brand, theme picker
src/application/commands              catalogue reducer
src/application/queries               filters, labels, diff text
src/domain/entities                   workflow, module, and starter models
src/domain/rules                      diagram XML and publish rules
src/domain/repositories               StudioRepository port
src/infrastructure                    runtime config, sign-in URL, storage, telemetry
src/infrastructure/storage/seed.ts    fixture workflows, modules, and starters
```

Publishing runs `validateWorkflow` on the diagram and the task records. Connector secrets live in `state.credentials` and are never copied onto a version's XML, the version document, or workspace storage. The catalogue itself is saved with `storage('workflows')` for the signed-in workspace. A workflow with `conflictArmed` refuses publish until `reload` replaces the draft with the server record. `lockedBy` makes the canvas read-only. Writes also require `update:tender` and a workspace that is not read-only. Theme preference uses the same storage helper.
