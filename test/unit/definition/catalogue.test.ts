import { describe, expect, it } from '@rstest/core'
import { problemFromBody } from '../../../src/infrastructure/definition/problem'
import { workflowFromService } from '../../../src/infrastructure/definition/mapCatalogue'
import type { VersionDetail, WorkflowDetail } from '../../../src/infrastructure/definition/client'

describe('definition service problems', () => {
  it('reads the current code and the later errorCode', () => {
    expect(problemFromBody(422, { code: 'BPMN_VALIDATION_FAILED', detail: 'lane', invalid_params: [{ name: 'Lane_1', code: 'MISSING_DEPT_ID', reason: 'dept_id is required' }] })).toMatchObject({
      code: 'BPMN_VALIDATION_FAILED',
      invalidParams: [{ name: 'Lane_1', code: 'MISSING_DEPT_ID', reason: 'dept_id is required' }],
    })
    expect(problemFromBody(401, { errorCode: 'UNAUTHORIZED', validationErrors: [{ field: 'x-tenant-id', message: 'must be a UUID' }] }).code).toBe('UNAUTHORIZED')
  })
})

describe('definition catalogue mapping', () => {
  it('maps a draft with no active version to a draft workflow', () => {
    const detail: WorkflowDetail = {
      id: 'wf-1',
      key: 'purchase',
      name: 'Purchase',
      description: '',
      has_draft: true,
      updated_at: '2026-11-15T00:00:00Z',
      versions: [],
    }
    const draft: VersionDetail = {
      id: 'ver-1',
      status: 'DRAFT',
      is_valid: true,
      created_by_user_id: 'user-1',
      created_at: '2026-11-15T00:00:00Z',
      bpmn_xml: '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn:process id="P"><bpmn:userTask id="Task_review" name="Review request"/></bpmn:process></bpmn:definitions>',
      record_version: 2,
    }
    const workflow = workflowFromService(detail, [draft])
    expect(workflow.status).toBe('draft')
    expect(workflow.draftVersionId).toBe('ver-1')
    expect(workflow.activeVersionId).toBeNull()
    expect(workflow.versions[0]?.recordVersion).toBe(2)
    expect(workflow.versions[0]?.nodes.some((node) => node.id === 'Task_review')).toBe(true)
  })
})
