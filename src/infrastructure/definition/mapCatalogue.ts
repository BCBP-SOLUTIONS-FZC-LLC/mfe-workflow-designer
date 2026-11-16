import { reconcileNodes } from '../../domain/rules/diagram'
import type { AppState, ModuleRecord, Notice, Starter, Workflow, WorkflowVersion } from '../../domain/entities/types'
import type { ModuleContract, ModuleSummary, StarterTemplate, VersionDetail, WorkflowDetail } from './client'

export function emptyCatalogue(notice: Notice | null = null): AppState {
  return {
    workflows: [],
    modules: [],
    starters: [],
    credentials: {},
    seq: 1,
    notice,
    conflictWorkflowId: null,
    reloadGeneration: {},
  }
}

function versionOf(detail: VersionDetail): WorkflowVersion {
  const draft = detail.status === 'DRAFT'
  return {
    id: detail.id,
    label: draft || detail.version_number == null ? 'Draft' : `v${detail.version_number}`,
    state: detail.status === 'PUBLISHED' ? 'published' : detail.status === 'ARCHIVED' ? 'retired' : 'draft',
    recordVersion: detail.record_version,
    createdAt: detail.created_at,
    createdBy: detail.created_by_user_id,
    note: draft ? '' : detail.status,
    xml: detail.bpmn_xml,
    nodes: reconcileNodes(detail.bpmn_xml, []),
  }
}

export function workflowFromService(detail: WorkflowDetail, versions: VersionDetail[]): Workflow {
  const mapped = versions.map(versionOf)
  const draft = mapped.find((version) => version.state === 'draft') ?? null
  const active = mapped.find((version) => version.id === detail.active_version_id) ?? null
  const editing = draft ?? active ?? mapped[0] ?? null
  const status = detail.active_version_id ? 'published' : detail.has_draft ? 'draft' : 'archived'
  return {
    id: detail.id,
    name: detail.name,
    key: detail.key,
    description: detail.description,
    status,
    stageBinding: '',
    validity: editing == null ? 'unknown' : versions.find((version) => version.id === editing.id)?.is_valid ? 'valid' : 'invalid',
    activeVersionId: detail.active_version_id ?? null,
    draftVersionId: draft?.id ?? null,
    versions: mapped,
    runningInstances: 0,
    usages: [],
    lockedBy: null,
    conflictArmed: false,
    serverRecordVersion: draft?.recordVersion ?? active?.recordVersion ?? 0,
    serverXml: active?.xml ?? draft?.xml ?? '',
    serverNodes: active?.nodes ?? draft?.nodes ?? [],
    publishedAt: active?.createdAt ?? null,
    publishedBy: active?.createdBy ?? null,
  }
}

export function moduleFromService(summary: ModuleSummary, contract: ModuleContract | null): ModuleRecord {
  return {
    id: summary.id,
    name: summary.name,
    scope: summary.scope === 'global' ? 'platform' : 'tenant',
    status: summary.active_version_id ? 'published' : 'archived',
    summary: summary.description,
    contract: summary.process_id,
    assignmentKeys: contract?.tasks.map((task) => task.assignee_key) ?? [],
    messages: contract?.messages ?? [],
    errorCodes: contract?.error_codes ?? [],
    usedBy: [],
    versions: summary.active_version_id
      ? [{ label: summary.active_version_id, publishedAt: '', note: summary.process_id }]
      : [],
  }
}

export function starterFromService(starter: StarterTemplate): Starter {
  return {
    id: starter.id,
    name: starter.name,
    category: starter.category ?? (starter.scope === 'global' ? 'platform' : 'tenant'),
    summary: starter.description,
    stageBinding: '',
    xml: starter.bpmn_xml,
    nodes: reconcileNodes(starter.bpmn_xml, []),
  }
}
