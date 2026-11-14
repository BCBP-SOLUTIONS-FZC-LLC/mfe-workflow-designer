// Workflow studio metrics, per the Enterprise Platform Observability Standard, through the SDK's
// /metrics (never a meter of our own). These are Tier 3 and service-specific: no platform_* or
// portal_* (domain) metric in the registry describes a workflow publish, export, or library change,
// and services must not invent shared ones. The SDK names the scope: inside web-shell the domain is
// this remote's manifest ownerDomain ('portal') and the service is its name ('workflows'), so the
// prefix is portal_workflows_. It injects domain, service and environment on every point, checks
// suffixes, prohibited labels and the label cap, and the shell exports (consent-gated, OTLP).
//
// Every label has a closed value set here, enforced by the type of recordMetric's labels at compile
// time. At run time the SDK validates each point itself (declared labels, registry vocabularies such
// as outcome, non-negative values, the per-label value cap) and drops what fails: this module does
// not repeat those checks. test/unit/metrics/metrics.test.tsx checks these definitions against the
// SDK's rules and docs/observability/metrics.md, so the inventory cannot drift from the code.
import { getServiceMeter, type Counter, type Histogram } from '@bcbp-solutions-fzc-llc/frontend-sdk/metrics'
import { getLogger } from '@bcbp-solutions-fzc-llc/frontend-sdk/logging'
import { workflowReducer, type Action } from '../../application/commands/reducer'
import type { AppState } from '../../domain/entities/types'
import { APP_ID } from '../../shared/constants/app'

export const METRIC_PREFIX = 'portal_workflows_'

export const WORKFLOW_ACTIONS = [
  'create',
  'upload',
  'clone',
  'archive',
  'publish',
  'promote',
  'reload',
  'export',
  'save_starter',
  'use_starter',
  'publish_module',
  'archive_module',
] as const

export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number]
export type WorkflowOutcome = 'success' | 'failure' | 'error'

type Definition = {
  readonly name: string
  readonly type: 'counter' | 'histogram'
  readonly help: string
  /** Label name → its closed set of values (bounded cardinality). */
  readonly labels: Readonly<Record<string, readonly string[]>>
}

export const METRICS = {
  actions: {
    name: 'portal_workflows_actions_total',
    type: 'counter',
    help: 'Workflow studio actions the user finished, by action and outcome. success means the studio accepted the change. failure means it refused the change (validation, a locked diagram, an archived workflow, a publish conflict, a blocked export, or a missing starter or version). error means the action threw. Autosave is not counted.',
    labels: { action: WORKFLOW_ACTIONS, outcome: ['success', 'failure', 'error'] as const },
  },
} as const satisfies Record<string, Definition>

type Metrics = typeof METRICS
type Labels<K extends keyof Metrics> = { [L in keyof Metrics[K]['labels']]: Metrics[K]['labels'][L] extends readonly (infer V)[] ? V : never }

const ACTION_NAME: Partial<Record<Action['type'], WorkflowAction>> = {
  createBlank: 'create',
  upload: 'upload',
  clone: 'clone',
  archive: 'archive',
  publish: 'publish',
  promote: 'promote',
  reload: 'reload',
  saveStarter: 'save_starter',
  createFromStarter: 'use_starter',
  publishModule: 'publish_module',
  archiveModule: 'archive_module',
}

let warned = false

/**
 * The instrument for `def`, or undefined. Made on each use, not at import: the SDK defines an
 * instrument as soon as the page has an identity and needs this remote in the manifest for its
 * domain, which inside web-shell is true before ./App loads. The SDK keeps one instrument per name,
 * so a repeat call returns the same one. Standalone, with no manifest, it fails: that is logged once
 * and nothing is recorded (the standalone page exports no metrics anyway).
 */
function instrument(def: Definition): Counter | Histogram | undefined {
  try {
    const meter = getServiceMeter({ mfe: APP_ID })
    const labels = Object.keys(def.labels)
    return def.type === 'counter' ? meter.counter(def.name, def.help, labels) : meter.histogram(def.name, def.help, labels)
  } catch (error) {
    if (!warned) getLogger({ mfe: APP_ID }).warn('workflows metrics unavailable', { error, metric: def.name })
    warned = true
    return undefined
  }
}

/** Records one point of metric `key`; `labels` is typed to the metric's closed value sets. */
export function recordMetric<K extends keyof Metrics>(key: K, value: number, labels: Labels<K>): void {
  const def: Definition = METRICS[key]
  const inst = instrument(def)
  if (!inst) return
  if (def.type === 'counter') (inst as Counter).add(value, labels as Record<string, string>)
  else (inst as Histogram).record(value, labels as Record<string, string>)
}

/** One finished studio action. Export is recorded here; other actions go through recordFromReducer. */
export function recordWorkflowAction(action: WorkflowAction, outcome: WorkflowOutcome): void {
  recordMetric('actions', 1, { action, outcome })
}

/**
 * How the reducer treated `action`, read from the state it returns. Autosave, notices and
 * credential keystrokes are ignored: they are not finished actions, and a secret must never be a label.
 */
export function reducerOutcome(prev: AppState, action: Action): WorkflowOutcome | 'ignored' {
  const name = ACTION_NAME[action.type]
  if (!name) return 'ignored'
  const next = workflowReducer(prev, action)
  switch (action.type) {
    case 'createBlank':
    case 'upload':
    case 'clone':
    case 'createFromStarter':
      return next.workflows.some((workflow) => workflow.id === `wf-${prev.seq}`) ? 'success' : 'failure'
    case 'archive':
      return next.workflows.find((workflow) => workflow.id === action.workflowId)?.status === 'archived' ? 'success' : 'failure'
    case 'publish': {
      const before = prev.workflows.find((workflow) => workflow.id === action.workflowId)
      const after = next.workflows.find((workflow) => workflow.id === action.workflowId)
      if (!before || !after) return 'failure'
      return after.publishedAt !== before.publishedAt ? 'success' : 'failure'
    }
    case 'reload':
      return prev.workflows.some((workflow) => workflow.id === action.workflowId) ? 'success' : 'failure'
    case 'promote': {
      const after = next.workflows.find((workflow) => workflow.id === action.workflowId)
      return after?.activeVersionId === action.versionId ? 'success' : 'failure'
    }
    case 'saveStarter':
      return next.starters.length > prev.starters.length ? 'success' : 'failure'
    case 'publishModule': {
      const before = prev.modules.find((module) => module.id === action.moduleId)
      const after = next.modules.find((module) => module.id === action.moduleId)
      return (after?.versions.length ?? 0) > (before?.versions.length ?? 0) ? 'success' : 'failure'
    }
    case 'archiveModule':
      return next.modules.find((module) => module.id === action.moduleId)?.status === 'archived' ? 'success' : 'failure'
    default:
      return 'ignored'
  }
}

/** Records the reducer's outcome for `action`. Autosave and notices record nothing. */
export function recordFromReducer(prev: AppState, action: Action): void {
  const name = ACTION_NAME[action.type]
  const outcome = reducerOutcome(prev, action)
  if (!name || outcome === 'ignored') return
  recordWorkflowAction(name, outcome)
}

/** The reducer call threw. Autosave and notices still record nothing. */
export function recordReducerError(action: Action): void {
  const name = ACTION_NAME[action.type]
  if (!name) return
  recordWorkflowAction(name, 'error')
}
