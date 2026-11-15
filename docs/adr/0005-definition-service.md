# ADR 0005 — Definition Service is the catalogue when the flag is on

## Status

Accepted

## Decision

`flags.definition_service` selects the catalogue source. Off, which is the default, `StudioRepository` stays SDK storage and the fixture seed. On, the studio reads and writes Definition Service 0.2.0 at `/api/v1`.

The dev server proxies that prefix to `127.0.0.1:8080` and adds the gateway headers from `config/definition.local.json`, or from `config/definition.example.json` when the local file is absent. The browser does not set `x-tenant-id`, `x-user-id`, `x-tenant-roles`, or `x-plan`. The SDK forbids those headers on a browser request.

The local stack is `deploy/definition`: PostgreSQL 18, Valkey 8, a catalog plan stand-in, then `migrate`, then the server. The image is `ghcr.io/bcbp-solutions-fzc-llc/workflow-definition-service:sha-a206963` until `0.2.0` is tagged. The contract is in `docs/definition-service`.

Refusals are read from `code`, then `errorCode`, and from `invalid_params`, then `validationErrors`. A `STRUCTURAL_DIVERGENCE` refusal arms the existing conflict dialog. Publishing again sends `force_publish_structural`. Connector secrets stay in page memory. The credential routes are not called while OpenBao is unset.

`getFlag` ignores runtime flags for a remote running standalone, so this switch is read from the loaded runtime config.

## Consequences

Generated diagrams declare the Zeebe namespace. The palette still does not write `dept_id`, task definitions, gateways, or conditions, so the service can refuse a diagram drawn here. Department and person pickers wait on Org & Membership. The role names the service checks (`tenant_admin`, `tenant_owner`) are not the same grant as `update:tender`; the dev proxy sends `tenant_admin` until that mapping is agreed.
