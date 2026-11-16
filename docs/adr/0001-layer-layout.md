# ADR 0001 — Layer the workflow remote

## Status

Accepted

## Decision

Source now follows the frontend constitution's layers: `app`, `presentation`, `application`, `domain`, `infrastructure`, and `shared`.

The catalogue reducer lives in `application/commands`. Filters and labels live in `application/queries`. BPMN and publish rules live in `domain/rules`. Models live in `domain/entities`. `StudioRepository` is the storage port. `studioStore` implements it and drops connector secrets before writing.

`src/App.tsx` re-exports the route table so the remote expose path stays `./App`. Screens import application queries, and the application layer reads catalog text from `shared/copy`. The open diagram and the diff selectors live in the client store with the list and the gallery.

## Consequences

Screens call application use cases for palette edits, diagram review, starter preview, and upload acceptance. Domain rules return issue codes. `issueText` turns a code into the catalog sentence. Export is assessed by `assessExport` and recorded in the provider.
