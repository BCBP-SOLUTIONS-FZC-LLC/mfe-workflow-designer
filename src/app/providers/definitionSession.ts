import { msg } from '../../shared/copy'
import type { AppState, Notice } from '../../domain/entities/types'
import { blankDiagram, isProcessDocument } from '../../domain/rules/diagram'
import { keyFromName } from '../../application/queries/query'
import type { Action } from '../../application/commands/reducer'
import { DefinitionError, definitionApi } from '../../infrastructure/definition/client'
import {
  emptyCatalogue,
  moduleFromService,
  starterFromService,
  workflowFromService,
} from '../../infrastructure/definition/mapCatalogue'
import type { ServiceProblem } from '../../infrastructure/definition/problem'

function noticeFor(problem: ServiceProblem): Notice {
  const reasons = problem.invalidParams.map((item) => item.reason).filter(Boolean).join(' ')
  const detail = [problem.detail, reasons].filter(Boolean).join(' ')
  return { key: 'notice.serviceRefused', vars: { code: problem.code, detail: detail || problem.code } }
}

function failed(state: AppState, error: unknown): AppState {
  if (error instanceof DefinitionError) return { ...state, notice: noticeFor(error.problem) }
  return { ...state, notice: { key: 'notice.definitionUnavailable' } }
}

export async function loadDefinitionCatalogue(): Promise<AppState> {
  const [summaries, modules, starters] = await Promise.all([
    definitionApi.workflows(),
    definitionApi.modules(),
    definitionApi.starters(),
  ])
  const workflows = await Promise.all(
    summaries.map(async (summary) => {
      const detail = await definitionApi.workflow(summary.id)
      const versions = await Promise.all(
        detail.versions.map((version) =>
          version.status === 'DRAFT' ? definitionApi.draft(summary.id) : definitionApi.version(summary.id, version.id),
        ),
      )
      return workflowFromService(detail, versions)
    }),
  )
  const moduleRecords = await Promise.all(
    modules.map(async (module) => {
      if (!module.active_version_id) return moduleFromService(module, null)
      try {
        return moduleFromService(module, await definitionApi.contract(module.id, module.active_version_id))
      } catch {
        return moduleFromService(module, null)
      }
    }),
  )
  return {
    ...emptyCatalogue(),
    workflows,
    modules: moduleRecords,
    starters: starters.map(starterFromService),
  }
}

function keep(previous: AppState, next: AppState, notice: Notice | null): AppState {
  return {
    ...next,
    credentials: previous.credentials,
    notice,
    reloadGeneration: previous.reloadGeneration,
  }
}

async function reload(previous: AppState, notice: Notice): Promise<AppState> {
  return keep(previous, await loadDefinitionCatalogue(), notice)
}

async function ensureDraft(state: AppState, workflowId: string): Promise<{ versionId: string; recordVersion: number }> {
  const workflow = state.workflows.find((item) => item.id === workflowId)
  if (workflow?.draftVersionId) {
    const draft = workflow.versions.find((version) => version.id === workflow.draftVersionId)
    return { versionId: workflow.draftVersionId, recordVersion: draft?.recordVersion ?? workflow.serverRecordVersion }
  }
  const created = await definitionApi.initDraft(workflowId)
  const draft = await definitionApi.draft(workflowId)
  return { versionId: created.version_id, recordVersion: draft.record_version }
}

export async function runDefinitionAction(state: AppState, action: Action): Promise<AppState> {
  try {
    switch (action.type) {
      case 'dismissNotice':
        return { ...state, notice: null }
      case 'notify':
        return { ...state, notice: action.notice }
      case 'createBlank': {
        const name = action.name.trim() || msg('workflow.untitled')
        await definitionApi.createWorkflow({
          key: action.key.trim() || keyFromName(name),
          name,
          description: msg('workflow.blankDescription'),
          bpmn_xml: blankDiagram(),
        })
        return reload(state, { key: 'notice.created', vars: { name } })
      }
      case 'upload': {
        if (!isProcessDocument(action.xml)) return { ...state, notice: { key: 'notice.uploadRejected' } }
        const name = action.name.trim() || msg('workflow.uploaded')
        await definitionApi.createWorkflow({
          key: keyFromName(name),
          name,
          description: msg('workflow.uploadedDescription'),
          bpmn_xml: action.xml,
        })
        return reload(state, { key: 'notice.uploaded', vars: { name } })
      }
      case 'createFromStarter': {
        const starter = state.starters.find((item) => item.id === action.starterId)
        if (!starter) return { ...state, notice: { key: 'notice.starterMissing' } }
        const name = action.name.trim() || starter.name
        await definitionApi.createWorkflow({
          key: keyFromName(name),
          name,
          description: starter.summary,
          bpmn_xml: starter.xml,
        })
        return reload(state, { key: 'notice.opened', vars: { name: starter.name } })
      }
      case 'clone': {
        const source = state.workflows.find((workflow) => workflow.id === action.workflowId)
        const version = source?.versions.find((item) => item.state !== 'draft')
        if (!source || !version) return { ...state, notice: { key: 'notice.serviceRefused', vars: { code: 'INVALID_VERSION_STATUS', detail: 'Clone a published version.' } } }
        const name = msg('workflow.copyName', { name: source.name })
        await definitionApi.clone(source.id, version.id, {
          new_key: `${source.key}-copy`,
          new_name: name,
          new_description: source.description,
        })
        return reload(state, { key: 'notice.cloned', vars: { name: source.name } })
      }
      case 'archive': {
        const name = state.workflows.find((workflow) => workflow.id === action.workflowId)?.name ?? msg('workflow.fallback')
        await definitionApi.archive(action.workflowId)
        return reload(state, { key: 'notice.archived', vars: { name } })
      }
      case 'saveDraft': {
        const workflow = state.workflows.find((item) => item.id === action.workflowId)
        if (!workflow) return state
        const draft = await ensureDraft(state, action.workflowId)
        const saved = await definitionApi.updateDraft(action.workflowId, {
          bpmn_xml: action.xml,
          name: workflow.name,
          description: workflow.description,
          record_version: draft.recordVersion,
        })
        const recordVersion = saved.record_version ?? draft.recordVersion
        return {
          ...state,
          notice: null,
          workflows: state.workflows.map((item) => {
            if (item.id !== action.workflowId) return item
            const versions = item.versions.some((version) => version.id === saved.version_id || version.id === item.draftVersionId)
              ? item.versions.map((version) =>
                  version.id === saved.version_id || version.id === item.draftVersionId
                    ? { ...version, id: saved.version_id, xml: action.xml, nodes: action.nodes, recordVersion }
                    : version,
                )
              : [
                  ...item.versions,
                  {
                    id: saved.version_id,
                    label: 'Draft',
                    state: 'draft' as const,
                    recordVersion,
                    createdAt: action.now,
                    createdBy: '',
                    note: '',
                    xml: action.xml,
                    nodes: action.nodes,
                  },
                ]
            return { ...item, draftVersionId: saved.version_id, serverRecordVersion: recordVersion, versions }
          }),
        }
      }
      case 'publish': {
        const workflow = state.workflows.find((item) => item.id === action.workflowId)
        if (!workflow) return state
        const draft = await ensureDraft(state, action.workflowId)
        await definitionApi.updateDraft(action.workflowId, {
          bpmn_xml: action.xml,
          name: workflow.name,
          description: workflow.description,
          record_version: draft.recordVersion,
        })
        const fresh = await definitionApi.draft(action.workflowId)
        await definitionApi.publish(action.workflowId, fresh.id, state.conflictWorkflowId === action.workflowId)
        return reload(state, { key: 'notice.published', vars: { name: workflow.name } })
      }
      case 'reload': {
        const next = await reload(state, { key: 'notice.reloaded' })
        return {
          ...next,
          conflictWorkflowId: null,
          reloadGeneration: {
            ...state.reloadGeneration,
            [action.workflowId]: (state.reloadGeneration[action.workflowId] ?? 0) + 1,
          },
        }
      }
      case 'promote': {
        const workflow = state.workflows.find((item) => item.id === action.workflowId)
        const version = workflow?.versions.find((item) => item.id === action.versionId)
        if (!workflow || !version || version.state === 'draft') return state
        await definitionApi.promote(action.workflowId, action.versionId)
        return reload(state, { key: 'notice.promoted', vars: { label: version.label } })
      }
      case 'saveStarter': {
        const workflow = state.workflows.find((item) => item.id === action.workflowId)
        const version = workflow?.versions.find((item) => item.id === action.versionId)
        if (!workflow || !version || version.state === 'draft') return { ...state, notice: { key: 'notice.starterDraft' } }
        await definitionApi.saveStarter(version.id, {
          name: workflow.name,
          description: workflow.description,
          category: msg('starter.saved'),
        })
        return reload(state, { key: 'notice.savedStarter', vars: { name: workflow.name } })
      }
      case 'setCredential': {
        const key = `${action.workflowId}:${action.elementId}`
        return {
          ...state,
          credentials: { ...state.credentials, [key]: { vaultRef: action.vaultRef, secret: action.secret } },
        }
      }
      case 'publishModule': {
        const listed = await definitionApi.moduleVersions(action.moduleId)
        const draft = listed.versions.find((version) => version.status === 'DRAFT')
        if (!draft) return { ...state, notice: { key: 'notice.serviceRefused', vars: { code: 'DRAFT_NOT_FOUND', detail: 'The module has no draft to publish.' } } }
        await definitionApi.publishModule(action.moduleId, draft.id)
        return reload(state, { key: 'notice.modulePublished' })
      }
      case 'archiveModule': {
        const name = state.modules.find((item) => item.id === action.moduleId)?.name ?? msg('workflow.moduleFallback')
        await definitionApi.archiveModule(action.moduleId)
        return reload(state, { key: 'notice.archived', vars: { name } })
      }
      default:
        return state
    }
  } catch (error) {
    if (error instanceof DefinitionError && error.problem.code === 'STRUCTURAL_DIVERGENCE') {
      const workflowId = action.type === 'publish' ? action.workflowId : null
      return { ...state, conflictWorkflowId: workflowId, notice: noticeFor(error.problem) }
    }
    if (error instanceof DefinitionError && error.problem.code === 'DRAFT_CONCURRENCY' && error.problem.currentRecordVersion != null) {
      const workflowId = 'workflowId' in action ? action.workflowId : null
      return {
        ...failed(state, error),
        conflictWorkflowId: workflowId,
        workflows: state.workflows.map((workflow) =>
          workflow.id === workflowId ? { ...workflow, serverRecordVersion: error.problem.currentRecordVersion ?? workflow.serverRecordVersion, conflictArmed: true } : workflow,
        ),
      }
    }
    return failed(state, error)
  }
}
