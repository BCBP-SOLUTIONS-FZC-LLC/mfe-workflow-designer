# Workflow to UI: Workflow Designer on the Definition Service

| Field | Value |
| --- | --- |
| From | Workflow services (Definition Service) |
| To | Frontend, Workflow Designer |
| Date | 15 November 2026 |
| Release | Definition Service 0.2.0, image `ghcr.io/bcbp-solutions-fzc-llc/workflow-definition-service:0.2.0` once tagged. Until then `…:sha-a206963` runs the same service code (section 2) |
| Attached | `workflow-ui-reference.bpmn`, a workflow that uses every supported element and publishes as is; `workflow-definition-openapi.yaml`, the public API of 0.2.0 |
| Status | Definition Service rules are settled for 0.2.0. Lines marked *Execution* describe the Execution Service as built on its main branch on 14 November 2026, which is still changing |

## 1. Running the designer against the release

The Definition Service is the catalogue: workflows, drafts, versions, modules and starters live there, and the BPMN XML is the only document it stores for a workflow. Every setting the designer keeps per element goes into that XML as a Zeebe extension element (section 8).

**Image.** Tags `0.2.0`, `0.2`, `0` and `latest`. The package is private; Platform grants read access to it. The image holds one binary with two commands: the server (the default), and `migrate` given as the argument, which applies the schema. The server never migrates on start. The image is built for `linux/amd64` only, so on an Apple Silicon machine it runs with `--platform linux/amd64` under emulation. From inside a container, services on the host machine are reached as `host.docker.internal`. The service listens on 8080.

**What it needs.**

| Dependency | Local setting |
| --- | --- |
| PostgreSQL 18 | Two roles: an application role (`NOSUPERUSER NOBYPASSRLS`) for `DATABASE_URL`, and a migrator role that owns the schema for `MIGRATION_DATABASE_URL` and `SYSTEM_DATABASE_URL`. The service refuses to start if the application role can bypass row-level security. `postgres:18-alpine` works |
| Valkey 8 (or Redis) | `VALKEY_ADDR` |
| Catalog plan table | `CATALOG_ADMIN_BASE_URL`, required: without it, create, clone and promote answer 503 `UPSTREAM_UNAVAILABLE` (section 4) |
| Org & Membership | `ORG_MEMBERSHIP_BASE_URL`, optional locally (section 4) |
| Execution Service | `EXECUTION_SERVICE_URL`, leave empty locally. When set, archive asks it for running instances and answers 503 while it cannot reach it |
| Secrets store (OpenBao) | `OPENBAO_ADDR`, empty locally. The connector credential routes then answer 503 |

**Settings.** `APP_ENV=dev` (only `dev` relaxes the required upstream addresses and serves Swagger UI at `/swagger/`), `HTTP_PORT=8080`, `METRICS_PORT=9091`, `TENANT_PURGE_ENABLED=false` for local runs. Order of start: database and Valkey, then `migrate` with the migrator role, then the server. Readiness is `GET /readyz`.

**Identity.** Every call carries gateway headers. In a deployment the gateway sets them from the sign-in token; locally the dev server's proxy adds them, so the browser calls the dev server and never the service port directly.

| Header | Value | Without it |
| --- | --- | --- |
| `x-tenant-id` | Tenant UUID | 401 |
| `x-user-id` | User UUID | 401 |
| `x-tenant-roles` | Comma-separated roles. `tenant_admin` or `tenant_owner` for any write; `platform_operator` for platform-wide modules and starters | 403 `FORBIDDEN` on a write |
| `x-plan` | Plan code, such as `pro` | Read on create, clone and promote to find the workflow template limit |

The designer gates writes on the SDK grants `read:tender` and `update:tender`. The service checks roles. Agreement needed on how the two map.

**Version note.** The error body changes in a later release (WF-2): the service moves to the shared library's member names, `errorCode` and `traceId`. Workflow names that release before it merges. Reading `code`, then `errorCode`, covers both.

## 2. Before 0.2.0 is tagged

**The service runs now.** The image tagged `sha-a206963` (also `main`, pushed on 13 November) holds the same service code as 0.2.0; the release changes only the release workflow, documents and a copied contract. It runs with the settings in section 1. `main` moves with every merge; `sha-a206963` stays fixed.

**The IAM mocks are needed either way** (section 4).

**The designer's own mock data.** Until the designer reads the service, its fixture data and browser catalogue stand in for it. Shaping them like the service makes the switch a change of source, not of model:

| Designer today | Service |
| --- | --- |
| Catalogue in browser storage with a fixture seed | Workflows, drafts, versions, modules and starters from the routes in section 6 |
| A per-element side list next to the XML | Extension elements in the BPMN XML (section 8); the XML is the only stored document |
| Version states `draft`, `published`, `retired` | `DRAFT`, `PUBLISHED`, `ARCHIVED`; at most one draft; one active version, changed by publish or promote |
| Version labels | `version_number`, empty on a draft and assigned at publish |
| Edit lock | `record_version` on the draft; a stale save answers 409 `DRAFT_CONCURRENCY` |
| Validity worked out in the browser | `is_valid` and `issues` from the service (validate route, version validation route) |
| Module record with assignment keys, messages and error codes | Module contract: `slots`, `tasks` with `assignee_key`, `messages`, `error_codes`, `names_users` |
| Departments and people by name | Department UUIDs, person UUID v7 |
| Notices built in the browser | Problem body with `code` and `invalid_params` (section 6) |

The attached OpenAPI document is the public API of 0.2.0 (its own version field reads 1.0.0), the source for typed clients and mock handlers. Swagger UI serves the same document at `/swagger/` when the service runs with `APP_ENV=dev`.

## 3. Changes made to run the designer locally

Workflow ran the designer against the service with a quick set of local changes. They are not committed to the designer's repository and are listed only for what they showed; how the designer reaches the service is the UI team's choice.

| Change | What it does | What it showed |
| --- | --- | --- |
| Dev server proxy | Forwards `/api` to the service (port 8080 unless overridden) and adds `x-tenant-id`, `x-user-id`, `x-tenant-roles` (default `tenant_admin`) and `x-plan` (default `pro`) from a git-ignored local identity file read at start | The browser keeps calling the dev server, as it calls the gateway in a deployment, so the app holds no header code. The API base URL stays `/api` |
| Push after publish, behind a runtime flag (`definition_sync`, off when absent) | After a local publish, creates the workflow on the service the first time; later opens or starts a draft, saves the XML with its `record_version` and publishes it. Keeps a link from the local id to the service id in browser storage, and links afresh when the service answers 404 (a reset database) | The create, draft, save and publish sequence works end to end. A stopgap while the designer keeps its own catalogue, since two catalogues drift. `STRUCTURAL_DIVERGENCE` is reported to the author, never forced |
| Text converter before sending | Declares the Zeebe namespace, adds `dept_id` to each lane, and gives each user task a stage type (Review to `review`, Approval to `approve`, anything else to `prep`), the matching role level, a default person and a `requires_comment` property, by rewriting the XML text. Elements that already carry extensions are left alone | Enough for lanes and user tasks. It cannot write messages, errors, timers, conditions, calls or connector inputs; the moddle extension in section 9 writes every element from the model |
| Ids derived from names | A department id from the lane name and a person id from the person's name, stable per name | Accepted only while Org & Membership is not configured; a real Org & Membership refuses them (`ASSIGNEE_INELIGIBLE`) |
| Success and refusal notices | On success, the version number; on refusal, the code and each `invalid_params` reason | The author sees what to fix. `invalid_params[].name` is the element id, so the message can be pinned on the diagram |
| Tests | A test platform that accepts runtime flags, an end-to-end test of the push, a unit test of the converter | |

With these changes, diagrams made of start and end events, lanes and user tasks published. Connector tasks were refused as `REJECTED_ELEMENT`, because the designer writes no `connector:` task definition and the service sees a plain service task. Calls were refused as `UNRESOLVED_CALLED_ELEMENT`, because the designer writes no `zeebe:calledElement`. The notice showed both reasons.

## 4. IAM endpoints to stand in

No Catalog or Org & Membership image is published, so a local run stands both in with any mock server. Both calls are made as the system caller (`x-tenant-roles: iam-system`).

**Catalog plan table (required).** `GET /api/v1/internal/plans` answers `200` with:

```json
{ "plans": [ { "code": "starter", "workflow_template_limit": 5 }, { "code": "pro", "workflow_template_limit": 50 }, { "code": "enterprise" } ] }
```

A plan with no limit is unlimited. The `x-plan` header on create, clone and promote must name one of the codes. `ENTITLEMENTS_BASE_URL` is the other limit source, and with it set `x-plan` is not read.

**Org & Membership eligibility (optional locally).** With `ORG_MEMBERSHIP_BASE_URL` empty, publish skips the eligibility read and checks only the shape of the ids. With it set, publish asks once per default person:

`GET /api/v1/internal/tenants/{tenant_id}/members/{user_id}/eligibility?department_id={uuid}&required_level={preparator|reviewer|approver}`, with `x-tenant-id` equal to the tenant in the path, answering:

```json
{ "tenant_id": "…", "user_id": "…", "department_id": "…", "required_level": "reviewer", "eligible": true }
```

`"eligible": false` with a `reason` makes publish answer 422 `ASSIGNEE_INELIGIBLE`. Any other answer makes it answer 503. The mock is worth running only to see that refusal.

## 5. Sources of truth

| Data | Owner | How the designer reads it |
| --- | --- | --- |
| Departments (`dept_id` on a lane) | Org & Membership | Its department list. Ids are UUIDs |
| People (`candidateUsers`, `Assignees`) | Org & Membership | Its department member list. User ids are UUID v7. A person must hold the task's role level in the lane's department, or publish refuses them |
| Stage types and role levels | workflow-models library | Stage types `prep`, `review`, `approve`; role levels `preparator`, `reviewer`, `approver` |
| Allowed BPMN elements | workflow-models library | `GET /api/v1/bpmn/allowed-elements` |
| Connector types, inputs, outputs, credential fields | workflow-connectors library | `GET /api/v1/connectors/registry` |
| Modules, their lanes, tasks, messages and error codes | Definition Service | Module routes, the contract route above all (section 6) |

The two libraries are the source of truth for the vocabularies. Access to their repositories is granted by Platform. The routes above serve the same data at run time, so the designer reads the routes and needs no copy of the libraries.

## 6. Designer screens and routes

All routes are under `/api/v1`. Writes take an optional `Idempotency-Key` header: a repeat with the same key and body returns the stored answer, a repeat with a different body answers 409 `IDEMPOTENCY_KEY_REPLAY`.

| Screen | Action | Route | Notes |
| --- | --- | --- | --- |
| D1 List | List | `GET /workflows` | `page`, `limit`, `search`, `key`, `status`, `is_valid`, `has_draft`; answer `workflows[]`, `pagination` |
| D1 List | Create, upload | `POST /workflows` | `key`, `name`, `description`, `bpmn_xml`. Answer `workflow_id`, `version_id`, `status: DRAFT`. 409 `DUPLICATE_TEMPLATE_KEY`, 403 `PLAN_QUOTA_EXCEEDED` |
| D1 List | Clone | `POST /workflows/{id}/versions/{version_id}/clone` | `new_key`, `new_name`, `new_description`; a new workflow with a draft |
| D1 List | Archive | `POST /workflows/{id}/archive` | 409 `NO_ACTIVE_VERSION`, 409 `ACTIVE_INSTANCES_EXIST` |
| D2 Overview | Read | `GET /workflows/{id}` | `active_version_id`, `has_draft`, recent `versions` |
| D2 Versions | List | `GET /workflows/{id}/versions` | Status `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| D2 Versions | Read one | `GET /workflows/{id}/versions/{version_id}` | `bpmn_xml`, `is_valid`, `validation_errors`, `record_version`, compiled plan |
| D2 Diff | Compare | `GET /workflows/{id}/versions/{version_id}/diff/{target_version_id}` | `change_type`, departments added and removed, step, stage and metadata changes |
| D2 Nodes | Human steps | `GET /workflows/{id}/versions/{version_id}/nodes` | Per task: `node_key`, `stage_type`, `role_level`, department, `default_user_ids`; `waits` lists what an outside party must answer |
| D2 | Export | `GET /workflows/{id}/versions/{version_id}/export` | The BPMN file |
| D2 | Promote | `POST /workflows/{id}/versions/{version_id}/promote` | Makes an older published version the active one |
| D2 | Save as starter | `POST /starters/from-workflow-version/{version_id}` | `name`, `description`, `category` |
| D2 Usage, running instances | | Execution Service | Not served by the Definition Service |
| D3 Editor | Open draft | `GET /workflows/{id}/draft`, or `POST` to start one from the active version | 404 `DRAFT_NOT_FOUND`; 409 `DRAFT_ALREADY_EXISTS` |
| D3 Editor | Save, autosave | `PUT /workflows/{id}/draft` | `bpmn_xml`, `name`, `description`, and `record_version` (or `If-Match`). Answer has the new `record_version`. 409 `DRAFT_CONCURRENCY` carries `current_record_version` |
| D3 Editor | Validate | `POST /workflows/validate` | `bpmn_xml`. Always 200: `is_valid`, `issues[]` with `node_id`, `code`, `message`, `severity` |
| D3 Editor | Publish | `POST /workflows/{id}/versions/{version_id}/publish` | Body `{}`. 409 `STRUCTURAL_DIVERGENCE` when the steps differ from the active version; resend with `force_publish_structural: true` after the author confirms. 422 `ASSIGNEE_INELIGIBLE` |
| D3 Editor | Discard | `DELETE /workflows/{id}/draft` | |
| D3 Credentials | Store, revoke | `POST /connectors/credentials`, `DELETE /connectors/credentials/{connector_type}/{field_name}` | `connector_type`, `field_name`, `value`. Stored per tenant in the secrets store, never in BPMN |
| D4 Modules | List, read | `GET /modules`, `GET /modules/{id}` | `scope` `tenant` or `global`; `process_id` is what a call names |
| D4 Modules | Create, new version, publish | `POST /modules`, `POST /modules/{id}/versions`, `POST /modules/{id}/versions/{version_id}/publish` | A new version keeps the module's `process_id` (409 `MODULE_PROCESS_ID_CONFLICT`) |
| D4 Modules | Contract | `GET /modules/{id}/versions/{version_id}/contract` | `slots` (lanes, `open` when a call must map them), `tasks` with `assignee_key`, `messages`, `error_codes`. This drives the `Depts` and `Assignees` forms |
| D4 Modules | Usages, archive | `GET /modules/{id}/usages`, `DELETE /modules/{id}` | Archive answers 409 `MODULE_IN_USE` with `uses[]` while a workflow uses it |
| D5 Starters | List, read, create, delete | `GET /starters`, `GET /starters/{id}`, `POST /starters`, `DELETE /starters/{id}` | `category`, `bpmn_xml` |

**No edit lock.** The service has no lock. Two editors of one draft are kept apart by `record_version`: the second save answers 409 and the designer reloads.

**Saving and publishing check different things.** Create and save run the document rules and refuse errors; a draft may still lack default people. Publish expands every call and refuses any task that people do and that has no default person (`CANDIDATE_USERS_EMPTY`).

**Errors.** Every refusal is `application/problem+json`:

```json
{ "type": "…/validation-failed", "title": "BPMN Validation Failed", "status": 422, "detail": "…", "instance": "/api/v1/workflows",
  "code": "BPMN_VALIDATION_FAILED", "trace_id": "…", "request_id": "…",
  "invalid_params": [ { "name": "Task_review", "code": "CANDIDATE_GROUPS_INVALID", "reason": "candidateGroups \"boss\" is not a department role level: preparator, reviewer or approver" } ] }
```

On a BPMN refusal, `invalid_params[].name` is the element id to pin the message on, and the list includes warnings. 401 and 500 can also come in the shared library's shape (`errorCode`, `traceId`).

## 7. Document rules

- **Namespaces.** The root is `bpmn:definitions` in the BPMN 2.0 model namespace, and the Zeebe namespace `http://camunda.org/schema/zeebe/1.0` is declared (`MISSING_NAMESPACE`, answered as 400 `INVALID_BPMN_XML` on create).
- **Diagram.** A `bpmndi:BPMNDiagram` with a shape for every flow node and an edge for every sequence flow (`MISSING_DIAGRAM`, `MISSING_DIAGRAM_SHAPE`). bpmn-js writes it.
- **One process runs.** Exactly one process is executable, not called and not marked ignore (`MULTIPLE_PROCESSES`, `NO_RUNNABLE_PROCESS`). Other pools are outside parties or modules.
- **Unique ids** in a process (`DUPLICATE_ELEMENT_ID`), and unique process ids in a file (`DUPLICATE_PROCESS_ID`).
- **One way out.** A start event, task, sub-process or call has one outgoing flow. Branches start only at a gateway (`SPLIT_WITHOUT_GATEWAY`). An end event has no outgoing flow.
- **Connected.** One start event per process, at least one end event, every element reachable (`NO_START_EVENT`, `MULTIPLE_START_EVENTS`, `NO_END_EVENT`, `DANGLING_NODE`, `UNREACHABLE_NODE`).
- **Limits.** 1000 tasks once calls are expanded (`TASK_LIMIT_EXCEEDED`), 100 lanes per process, no sub-process inside a sub-process (`NESTED_SUBPROCESS_NOT_SUPPORTED`), 1 000 000 XML tokens.
- **Allowed elements only.** The allowed-elements route is the list. Not implemented yet (`UNSUPPORTED_ELEMENT`): event-based gateways and intermediate catch events. Refused (`REJECTED_ELEMENT`): everything else, including groups, categories, timer dates and cycles, intermediate throw events, multi-instance and loop markers, script, business-rule and plain service tasks, transactions, ad-hoc sub-processes, complex gateways, terminate, compensation, cancel, escalation, conditional, link and signal events, and data objects. Text annotations, associations, documentation and data store references are drawn and ignored.

## 8. Element by element

Each table gives what the service reads. "Designer field" is the designer's current per-node field the value comes from. The snippets show only the parts that matter; ids and names are free.

### 8.1 Definitions, messages and errors

| Item | Required | Value | Error when wrong |
| --- | --- | --- | --- |
| `xmlns:zeebe` on `bpmn:definitions` | Yes | `http://camunda.org/schema/zeebe/1.0` | `MISSING_NAMESPACE` |
| `bpmn:message` | For each message a task, boundary or message flow uses | `id`, `name`. The `name` is what the engine matches | `MISSING_MESSAGE_DEFINITION` when a message flow names an undeclared message |
| `bpmn:error` | For each error a boundary catches | `id`, `errorCode` | |

```xml
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" …>
  <bpmn:message id="Message_quote" name="supplier-quote"/>
  <bpmn:error id="Error_rejected" name="Approval rejected" errorCode="approval-rejected"/>
```

### 8.2 Process, pools and outside parties

| Item | Required | Value | Error when wrong |
| --- | --- | --- | --- |
| `isExecutable` | `true` on the process that runs | | `NO_RUNNABLE_PROCESS` |
| `name` | No | Shown as the plan name; the `id` is used when absent | |
| `zeebe:property ignore` | On an outside party's pool | `true`. The pool is drawn and produces nothing | `MULTIPLE_PROCESSES` when two pools would run |
| `bpmn:participant` | One per pool in a collaboration | `processRef` | |
| `bpmn:messageFlow` | No | Between pools; resolves a message name when the task has none | |

```xml
<bpmn:process id="Supplier_party" name="Supplier" isExecutable="false">
  <bpmn:extensionElements><zeebe:properties><zeebe:property name="ignore" value="true"/></zeebe:properties></bpmn:extensionElements>
```

### 8.3 Lane

A lane is a department. It says who does a task, never when; the flows set the order, and work may move between lanes and back.

| Item | Required | Value | Designer field | Error when wrong |
| --- | --- | --- | --- | --- |
| `name` | Yes | No `/`, `::` or `~` | Lane name | `INVALID_LANE_NAME` |
| `zeebe:property dept_id` | Yes, on a lane of the running process | Org & Membership department UUID | None today (the designer derives one from the name) | `MISSING_DEPT_ID`, `INVALID_DEPT_ID` |
| `bpmn:flowNodeRef` | One per task, event and gateway in the lane | Element id | | `TASK_NOT_IN_LANE` |
| `zeebe:property ignore` | No | `true` makes the lane an outside party: its user, send and receive tasks pass through without waiting | | `IGNORED_LANE_WORK` for a call, sub-process, connector, boundary or loop in it |

Each zeebe property is written once per element (`INVALID_ZEEBE_PROPERTY`).

```xml
<bpmn:lane id="Lane_finance" name="Finance">
  <bpmn:extensionElements><zeebe:properties><zeebe:property name="dept_id" value="019a7c3e-0000-7000-8000-0000000d0002"/></zeebe:properties></bpmn:extensionElements>
  <bpmn:flowNodeRef>Task_review</bpmn:flowNodeRef>
</bpmn:lane>
```

### 8.4 User task

A task that a person does. *Execution:* the stage type is a label; all three run as human tasks. The role level and the lane's department decide who may claim, complete, defer or take over the task.

| Item | Required | Value | Designer field | Error when wrong |
| --- | --- | --- | --- | --- |
| `zeebe:taskDefinition type` | Yes | `prep`, `review` or `approve` | Stage | `MISSING_TASK_DEFINITION`; any other value is `UNKNOWN_STAGE_TYPE` (warning) |
| `zeebe:assignmentDefinition candidateGroups` | Yes | `preparator`, `reviewer` or `approver` | None today | `MISSING_ASSIGNMENT_DEFINITION`, `CANDIDATE_GROUPS_EMPTY`, `CANDIDATE_GROUPS_INVALID` |
| `zeebe:assignmentDefinition candidateUsers` | Before publish (here or in the call's `Assignees`) | One user UUID v7 | Default person (today a name) | `INVALID_CANDIDATE_USER`; `CANDIDATE_USERS_EMPTY` (warning in a draft, error at publish) |
| `zeebe:taskSchedule dueDate`, `followUpDate` | No | RFC 3339 date-times such as `2026-12-01T09:00:00Z` | None | `INVALID_TASK_SCHEDULE` |
| `zeebe:userTask` | No | Marks a Camunda 8 user task; carried into the plan | | |
| Other `zeebe:property` entries | No | Passed to the Execution Service unread unless agreed with Workflow | | |
| `bpmn:task` | | A plain task is read as a user task, with the same rules | | |

```xml
<bpmn:userTask id="Task_review" name="Review request">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="review"/>
    <zeebe:assignmentDefinition candidateGroups="reviewer" candidateUsers="019a7c3e-0000-7000-8000-000000000002"/>
  </bpmn:extensionElements>
</bpmn:userTask>
```

### 8.5 Send task

Sends a message and goes straight on.

| Item | Required | Value | Designer field | Error when wrong |
| --- | --- | --- | --- | --- |
| `messageRef` | Yes in practice | Id of a `bpmn:message` | Message name | Without it, the message name comes from a message flow, if any |
| Assignment | No | No default person is needed | | |

```xml
<bpmn:sendTask id="Task_send_rfq" name="Send RFQ" messageRef="Message_rfq"/>
```

### 8.6 Receive task

Waits for a message. *Execution:* a send task of the same workflow can feed it. When none does, as with a message flow from an outside party's pool, it waits for that party's answer, delivered to the Execution Service for that step. The published version lists these under `waits`.

| Item | Required | Value | Designer field | Error when wrong |
| --- | --- | --- | --- | --- |
| `messageRef` | Yes in practice | Id of a `bpmn:message` | Message name | Without it or a message flow, it waits for a message named after its own id |
| Assignment | No | | | |

```xml
<bpmn:receiveTask id="Task_receive_quote" name="Receive quote" messageRef="Message_quote"/>
```

### 8.7 Connector task

An automatic step from the connector catalogue. Only a service task whose task definition starts with `connector:` is allowed.

| Item | Required | Value | Designer field | Error when wrong |
| --- | --- | --- | --- | --- |
| `zeebe:taskDefinition type` | Yes | `connector:<type>`, a `type` from the registry route (`rest-call`, `send-email`, `storage` in 0.2.0) | Connector | Plain service task: `REJECTED_ELEMENT`; unknown type: `UNKNOWN_CONNECTOR_TYPE` (warning, the step cannot run) |
| `zeebe:input` | Per the registry's inputs | `target` is the input name. `source` is `=name` to read the instance variable `name`, any other text is a literal | Connector inputs | |
| `zeebe:output` | No | `source` is a key of the connector's result, `target` the instance variable it becomes | Connector outputs | |
| Credential inputs | Never | Fields of kind `secret_ref` in the registry come from the tenant's stored credential | Credential | `CONNECTOR_SECRET_AUTHORED` |
| Assignment | Never | | | `CONNECTOR_TASK_HAS_ASSIGNMENT` (warning) |
| Loop or multi-instance marker | Never | | | `REJECTED_ELEMENT` |

```xml
<bpmn:serviceTask id="Task_store" name="Store request">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="connector:storage"/>
    <zeebe:ioMapping>
      <zeebe:input source="aws-s3" target="provider"/>
      <zeebe:input source="eu-west-1" target="region"/>
      <zeebe:input source="upload" target="operation"/>
      <zeebe:input source="purchase-requests" target="bucket"/>
      <zeebe:input source="=request_id" target="key"/>
      <zeebe:input source="=request_document" target="content"/>
      <zeebe:output source="contentRef" target="stored_document"/>
    </zeebe:ioMapping>
  </bpmn:extensionElements>
</bpmn:serviceTask>
```

The registry gives, per input, `kind`, `required`, `enum_values` and a `condition` such as "required for aws-s3", so the designer builds the form from it.

### 8.8 Call activity (module)

Runs a module: a process published in the module library, or a process in the same file.

| Item | Required | Value | Designer field | Error when wrong |
| --- | --- | --- | --- | --- |
| `zeebe:calledElement processId` | Yes | The module's `process_id`, a fixed name, not an expression | Module | `UNRESOLVED_CALLED_ELEMENT` |
| `bindingType="versionTag" versionTag` | No | A published version number. Without it, the newest published version at the moment the workflow is published | Module version | `UNRESOLVED_CALLED_ELEMENT` |
| `zeebe:input target="Depts"` | When the module has two or more open lanes | JSON object, module lane to a lane of this process by name, case ignored | None today | `MISSING_DEPT_INPUT_FOR_MODULE`, `INVALID_ZEEBE_PROPERTY` |
| `zeebe:input target="Assignees"` | When the module leaves a task's person open | JSON object, module task id (the contract's `assignee_key`; `call::task` for a nested call) to user UUID v7 | Input mapping | `CANDIDATE_USERS_EMPTY` at publish |
| `zeebe:input target="dept_id"` | Never | | | `INVALID_ZEEBE_PROPERTY` |
| Other `zeebe:input` entries | No | Variables passed into the module | Input mapping | |

A module lane with its own `dept_id` is fixed. A module with one open lane, or none, runs in the call's own lane. A call to the same module twice makes two separate sets of tasks. A published workflow keeps the module versions it was published with. A called process needs no `isExecutable` and must not be marked ignore.

```xml
<bpmn:callActivity id="W_call" name="Exchange documents">
  <bpmn:extensionElements>
    <zeebe:calledElement processId="Docs_exchange" bindingType="versionTag" versionTag="1" propagateAllChildVariables="false"/>
    <zeebe:ioMapping>
      <zeebe:input source='{"Sender":"Tender","Receiver":"Engineering"}' target="Depts"/>
      <zeebe:input source='{"M_send":"019a7c3e-0000-7000-8000-000000000001","M_check":"019a7c3e-0000-7000-8000-000000000002"}' target="Assignees"/>
    </zeebe:ioMapping>
  </bpmn:extensionElements>
</bpmn:callActivity>
```

On validate, a module task filled through `Assignees` may still show `CANDIDATE_USERS_EMPTY` as a warning while the document has other errors; publish expands the call and is the real check.

### 8.9 Sub-process

| Item | Required | Value | Error when wrong |
| --- | --- | --- | --- |
| Inner start and end events | Yes | | `NO_START_EVENT`, `NO_END_EVENT` |
| Inner lanes | No | Inner tasks take the sub-process's lane | |
| Nested sub-process | Never | | `NESTED_SUBPROCESS_NOT_SUPPORTED` |

```xml
<bpmn:subProcess id="Sub_approval" name="Approval">
  <bpmn:startEvent id="Sub_start"/>
  <bpmn:userTask id="Task_approve" name="Approve request">…</bpmn:userTask>
  <bpmn:endEvent id="Sub_end"/>
</bpmn:subProcess>
```

### 8.10 Boundary events

| Kind | Attaches to | Definition | Notes |
| --- | --- | --- | --- |
| Timer | User task, connector task, sub-process, call | `bpmn:timeDuration` only, a positive ISO 8601 duration such as `PT48H`, `P5D`, `P1W` | `INVALID_SLA_DURATION`; `timeDate` and `timeCycle` are `REJECTED_ELEMENT` |
| Message | User task, connector task, sub-process, call | `messageRef` to a `bpmn:message` | With no outgoing flow, a pure notification |
| Error | Sub-process, call | `errorRef` to a `bpmn:error`; none catches any failure no other boundary names | Always interrupting |

- `cancelActivity="false"` makes a timer or message boundary non-interrupting: its path runs beside the task. The default stops the task and runs the path instead.
- A task has at most one timer and one message boundary (`INVALID_BOUNDARY_ATTACHMENT`). A boundary has one outgoing flow.
- The path starts with a task or goes straight to an end event (`UNSUPPORTED_BOUNDARY_TARGET`). To call a module or send a message from it, a task comes first.

```xml
<bpmn:boundaryEvent id="Boundary_chase" name="48 hours" attachedToRef="Task_prepare" cancelActivity="false">
  <bpmn:timerEventDefinition id="Timer_chase"><bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT48H</bpmn:timeDuration></bpmn:timerEventDefinition>
</bpmn:boundaryEvent>
<bpmn:boundaryEvent id="Boundary_withdrawn" attachedToRef="Task_review">
  <bpmn:messageEventDefinition id="MsgDef_withdrawn" messageRef="Message_withdrawn"/>
</bpmn:boundaryEvent>
<bpmn:boundaryEvent id="Boundary_rejected" attachedToRef="Sub_approval">
  <bpmn:errorEventDefinition id="ErrDef_rejected" errorRef="Error_rejected"/>
</bpmn:boundaryEvent>
```

### 8.11 Gateways and conditions

| Gateway | Use | Rules |
| --- | --- | --- |
| Exclusive | Choose one path, or send work back | A condition on every outgoing flow but one; the flow without one is the default (`GATEWAY_BRANCH_WITHOUT_CONDITION`, warning, for a second one) |
| Parallel | Run all branches, wait for all | Matching join (`UNMATCHED_GATEWAY`); no branch leaves early |
| Inclusive | Same as parallel | Outgoing flows carry no condition (`UNSUPPORTED_ELEMENT`); matching join |

**Condition form.** One comparison on a field of the last completed task's result: `[= ] field (=|==|!=) literal`, where the literal is a double-quoted string, a number, `true` or `false`. Examples: `= decision = "no-bid"`, `score == 70`, `is_complete = true`. Anything else, such as `>`, `and`, `or` or single quotes, is `INVALID_CONDITION_EXPRESSION`. Field names are agreed with Workflow.

**Sending work back.** A flow from an exclusive gateway back to an earlier task is a revert loop. It carries a condition, and the forward flow is the default. *Execution:* conditioned flows are tried first, in order, then the first flow without a condition, so a revert flow without a condition never runs. A loop with no forward exit is `UNGUARDED_LOOP`; a revert back to a sub-process or call is `UNSUPPORTED_REVERT_TARGET`; one gateway may send work back 50 times per instance.

```xml
<bpmn:sequenceFlow id="Flow_accept" sourceRef="Gateway_review" targetRef="Gateway_split"/>
<bpmn:sequenceFlow id="Flow_reject" sourceRef="Gateway_review" targetRef="Task_prepare">
  <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">= decision = "reject"</bpmn:conditionExpression>
</bpmn:sequenceFlow>
```

### 8.12 Sequence flows, start and end events

| Item | Rule | Error when wrong |
| --- | --- | --- |
| `sourceRef`, `targetRef` | Both set; a half-drawn flow is refused, not dropped | `INVALID_SEQUENCE_FLOW_REF` |
| Two flows from one gateway to one target | Not allowed | `DUPLICATE_SEQUENCE_FLOW` |
| Start event | One per process and sub-process | `MULTIPLE_START_EVENTS` |
| End event | No outgoing flow; ends its path (the instance, a parallel branch, or a sub-process) | `END_EVENT_WITH_OUTGOING_FLOW` |

## 9. Designer fields to BPMN

| Designer field | BPMN | Note |
| --- | --- | --- |
| Lane name | Lane `name`, plus `dept_id` from the department picker | Ids derived from names exist in no directory |
| Stage `Review` | `type="review"`, `candidateGroups="reviewer"` | |
| Stage `Approval` | `type="approve"`, `candidateGroups="approver"` | |
| Stage `Clarification`, `Handover` | `type="prep"`, `candidateGroups="preparator"` | A clarification that waits for an outside party is a receive task |
| Stage `Notify` | A send task, or a `connector:send-email` task | A user task only if a person must act |
| Default person | `candidateUsers` with the user's UUID v7 | User tasks only; send, receive and connector tasks take none |
| SLA hours | Timer boundary `PT<n>H` with an escalation path | |
| SLA warning hours | No counterpart | A second, non-interrupting timer boundary is the closest |
| Message name | `bpmn:message` plus `messageRef` on the task or boundary | |
| Error code | `bpmn:error` plus `errorRef` on the boundary | |
| Module, module version | `zeebe:calledElement processId`, `versionTag` | |
| Input and output mapping | `zeebe:ioMapping` inputs and outputs | `Depts` and `Assignees` on calls |
| Connector inputs and outputs | `zeebe:ioMapping` on the connector task | |
| Credential | Credentials route | Never in BPMN |
| Lock | No counterpart | `record_version` conflict instead |
| Stage binding | No counterpart | Agreement needed on what it is for |

**Keeping the settings in the model.** bpmn-js reads and writes Zeebe extension elements once the Camunda 8 moddle extension, the `zeebe-bpmn-moddle` package, is registered in the modeler. The values then live on the elements and `saveXML` writes them, so no side list or text rewrite of the XML is needed, and a file opened from the service shows its own values. The attached reference file opens in bpmn-js and in Camunda Modeler.

**Gaps in the designer today**, found while running it against the service:

- **Elements missing.** No gateways and no timer boundary in the palette, and flows carry no conditions.
- **Unlinked events.** Message and error boundaries carry no `messageRef` or `errorRef`, and the file holds no `bpmn:message` or `bpmn:error`.
- **Namespace missing.** The Zeebe namespace is not declared.
- **Invented ids.** Lanes and people use ids derived from names.
- **Wrong tasks need a person.** A default person is demanded on send, receive and connector tasks, where the service wants none.

## 10. Validation codes

Severity is `error` unless marked. Codes not listed here may be added later; an unknown code is shown as a generic issue.

| Code | Meaning |
| --- | --- |
| `CALLED_ELEMENT_CYCLE` | A module calls itself, directly or through others |
| `CANDIDATE_GROUPS_EMPTY` | User task role level missing or over 256 characters |
| `CANDIDATE_GROUPS_INVALID` | Role level is not `preparator`, `reviewer` or `approver` |
| `CANDIDATE_USERS_EMPTY` | A task people do has no default person (warning in a draft, error at publish) |
| `CONNECTOR_SECRET_AUTHORED` | A connector input names a credential field |
| `CONNECTOR_TASK_HAS_ASSIGNMENT` | Connector task carries an assignment (warning) |
| `CYCLE_DETECTED` | A loop has no exclusive gateway to leave it |
| `DANGLING_NODE` | Element with no flow in or out |
| `DUPLICATE_ELEMENT_ID` | Two elements share an id |
| `DUPLICATE_PROCESS_ID` | Two processes share an id |
| `DUPLICATE_SEQUENCE_FLOW` | A gateway has two flows to one target |
| `END_EVENT_WITH_OUTGOING_FLOW` | End event has an outgoing flow |
| `GATEWAY_BRANCH_WITHOUT_CONDITION` | More than one unconditioned flow at an exclusive split (warning) |
| `IGNORED_LANE_WORK` | Work in an ignored lane that cannot pass through |
| `INVALID_BOUNDARY_ATTACHMENT` | Boundary on an element that cannot carry it, or a second of its kind |
| `INVALID_CANDIDATE_USER` | Default person is not a UUID v7 |
| `INVALID_CONDITION_EXPRESSION` | Condition outside the one-comparison form |
| `INVALID_DEPT_ID` | Lane `dept_id` is not a UUID |
| `INVALID_LANE_NAME` | Lane name holds `/`, `::` or `~` |
| `INVALID_SEQUENCE_FLOW_REF` | Flow without a source or target |
| `INVALID_SLA_DURATION` | Timer duration missing, not positive, or not a duration |
| `INVALID_TASK_DEFINITION_TYPE` | Not raised |
| `INVALID_TASK_SCHEDULE` | `dueDate` or `followUpDate` is not RFC 3339 |
| `INVALID_ZEEBE_PROPERTY` | A property or call input given twice, malformed, or not allowed |
| `LANE_LIMIT_EXCEEDED` | More than 100 lanes |
| `MAX_DEPTH_EXCEEDED` | A path longer than 2000 steps |
| `MISSING_ASSIGNMENT_DEFINITION` | User task without `zeebe:assignmentDefinition` |
| `MISSING_DEPT_ID` | Lane without `dept_id` |
| `MISSING_DEPT_INPUT_FOR_MODULE` | A module's open lane is not mapped in `Depts` |
| `MISSING_DIAGRAM` | No diagram |
| `MISSING_DIAGRAM_SHAPE` | Element without a shape or edge |
| `MISSING_MESSAGE_DEFINITION` | A message flow names an undeclared message; a warning when a flow into a waiting task has no name |
| `MISSING_NAMESPACE` | BPMN or Zeebe namespace not declared |
| `MISSING_TASK_DEFINITION` | User task without `zeebe:taskDefinition` |
| `MULTIPLE_END_EVENTS` | Not raised |
| `MULTIPLE_PROCESSES` | More than one process would run |
| `MULTIPLE_START_EVENTS` | More than one start event |
| `NESTED_SUBPROCESS_NOT_SUPPORTED` | Sub-process inside a sub-process |
| `NO_END_EVENT` | No end event |
| `NO_RUNNABLE_PROCESS` | No process would run |
| `NO_START_EVENT` | No start event |
| `REJECTED_ELEMENT` | Element outside the vocabulary |
| `SPLIT_WITHOUT_GATEWAY` | Two outgoing flows from an element that is not a gateway |
| `TASK_LIMIT_EXCEEDED` | More than 1000 tasks once calls are expanded |
| `TASK_NOT_IN_LANE` | Task in no lane |
| `UNGUARDED_LOOP` | A loop that does not start at an exclusive gateway with a forward exit |
| `UNKNOWN_CONNECTOR_TYPE` | Connector type not in the registry (warning) |
| `UNKNOWN_STAGE_TYPE` | Stage type not `prep`, `review` or `approve` (warning) |
| `UNMATCHED_GATEWAY` | Split without its join |
| `UNMATCHED_MESSAGE_FLOW` | A message flow's source or target is not a known pool or element |
| `UNREACHABLE_NODE` | Element not reachable from the start |
| `UNRESOLVED_CALLED_ELEMENT` | Call names no usable process or version |
| `UNSUPPORTED_BOUNDARY_TARGET` | Boundary path does not start with a task or end event |
| `UNSUPPORTED_ELEMENT` | Element not implemented yet, or a condition on an inclusive gateway |
| `UNSUPPORTED_REVERT_TARGET` | Revert back to a sub-process or call |

HTTP codes outside validation: `BAD_REQUEST`, `INVALID_INPUT`, `INVALID_BPMN_XML`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `DRAFT_NOT_FOUND`, `DRAFT_ALREADY_EXISTS`, `DRAFT_CONCURRENCY`, `DUPLICATE_TEMPLATE_KEY`, `INVALID_VERSION_STATUS`, `NO_ACTIVE_VERSION`, `ACTIVE_INSTANCES_EXIST`, `STRUCTURAL_DIVERGENCE`, `MODULE_PROCESS_ID_CONFLICT`, `MODULE_IN_USE`, `PLAN_QUOTA_EXCEEDED`, `ASSIGNEE_INELIGIBLE`, `IDEMPOTENCY_KEY_REPLAY`, `IDEMPOTENCY_REQUEST_IN_PROGRESS`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `METHOD_NOT_ALLOWED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL_ERROR`.

## 11. Still owed

| Owner | Item |
| --- | --- |
| Platform | Read access to the Definition Service image for the frontend; access to the workflow-models and workflow-connectors repositories where wanted |
| IAM (Org & Membership) | Confirmation of the department list and department member list the designer's pickers use, and whether the member list gives each person's role level |
| Frontend and Workflow | Agreement on how `read:tender` and `update:tender` map to the roles the service checks, and on what "stage binding" is for |
| Workflow | Naming the WF-2 error-format release before it merges; confirming the *Execution* lines once the Execution Service's current changes merge |
