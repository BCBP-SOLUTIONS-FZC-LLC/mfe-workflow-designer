# ADR 0004 — Catalogue cache over the repository

## Status

Accepted

## Decision

The catalogue is server state for this remote, backed by `StudioRepository`. TanStack Query holds that cache and notifies in the same turn as the click, so banners and list rows paint before the handler returns. The repository implementation is SDK storage. There is still no workflow HTTP API, so the query function reads storage and does not call a network client.

Banner notices are catalog keys. The layout translates them. Stored version notes stay sentences because they are part of the workflow record.

Zustand holds client UI state: list filters, the blank-workflow form, header search, the theme picker, the starter preview, the open module, the open diagram, and the version diff. The diagram store resets when the open workflow changes, and a sign-in redirect reads that store before the page unloads.

When a workflow API exists, `StudioRepository` gains an HTTP implementation and the query key stays the same.

## Consequences

Connector secrets remain in the query cache for the open page and are still omitted from storage and from BPMN.
