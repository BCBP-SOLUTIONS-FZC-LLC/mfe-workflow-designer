import { describe, expect, it } from '@rstest/core'
import { buildDiagram, blankDiagram, insertElement, insertLane, isProcessDocument, readElements, renameElement } from '../../src/domain/rules/diagram'
import { diffNodes, filterWorkflows } from '../../src/application/queries/query'
import { workflowReducer } from '../../src/application/commands/reducer'
import { issueText } from '../../src/application/queries/issues'
import { deriveValidity, diagramOmitsSecrets, validateWorkflow } from '../../src/domain/rules/validation'
import { loadStudio, saveStudio } from '../../src/infrastructure/storage/studioStore'
import { createInitialState } from '../../src/infrastructure/storage/seed'
import { editingVersion } from '../../src/domain/entities/types'

const now = '2026-11-14T00:00:00.000Z'

describe('workflow domain', () => {
  it('requires a task and a default person before a diagram is valid', () => {
    const xml = blankDiagram()
    expect(readElements(xml).map((element) => element.tag)).toEqual(['participant', 'lane', 'startEvent', 'endEvent'])
    const issues = validateWorkflow(xml, [])
    expect(issues.map((issue) => issue.code)).toContain('validation.task')
    const taskIssue = issues.find((issue) => issue.code === 'validation.task')
    expect(taskIssue && issueText(taskIssue)).toBe('Add at least one task before publishing.')
    expect(deriveValidity(xml, [])).toBe('invalid')
  })

  it('filters the catalogue and diffs assignments', () => {
    const state = createInitialState()
    expect(filterWorkflows(state.workflows, { search: 'intake', status: 'all', draft: 'all', validity: 'all' }).map((row) => row.key)).toEqual([
      'intake-triage',
    ])
    expect(filterWorkflows(state.workflows, { search: '', status: 'archived', draft: 'all', validity: 'all' }).map((row) => row.name)).toEqual([
      'Legacy filing',
    ])
    expect(filterWorkflows(state.workflows, { search: '', status: 'all', draft: 'yes', validity: 'invalid' }).map((row) => row.key)).toEqual([
      'clarification-loop',
    ])
    const clarification = state.workflows.find((workflow) => workflow.id === 'wf-clarification')
    const published = clarification?.versions.find((version) => version.label === 'v2')
    const draft = clarification?.versions.find((version) => version.state === 'draft')
    expect(diffNodes(published?.nodes ?? [], draft?.nodes ?? [])).toContain(
      'Receive client reply assignee changed from Marcus Hale to unset.',
    )
  })

  it('keeps connector secrets out of the workflow document', () => {
    const secret = 'vault-secret-do-not-export'
    let state = createInitialState()
    state = workflowReducer(state, {
      type: 'setCredential',
      workflowId: 'wf-intake',
      elementId: 'Service_erp',
      vaultRef: 'vault://connectors/erp',
      secret,
    })
    const intake = state.workflows.find((workflow) => workflow.id === 'wf-intake')
    expect(state.credentials['wf-intake:Service_erp']?.secret).toBe(secret)
    expect(JSON.stringify(intake)).not.toContain(secret)
    const version = intake ? editingVersion(intake) : null
    expect(version && diagramOmitsSecrets(version.xml, version.nodes, [secret])).toBe(true)
    const leaked = version?.nodes.map((node) =>
      node.id === 'Service_erp' ? { ...node, connectorInputs: `password=${secret}` } : node,
    )
    expect(validateWorkflow(version?.xml ?? '', leaked ?? [], [secret]).some((issue) => issue.elementId === 'Service_erp')).toBe(true)
  })

  it('reloads a publish conflict and then publishes the server record', () => {
    let state = createInitialState()
    const award = state.workflows.find((workflow) => workflow.id === 'wf-award')
    const draft = award ? editingVersion(award) : null
    expect(draft).toBeTruthy()
    state = workflowReducer(state, {
      type: 'publish',
      workflowId: 'wf-award',
      xml: draft?.xml ?? '',
      nodes: draft?.nodes ?? [],
      actor: 'Noah Ivers',
      now,
    })
    expect(state.conflictWorkflowId).toBe('wf-award')
    expect(state.workflows.find((workflow) => workflow.id === 'wf-award')?.status).toBe('draft')

    state = workflowReducer(state, { type: 'reload', workflowId: 'wf-award', now })
    const reloaded = state.workflows.find((workflow) => workflow.id === 'wf-award')
    const next = reloaded ? editingVersion(reloaded) : null
    expect(state.conflictWorkflowId).toBeNull()
    expect(next?.nodes.find((node) => node.id === 'User_handover')?.name).toBe('Handover pack (server)')
    expect(reloaded?.conflictArmed).toBe(false)

    state = workflowReducer(state, {
      type: 'publish',
      workflowId: 'wf-award',
      xml: next?.xml ?? '',
      nodes: next?.nodes ?? [],
      actor: 'Noah Ivers',
      now,
    })
    expect(state.workflows.find((workflow) => workflow.id === 'wf-award')?.status).toBe('published')
    expect(state.notice).toEqual({ key: 'notice.published', vars: { name: 'Award handover' } })
  })

  it('inserts an allowed element and renames it without touching lane structure', () => {
    const xml = buildDiagram({
      id: 'sample',
      processName: 'Sample',
      lanes: [{ id: 'Lane_One', name: 'Commercial' }],
      nodes: [
        { id: 'Start_1', tag: 'startEvent', name: 'Start', laneId: 'Lane_One' },
        { id: 'End_1', tag: 'endEvent', name: 'End', laneId: 'Lane_One' },
      ],
      flows: [{ id: 'Flow_1', source: 'Start_1', target: 'End_1' }],
    })
    const withTask = insertElement(xml, 'user')
    expect(readElements(withTask).some((element) => element.tag === 'userTask' && element.name === 'User task')).toBe(true)
    expect(withTask).toContain('<bpmn:flowNodeRef>Activity_1</bpmn:flowNodeRef>')
    const startAt = Number(/bpmnElement="Start_1"[\s\S]*?<dc:Bounds x="([\d.]+)"/.exec(withTask)?.[1] ?? 0)
    const taskAt = Number(/bpmnElement="Activity_1"[\s\S]*?<dc:Bounds x="([\d.]+)"/.exec(withTask)?.[1] ?? 0)
    expect(taskAt).toBeGreaterThan(startAt)
    const renamed = renameElement(withTask, 'Activity_1', 'Check pack')
    expect(readElements(renamed).find((element) => element.id === 'Activity_1')?.name).toBe('Check pack')
    const withLane = insertLane(renamed, 'Finance')
    expect(readElements(withLane).some((element) => element.tag === 'lane' && element.name === 'Finance')).toBe(true)
  })

  it('refuses a file that is not a BPMN process and keeps secrets out of storage', () => {
    const state = createInitialState()
    const rejected = workflowReducer(state, { type: 'upload', name: 'notes', xml: '<html></html>', now })
    expect(rejected.workflows).toHaveLength(state.workflows.length)
    expect(rejected.notice).toEqual({ key: 'notice.uploadRejected' })
    expect(isProcessDocument(blankDiagram())).toBe(true)

    const withSecret = {
      ...state,
      credentials: { 'wf:el': { vaultRef: 'vault://erp', secret: 'super-secret-value' } },
    }
    saveStudio(withSecret)
    const loaded = loadStudio()
    expect(loaded.workflows).toHaveLength(state.workflows.length)
    expect(loaded.credentials).toEqual({})
    expect(JSON.stringify(loaded)).not.toContain('super-secret-value')
  })
})
