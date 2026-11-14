# Observability

How this remote fits the Enterprise Platform Observability Standard. The metric inventory, label rules, and the test that keeps the page and the code identical are in [observability/metrics.md](observability/metrics.md).

| | Value |
|---|---|
| Tier | 3 only |
| Prefix | `portal_workflows_` |
| Metric | `portal_workflows_actions_total` |
| Labels | `action`, `outcome` (`success`, `failure`, `error`) |
| Export | The shell, when this remote is in the manifest |

No `platform_*` or domain-shared `portal_*` metric is declared here. Autosave, notice dismissal, and credential keystrokes are not counted. Connector secrets, workflow ids, and user ids are not labels.

Standalone `npm run dev` has no manifest meter. The studio logs once that metrics are unavailable and keeps working.
