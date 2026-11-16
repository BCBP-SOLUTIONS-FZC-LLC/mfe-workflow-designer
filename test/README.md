# Tests

Rstest with happy-dom. The suite does not start a browser and does not need Docker. `npm test` runs every file matching `test/**/*.test.ts` and `test/**/*.test.tsx`.

| Path | What it proves |
|---|---|
| `test/setup.ts` | A signed-in test platform, the English catalog, and a reset of the Zustand stores after each test |
| `test/fixtures/platform.ts` | `startPlatform(permissions)`. The default grants are `read:tender` and `update:tender` |
| `test/unit/domain.test.ts` | Diagram placement, publish rules, upload rejection, and catalogue save and load |
| `test/unit/metrics/metrics.test.tsx` | `portal_workflows_actions_total` against [docs/observability/metrics.md](../docs/observability/metrics.md) and the SDK registry rules |
| `test/e2e/app-flows.test.tsx` | The studio journeys: list, clone, publish, export, conflict reload, modules, and starters |

The canvas skips the bpmn-js modeler when `RSTEST` is set, and renders the diagram elements as buttons so the journeys can click them. A real modeler check is a manual pass in the browser at `http://localhost:5005`.

Playwright is not part of this suite ([ADR 0003](../docs/adr/0003-test-runner.md)).
