import { formatDate } from '@bcbp-solutions-fzc-llc/frontend-sdk/i18n'
import { activeVersion, editingVersion, type NodeConfig, type Workflow } from '../../domain/entities/types'
import { msg } from '../../shared/copy'

export { activeVersion, editingVersion }
export type { ModuleRecord, NodeConfig, SecureCredential } from '../../domain/entities/types'

const STAMP: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }

/** A calendar day from the SDK's locale formatter. The time of day is ignored so a zone cannot shift the date. */
export function formatStamp(iso: string | null): string {
  if (!iso) return msg('value.notPublished')
  return formatDate(iso.slice(0, 10), STAMP) || msg('value.notPublished')
}

export function publicationLabel(workflow: Workflow): string {
  if (!workflow.publishedAt || !workflow.publishedBy) return msg('value.notPublished')
  return msg('publication.by', { date: formatStamp(workflow.publishedAt), name: workflow.publishedBy })
}

export function keyFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'workflow'
}

export function workflowBase(pathname: string): string {
  const marker = '/workflows'
  const index = pathname.indexOf(marker)
  if (index >= 0) return pathname.slice(0, index + marker.length)
  return '/workflows'
}

export type WorkflowQuery = {
  search: string
  status: string
  draft: string
  validity: string
}

export function filterWorkflows(rows: Workflow[], query: WorkflowQuery): Workflow[] {
  const search = query.search.trim().toLowerCase()
  return rows.filter((workflow) => {
    if (query.status !== 'all' && workflow.status !== query.status) return false
    const hasDraft = Boolean(workflow.draftVersionId)
    if (query.draft === 'yes' && !hasDraft) return false
    if (query.draft === 'no' && hasDraft) return false
    if (query.validity !== 'all' && workflow.validity !== query.validity) return false
    if (!search) return true
    return (
      workflow.name.toLowerCase().includes(search) ||
      workflow.key.toLowerCase().includes(search) ||
      workflow.stageBinding.toLowerCase().includes(search)
    )
  })
}

export function diffNodes(left: NodeConfig[], right: NodeConfig[]): string[] {
  const lines: string[] = []
  const rightById = new Map(right.map((node) => [node.id, node]))
  const leftIds = new Set(left.map((node) => node.id))
  for (const node of right) {
    if (!leftIds.has(node.id)) lines.push(msg('diff.added', { name: node.name || node.id }))
  }
  const unset = msg('value.unset')
  for (const node of left) {
    const match = rightById.get(node.id)
    if (!match) {
      lines.push(msg('diff.removed', { name: node.name || node.id }))
      continue
    }
    const name = match.name || node.name
    if (node.name !== match.name) lines.push(msg('diff.renamed', { from: node.name, to: match.name }))
    if (node.assignee !== match.assignee) {
      lines.push(msg('diff.assignee', { name, from: node.assignee || unset, to: match.assignee || unset }))
    }
    if (node.stageType !== match.stageType) {
      lines.push(msg('diff.stage', { name, from: node.stageType || unset, to: match.stageType || unset }))
    }
    if (node.moduleVersion !== match.moduleVersion) {
      lines.push(msg('diff.module', { name, from: node.moduleVersion || unset, to: match.moduleVersion || unset }))
    }
  }
  return lines
}

export function activeVersionLabel(workflow: Workflow): string {
  return workflow.versions.find((version) => version.id === workflow.activeVersionId)?.label ?? '—'
}

export function draftLabel(workflow: Workflow): string {
  const draft = workflow.versions.find((version) => version.id === workflow.draftVersionId)
  return draft ? msg('value.draftRecord', { version: draft.recordVersion }) : msg('value.none')
}
