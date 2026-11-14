# Metrics

The workflow studio's metrics under the Enterprise Platform Observability Standard. They are defined in [`src/infrastructure/telemetry/metrics.ts`](../../src/infrastructure/telemetry/metrics.ts) and recorded through the platform SDK's `/metrics` (`getServiceMeter`). `test/unit/metrics/metrics.test.tsx` fails when this page, the code and the SDK's rules disagree.

## Tier

| Tier | Used here | Why |
|---|---|---|
| 1 `platform_*` | None of our own | The registry's platform metrics describe servers, messaging and databases. The browser's Core Web Vitals (`platform_web_vitals_seconds`, `platform_web_vital_ratings_total`) are recorded by web-shell's `startWebVitals()` for the whole page, and are awaiting ratification |
| 2 `portal_*` | None | The registry has no `portal` domain metric for workflow design. Services must not invent shared metrics; a proposal goes to observability governance first |
| 3 `portal_workflows_*` | The metric below | Behaviour only this remote has |

The SDK builds the scope: inside web-shell, `domain` is this remote's manifest `ownerDomain` (`portal`) and `service` is its name (`workflows`), hence the prefix `portal_workflows_`. It injects `domain`, `service` and `environment` on every point, so the code cannot omit or misspell them. The shell exports the points (`initializeMetrics`, OTLP to `/otel`, only with telemetry consent). The standalone page exports nothing.

There is no legacy workflow-studio series. Nothing is emitted in parallel, and there is no sunset to schedule.

## Inventory

| Metric | Type | Labels (allowed values) | Meaning |
|---|---|---|---|
| `portal_workflows_actions_total` | counter | `action` (`create`, `upload`, `clone`, `archive`, `publish`, `promote`, `reload`, `export`, `save_starter`, `use_starter`, `publish_module`, `archive_module`), `outcome` (`success`, `failure`, `error`) | Workflow studio actions the user finished, by action and outcome. success means the studio accepted the change. failure means it refused the change (validation, a locked diagram, an archived workflow, a publish conflict, a blocked export, or a missing starter or version). error means the action threw. Autosave is not counted. |

Plus `domain`, `service` and `environment` on every series (SDK). Cardinality per environment: at most 36 series (12 actions × 3 outcomes). `outcome` uses the registry's vocabulary. Connector secrets, workflow ids, user ids and vault references are never labels. Autosave and credential keystrokes are not actions.

The counter records the in-memory studio's decision. The names and labels stay the same when an API replaces the store.

## Rules (checked in CI)

`npm test` runs `test/unit/metrics/metrics.test.tsx`. CI's test job runs it on every PR. It checks:

| Rule | Check |
|---|---|
| Namespace | Every name starts with `portal_workflows_`; none is a `platform_*`, a registry metric (any tier) or a legacy name |
| Suffix | Counters end in `_total`, histograms in `_seconds` |
| Required labels | `domain`, `service`, `environment` are not declared (the SDK injects them) and appear on every recorded series with `portal` / `workflows` |
| Prohibited labels | No registry-prohibited name or suffix (`*_id`, `email`, `user`, `path`, …); at most 8 labels |
| Label vocabulary | Every label has a closed value set, enforced by `recordMetric`'s types; `outcome` values come from the registry's vocabulary, and the SDK drops a value outside it at run time (it also caps any other label at 100 values) |
| SDK compliance | With the remote in the manifest, the SDK accepts every definition (its own namespace, suffix, label and registry checks) |
| Inventory | This table matches `src/infrastructure/telemetry/metrics.ts` |

## Dashboards, alerts, recording rules and SLOs (proposals)

This repository does not hold the platform's Prometheus or Grafana configuration. Whoever owns the frontend dashboards can start from these. Series arrive with OTLP delta temporality and are stored as Prometheus counters.

```promql
# Recording rules
portal_workflows:actions:rate5m = sum by (environment, action, outcome) (rate(portal_workflows_actions_total[5m]))
portal_workflows:publish_failures:ratio5m =
  sum by (environment) (rate(portal_workflows_actions_total{action="publish",outcome="failure"}[5m]))
  / sum by (environment) (rate(portal_workflows_actions_total{action="publish"}[5m]))
portal_workflows:action_errors:ratio5m =
  sum by (environment) (rate(portal_workflows_actions_total{outcome="error"}[5m]))
  / sum by (environment) (rate(portal_workflows_actions_total[5m]))
```

| Proposal | Expression | Threshold |
|---|---|---|
| Alert: publishes refused | `portal_workflows:publish_failures:ratio5m` | > 20% for 15 min, with at least 20 publish actions in the window |
| Alert: actions throwing | `portal_workflows:action_errors:ratio5m` | > 1% for 10 min, with at least 20 actions in the window |
| SLO: publish acceptance | `outcome="success"` / all `portal_workflows_actions_total{action="publish"}` | 95% over 28 days |

A refused publish is often a validation failure or a conflict the user can fix, so the acceptance SLO is lower than a read-availability SLO. Thresholds are starting points. Browser metrics depend on consent, so absolute counts undercount traffic: alert on ratios, not on volume.

**HPA:** not applicable. The remote is static files (S3/CloudFront, or nginx); nothing scales on these metrics.

## Runbook

| Symptom | Check |
|---|---|
| No `portal_workflows_*` series at all | Is the remote in the environment's `/remotes/manifest.json` with `ownerDomain: "portal"`? Without it the SDK cannot scope the metrics and the console shows `workflows metrics unavailable` once. Is the shell's telemetry enabled (`runtime.json` `telemetry.enabled`) and is `/otel` routed to the collector? Did the user grant telemetry consent? |
| Series under another `domain` or `service` | The manifest key or `ownerDomain` changed. The prefix check in the SDK then drops the points (`workflows metrics unavailable`). Fix the manifest; renaming the metrics is a contract change |
| Publish failures up | `outcome="failure"` on `action="publish"` is a refused publish: validation, a lock, an archived workflow, or a conflict. It is not a thrown error |
| Action errors up | `outcome="error"` means the studio threw while applying the action. Check the shell's error boundary and the remote's logs for the same window |
| Exports missing | `action="export"` counts a finished export. `outcome="failure"` means the diagram still held credential material and the file was not downloaded |

## Changing a metric

Names, labels and their values are part of the observability contract. Adding a metric or a label value: add it to `src/infrastructure/telemetry/metrics.ts` and this table in the same PR. Renaming or removing one: emit old and new in parallel, move dashboards, alerts, recording rules and SLOs, then remove the old one after the agreed sunset (the standard's migration process), with a CHANGELOG entry at each step. A metric that other services could emit with the same meaning is proposed to the Platform Observability Registry, not added here as Tier 3.
