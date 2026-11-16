# Definition Service

The catalogue for this studio when `flags.definition_service` is true. The contract copied from Workflow on 15 November 2026:

| File | What it is |
|---|---|
| [integration.md](integration.md) | Run steps, IAM stand-ins, screen routes, and the BPMN rules per element |
| [openapi.yaml](openapi.yaml) | Public API of Definition Service 0.2.0 |
| [reference.bpmn](reference.bpmn) | A workflow that uses every supported element and publishes as is |

The image to run now is `ghcr.io/bcbp-solutions-fzc-llc/workflow-definition-service:sha-a206963`. The `0.2.0` tag follows with the same service code. It is `linux/amd64` only. Platform grants read access to the package.

## Local stack

From `deploy/definition`:

```powershell
docker compose up
```

That starts PostgreSQL 18, Valkey 8, the catalog plan stand-in, `migrate`, then the server on port 8080. Readiness is `GET http://localhost:8080/readyz`. Swagger is at `/swagger/` because `APP_ENV=dev`. Org & Membership and the secrets store are left empty, so publish checks id shape only and the credential routes answer 503.

The dev server proxies `/api/v1` to `127.0.0.1:8080` and adds `x-tenant-id`, `x-user-id`, `x-tenant-roles`, and `x-plan`. Copy [config/definition.example.json](../../config/definition.example.json) to `config/definition.local.json` to change that identity. The example file is the default when the local file is absent. The browser never sends those headers; the SDK forbids them.

Turn the source on in `config/runtime.local.json`:

```json
"flags": { "definition_service": true }
```

With the flag off, the studio keeps the fixture catalogue in SDK storage. With it on, list, create, upload, clone, archive, draft save, publish, promote, starters, and modules use `/api/v1`. A structural publish refusal sets the existing conflict dialog; publishing again sends `force_publish_structural`. Connector secrets stay out of BPMN. The credential routes are not called while OpenBao is unset.

`getFlag` ignores runtime flags when this remote runs standalone, so the studio reads `flags.definition_service` from the loaded runtime config.

## Still outside this client

Gateways, conditions, timer boundaries, Zeebe extension editing, and department and person pickers backed by Org & Membership. Generated diagrams declare the Zeebe namespace. Lanes still have no `dept_id`, and tasks still have no `zeebe:taskDefinition`, so the service can refuse a diagram made in the palette until those fields are written into the XML.
