// CI validation of the workflow studio's metrics against the Enterprise Platform Observability
// Standard (docs/observability/metrics.md): namespace, suffixes, required and prohibited labels,
// label vocabularies, SDK and registry compliance, and the inventory page. Then what the code records.
import { loadManifest } from '@bcbp-solutions-fzc-llc/frontend-sdk/mfe'
import { createTestPlatform, renderMetricInventory } from '@bcbp-solutions-fzc-llc/frontend-sdk/testing'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@rstest/core'
import { editingVersion } from '../../../src/domain/entities/types'
import { METRICS, METRIC_PREFIX, recordFromReducer, recordMetric, recordWorkflowAction } from '../../../src/infrastructure/telemetry/metrics'
import { createInitialState } from '../../../src/infrastructure/storage/seed'
import { APP_ID } from '../../../src/shared/constants/app'

const ROOT = join(import.meta.dirname, '../../..')
type Registry = {
  constLabels: string[]
  prohibitedLabels: string[]
  prohibitedLabelSuffixes: string[]
  exemptPrefixes: string[]
  labels: Record<string, { values?: string[] }>
  metrics: { name: string }[] | Record<string, unknown>
  legacyNames: string[]
}
const registry = JSON.parse(
  readFileSync(join(ROOT, 'node_modules/@bcbp-solutions-fzc-llc/frontend-sdk/contracts/metric-registry.json'), 'utf8'),
) as Registry
const registryNames = new Set(Array.isArray(registry.metrics) ? registry.metrics.map((metric) => metric.name) : Object.keys(registry.metrics))
const definitions = Object.values(METRICS)

/** This remote in the manifest, as web-shell loads it before ./App: the SDK scopes metrics by it. */
async function inShell() {
  createTestPlatform()
  const previous = globalThis.fetch
  globalThis.fetch = async () =>
    Response.json({ [APP_ID]: { entry: '/remotes/workflows/0.0.0/remoteEntry.js', version: '0.0.0', ownerDomain: 'portal' } })
  try {
    await loadManifest()
  } finally {
    globalThis.fetch = previous
  }
}

/** The recorded series of `name` (Prometheus text from the SDK), without HELP/TYPE lines. */
const series = (name: string) =>
  renderMetricInventory()
    .split('\n')
    .filter((line) => line.startsWith(`${name}{`) || line.startsWith(`${name} `))

describe('metric definitions (observability standard)', () => {
  it('are Tier 3: portal_workflows_*, never platform_*, a registry metric or a legacy name', () => {
    expect(METRIC_PREFIX).toBe(`portal_${APP_ID}_`)
    for (const definition of definitions) {
      expect(definition.name, definition.name).toMatch(/^portal_workflows_[a-z0-9_]+$/)
      expect(registryNames.has(definition.name), definition.name).toBe(false)
      expect(registry.legacyNames, definition.name).not.toContain(definition.name)
      expect(registry.exemptPrefixes.some((prefix) => definition.name.startsWith(prefix)), definition.name).toBe(false)
    }
  })

  it('end counters in _total and histograms in _seconds', () => {
    for (const definition of definitions) expect(definition.name, definition.name).toMatch(definition.type === 'counter' ? /_total$/ : /_seconds$/)
  })

  it('declare no central or prohibited label, at most 8, each with a closed value set', () => {
    for (const definition of definitions) {
      const labels = Object.keys(definition.labels)
      expect(labels.length, definition.name).toBeLessThanOrEqual(8)
      for (const label of labels) {
        expect(label, definition.name).toMatch(/^[a-z][a-z0-9_]*$/)
        expect(registry.constLabels, definition.name).not.toContain(label)
        expect(registry.prohibitedLabels, definition.name).not.toContain(label)
        expect(registry.prohibitedLabelSuffixes.some((suffix) => label.endsWith(suffix)), `${definition.name} ${label}`).toBe(false)
        const values = (definition.labels as Record<string, readonly string[]>)[label]!
        expect(values.length, `${definition.name} ${label}`).toBeGreaterThan(0)
        const vocabulary = registry.labels[label]?.values
        if (vocabulary) for (const value of values) expect(vocabulary, `${definition.name} ${label}=${value}`).toContain(value)
      }
    }
  })

  it('are accepted by the SDK, which injects domain, service and environment', async () => {
    await inShell()
    recordMetric('actions', 1, { action: 'publish', outcome: 'success' })
    const inventory = renderMetricInventory()
    for (const definition of definitions) {
      expect(inventory, definition.name).toContain(`# TYPE ${definition.name} ${definition.type}`)
      for (const line of series(definition.name)) expect(line).toMatch(/domain="portal",environment="test",.*service="workflows"/)
    }
  })

  it('match the inventory in docs/observability/metrics.md', () => {
    const doc = readFileSync(join(ROOT, 'docs/observability/metrics.md'), 'utf8')
    const rows = new Map(
      [...doc.matchAll(/^\| `(portal_workflows_[a-z0-9_]+)` \| (\w+) \| ([^|]*) \| ([^|]*) \|$/gm)].map((match) => [match[1]!, match]),
    )
    expect([...rows.keys()].sort()).toEqual(definitions.map((definition) => definition.name).sort())
    for (const definition of definitions) {
      const row = rows.get(definition.name)!
      expect(row[2], definition.name).toBe(definition.type)
      const labels = Object.entries(definition.labels as Record<string, readonly string[]>)
        .map(([label, values]) => `\`${label}\` (${values.map((value) => `\`${value}\``).join(', ')})`)
        .join(', ')
      expect(row[3]!.trim(), definition.name).toBe(labels || '—')
      expect(row[4]!.trim(), definition.name).toBe(definition.help)
    }
  })
})

describe('recording', () => {
  const now = '2026-11-14T00:00:00.000Z'

  function publish(id: string) {
    const state = createInitialState()
    const workflow = state.workflows.find((item) => item.id === id)!
    const version = editingVersion(workflow)!
    recordFromReducer(state, { type: 'publish', workflowId: id, xml: version.xml, nodes: version.nodes, actor: 'Avery Chen', now })
  }

  it('leaves run-time validation to the SDK: it drops a value outside a registry vocabulary', async () => {
    await inShell()
    recordMetric('actions', 1, { action: 'publish', outcome: 'timeout' as never })
    expect(series('portal_workflows_actions_total')).toEqual([])
  })

  it('records nothing and warns once without the remote in the manifest (standalone)', () => {
    const { logs } = createTestPlatform()
    expect(() => {
      recordWorkflowAction('export', 'success')
      recordWorkflowAction('export', 'failure')
    }).not.toThrow()
    expect(series('portal_workflows_actions_total')).toEqual([])
    expect(logs.filter((log) => log.body === 'workflows metrics unavailable').length).toBeLessThanOrEqual(1)
  })

  it('counts a refused publish, a conflict and a lock as failure, and an accepted publish as success', async () => {
    await inShell()
    publish('wf-clarification')
    publish('wf-award')
    publish('wf-signature')
    publish('wf-intake')
    const lines = series('portal_workflows_actions_total')
    expect(lines.some((line) => line.includes('action="publish"') && line.includes('outcome="failure"'))).toBe(true)
    expect(lines.some((line) => line.includes('action="publish"') && line.includes('outcome="success"'))).toBe(true)
  })

  it('does not count an autosave', async () => {
    await inShell()
    const state = createInitialState()
    const workflow = state.workflows.find((item) => item.id === 'wf-intake')!
    const version = editingVersion(workflow)!
    recordFromReducer(state, { type: 'saveDraft', workflowId: workflow.id, xml: version.xml, nodes: version.nodes, now })
    expect(series('portal_workflows_actions_total')).toEqual([])
  })
})
