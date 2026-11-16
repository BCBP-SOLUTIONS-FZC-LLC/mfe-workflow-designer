import { msg } from '../../shared/copy'
import { blankDiagram, isProcessDocument, reconcileNodes } from '../../domain/rules/diagram'
import { deriveValidity, validateWorkflow } from '../../domain/rules/validation'
import { keyFromName } from '../queries/query'
import {
  activeVersion,
  editingVersion,
  type AppState,
  type ModuleRecord,
  type NodeConfig,
  type Notice,
  type Starter,
  type Workflow,
  type WorkflowVersion,
} from '../../domain/entities/types'

function banner(key: string, vars?: Record<string, string | number>): Notice {
  return vars ? { key, vars } : { key }
}

export type Action =
  | { type: 'dismissNotice' }
  | { type: 'notify'; notice: Notice }
  | { type: 'createBlank'; name: string; key: string; stageBinding: string; now: string }
  | { type: 'createFromStarter'; starterId: string; name: string; now: string }
  | { type: 'upload'; name: string; xml: string; now: string }
  | { type: 'clone'; workflowId: string; now: string }
  | { type: 'archive'; workflowId: string }
  | { type: 'saveDraft'; workflowId: string; xml: string; nodes: NodeConfig[]; now: string }
  | { type: 'publish'; workflowId: string; xml: string; nodes: NodeConfig[]; actor: string; now: string }
  | { type: 'reload'; workflowId: string; now: string }
  | { type: 'promote'; workflowId: string; versionId: string }
  | { type: 'saveStarter'; workflowId: string; versionId: string }
  | { type: 'setCredential'; workflowId: string; elementId: string; vaultRef: string; secret: string }
  | { type: 'publishModule'; moduleId: string; now: string }
  | { type: 'archiveModule'; moduleId: string }

function secretsOf(state: AppState): string[] {
  return Object.values(state.credentials).map((entry) => entry.secret)
}

function replaceWorkflow(state: AppState, id: string, updater: (workflow: Workflow) => Workflow): AppState {
  return {
    ...state,
    workflows: state.workflows.map((workflow) => (workflow.id === id ? updater(workflow) : workflow)),
  }
}

function uniqueKey(state: AppState, key: string): string {
  const taken = new Set(state.workflows.map((workflow) => workflow.key))
  if (!taken.has(key)) return key
  let n = 2
  while (taken.has(`${key}-${n}`)) n += 1
  return `${key}-${n}`
}

function versionLabel(workflow: Workflow): string {
  const numbers = workflow.versions
    .map((version) => /^v(\d+)$/.exec(version.label)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
  return `v${Math.max(0, ...numbers) + 1}`
}

function bumpPatch(label: string): string {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(label)
  if (!match) return `${label}.1`
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}

function writeDraft(workflow: Workflow, xml: string, nodes: NodeConfig[], now: string, secrets: string[]): Workflow {
  if (workflow.lockedBy) return workflow
  const validity = deriveValidity(xml, nodes, secrets)
  if (workflow.draftVersionId) {
    return {
      ...workflow,
      validity: workflow.status === 'archived' ? workflow.validity : validity,
      versions: workflow.versions.map((version) =>
        version.id === workflow.draftVersionId
          ? { ...version, xml, nodes, recordVersion: version.recordVersion + 1, createdAt: now }
          : version,
      ),
    }
  }
  const source = activeVersion(workflow)
  const draft: WorkflowVersion = {
    id: `${workflow.id}-draft`,
    label: msg('version.draft'),
    state: 'draft',
    recordVersion: (source?.recordVersion ?? 0) + 1,
    createdAt: now,
    createdBy: msg('version.you'),
    note: msg('version.autosaved'),
    xml,
    nodes,
  }
  return {
    ...workflow,
    draftVersionId: draft.id,
    validity: workflow.status === 'archived' ? workflow.validity : validity,
    versions: [...workflow.versions, draft],
  }
}

function makeWorkflow(input: {
  id: string
  name: string
  key: string
  description: string
  stageBinding: string
  xml: string
  nodes: NodeConfig[]
  now: string
  secrets: string[]
}): Workflow {
  const draft: WorkflowVersion = {
    id: `${input.id}-draft`,
    label: msg('version.draft'),
    state: 'draft',
    recordVersion: 1,
    createdAt: input.now,
    createdBy: msg('version.you'),
    note: msg('version.created'),
    xml: input.xml,
    nodes: input.nodes,
  }
  return {
    id: input.id,
    name: input.name,
    key: input.key,
    description: input.description,
    status: 'draft',
    stageBinding: input.stageBinding,
    validity: deriveValidity(input.xml, input.nodes, input.secrets),
    activeVersionId: null,
    draftVersionId: draft.id,
    versions: [draft],
    runningInstances: 0,
    usages: [],
    lockedBy: null,
    conflictArmed: false,
    serverRecordVersion: 1,
    serverXml: input.xml,
    serverNodes: input.nodes,
    publishedAt: null,
    publishedBy: null,
  }
}

export function workflowReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'dismissNotice':
      return { ...state, notice: null }
    case 'notify':
      return { ...state, notice: action.notice }
    case 'createBlank': {
      const id = `wf-${state.seq}`
      const xml = blankDiagram()
      const workflow = makeWorkflow({
        id,
        name: action.name.trim() || msg('workflow.untitled'),
        key: uniqueKey(state, action.key.trim() || keyFromName(action.name)),
        description: msg('workflow.blankDescription'),
        stageBinding: action.stageBinding.trim() || msg('workflow.unassigned'),
        xml,
        nodes: [],
        now: action.now,
        secrets: secretsOf(state),
      })
      return { ...state, seq: state.seq + 1, workflows: [workflow, ...state.workflows], notice: banner('notice.created', { name: workflow.name }) }
    }
    case 'createFromStarter': {
      const starter = state.starters.find((item) => item.id === action.starterId)
      if (!starter) return { ...state, notice: banner('notice.starterMissing') }
      const id = `wf-${state.seq}`
      const name = action.name.trim() || starter.name
      const workflow = makeWorkflow({
        id,
        name,
        key: uniqueKey(state, keyFromName(name)),
        description: starter.summary,
        stageBinding: starter.stageBinding,
        xml: starter.xml,
        nodes: starter.nodes.map((node) => ({ ...node })),
        now: action.now,
        secrets: secretsOf(state),
      })
      return {
        ...state,
        seq: state.seq + 1,
        workflows: [workflow, ...state.workflows],
        notice: banner('notice.opened', { name: starter.name }),
      }
    }
    case 'upload': {
      if (!isProcessDocument(action.xml)) return { ...state, notice: banner('notice.uploadRejected') }
      const id = `wf-${state.seq}`
      const name = action.name.trim() || msg('workflow.uploaded')
      const nodes = reconcileNodes(action.xml, [])
      const workflow = makeWorkflow({
        id,
        name,
        key: uniqueKey(state, keyFromName(name)),
        description: msg('workflow.uploadedDescription'),
        stageBinding: msg('workflow.unassigned'),
        xml: action.xml,
        nodes,
        now: action.now,
        secrets: secretsOf(state),
      })
      return { ...state, seq: state.seq + 1, workflows: [workflow, ...state.workflows], notice: banner('notice.uploaded', { name }) }
    }
    case 'clone': {
      const source = state.workflows.find((workflow) => workflow.id === action.workflowId)
      const version = source ? editingVersion(source) : null
      if (!source || !version) return state
      const id = `wf-${state.seq}`
      const name = msg('workflow.copyName', { name: source.name })
      const workflow = makeWorkflow({
        id,
        name,
        key: uniqueKey(state, `${source.key}-copy`),
        description: source.description,
        stageBinding: source.stageBinding,
        xml: version.xml,
        nodes: version.nodes.map((node) => ({ ...node })),
        now: action.now,
        secrets: [],
      })
      return { ...state, seq: state.seq + 1, workflows: [workflow, ...state.workflows], notice: banner('notice.cloned', { name: source.name }) }
    }
    case 'archive':
      return {
        ...replaceWorkflow(state, action.workflowId, (workflow) => ({ ...workflow, status: 'archived' })),
        notice: banner('notice.archived', {
          name: state.workflows.find((workflow) => workflow.id === action.workflowId)?.name ?? msg('workflow.fallback'),
        }),
      }
    case 'saveDraft': {
      const workflow = state.workflows.find((item) => item.id === action.workflowId)
      if (!workflow || workflow.lockedBy) return state
      return replaceWorkflow(state, action.workflowId, (current) =>
        writeDraft(current, action.xml, action.nodes, action.now, secretsOf(state)),
      )
    }
    case 'publish': {
      const workflow = state.workflows.find((item) => item.id === action.workflowId)
      if (!workflow) return state
      if (workflow.status === 'archived') return { ...state, notice: banner('notice.archiveBlocked') }
      if (workflow.lockedBy) return { ...state, notice: banner('notice.locked', { name: workflow.lockedBy }) }
      const issues = validateWorkflow(action.xml, action.nodes, secretsOf(state))
      const drafted = writeDraft(workflow, action.xml, action.nodes, action.now, secretsOf(state))
      if (issues.length) {
        return { ...replaceWorkflow(state, workflow.id, () => drafted), notice: issues[0] ? banner(issues[0].code, issues[0].vars) : banner('notice.invalid') }
      }
      if (workflow.conflictArmed) {
        return { ...replaceWorkflow(state, workflow.id, () => drafted), conflictWorkflowId: workflow.id }
      }
      const published: WorkflowVersion = {
        id: `${workflow.id}-${versionLabel(workflow)}`,
        label: versionLabel(workflow),
        state: 'published',
        recordVersion: (drafted.versions.find((version) => version.id === drafted.draftVersionId)?.recordVersion ?? 1),
        createdAt: action.now,
        createdBy: action.actor,
        note: msg('version.published'),
        xml: action.xml,
        nodes: action.nodes,
      }
      const versions = drafted.versions
        .filter((version) => version.id !== drafted.draftVersionId)
        .map((version) => (version.state === 'published' ? { ...version, state: 'retired' as const } : version))
      const next: Workflow = {
        ...drafted,
        status: 'published',
        activeVersionId: published.id,
        draftVersionId: null,
        versions: [...versions, published],
        validity: 'valid',
        conflictArmed: false,
        serverRecordVersion: published.recordVersion,
        serverXml: action.xml,
        serverNodes: action.nodes,
        publishedAt: action.now,
        publishedBy: action.actor,
      }
      return {
        ...replaceWorkflow(state, workflow.id, () => next),
        seq: state.seq + 1,
        conflictWorkflowId: null,
        notice: banner('notice.published', { name: workflow.name }),
      }
    }
    case 'reload': {
      const workflow = state.workflows.find((item) => item.id === action.workflowId)
      if (!workflow) return state
      const drafted = writeDraft(workflow, workflow.serverXml, workflow.serverNodes, action.now, secretsOf(state))
      const next: Workflow = {
        ...drafted,
        conflictArmed: false,
        versions: drafted.versions.map((version) =>
          version.id === drafted.draftVersionId
            ? {
                ...version,
                xml: workflow.serverXml,
                nodes: workflow.serverNodes.map((node) => ({ ...node })),
                recordVersion: workflow.serverRecordVersion,
                note: msg('version.reloaded'),
              }
            : version,
        ),
        validity: deriveValidity(workflow.serverXml, workflow.serverNodes, secretsOf(state)),
      }
      return {
        ...replaceWorkflow(state, workflow.id, () => next),
        conflictWorkflowId: null,
        reloadGeneration: {
          ...state.reloadGeneration,
          [workflow.id]: (state.reloadGeneration[workflow.id] ?? 0) + 1,
        },
        notice: banner('notice.reloaded'),
      }
    }
    case 'promote': {
      const workflow = state.workflows.find((item) => item.id === action.workflowId)
      const version = workflow?.versions.find((item) => item.id === action.versionId)
      if (!workflow || !version || version.state === 'draft') return state
      return {
        ...replaceWorkflow(state, workflow.id, (current) => ({
          ...current,
          activeVersionId: version.id,
          status: 'published',
          versions: current.versions.map((item) =>
            item.id === version.id ? { ...item, state: 'published' } : item,
          ),
        })),
        notice: banner('notice.promoted', { label: version.label }),
      }
    }
    case 'saveStarter': {
      const workflow = state.workflows.find((item) => item.id === action.workflowId)
      const version = workflow?.versions.find((item) => item.id === action.versionId)
      if (!workflow || !version || version.state === 'draft') {
        return { ...state, notice: banner('notice.starterDraft') }
      }
      const starter: Starter = {
        id: `starter-${state.seq}`,
        name: workflow.name,
        category: msg('starter.saved'),
        summary: workflow.description,
        stageBinding: workflow.stageBinding,
        xml: version.xml,
        nodes: version.nodes.map((node) => ({ ...node })),
      }
      return {
        ...state,
        seq: state.seq + 1,
        starters: [starter, ...state.starters],
        notice: banner('notice.savedStarter', { name: workflow.name }),
      }
    }
    case 'setCredential': {
      const key = `${action.workflowId}:${action.elementId}`
      return {
        ...state,
        credentials: {
          ...state.credentials,
          [key]: { vaultRef: action.vaultRef, secret: action.secret },
        },
      }
    }
    case 'publishModule': {
      return {
        ...state,
        modules: state.modules.map((module) => publishModule(module, action.moduleId, action.now)),
        notice: banner('notice.modulePublished'),
      }
    }
    case 'archiveModule': {
      const module = state.modules.find((item) => item.id === action.moduleId)
      return {
        ...state,
        modules: state.modules.map((item) =>
          item.id === action.moduleId ? { ...item, status: 'archived' } : item,
        ),
        notice: banner('notice.archived', { name: module?.name ?? msg('workflow.moduleFallback') }),
      }
    }
    default:
      return state
  }
}

function publishModule(module: ModuleRecord, moduleId: string, now: string): ModuleRecord {
  if (module.id !== moduleId) return module
  const latest = module.versions[0]?.label ?? '0.1.0'
  return {
    ...module,
    status: 'published',
    versions: [{ label: bumpPatch(latest), publishedAt: now, note: msg('modules.publishedNote') }, ...module.versions],
  }
}

export function credentialFor(state: AppState, workflowId: string, elementId: string) {
  return state.credentials[`${workflowId}:${elementId}`] ?? null
}
