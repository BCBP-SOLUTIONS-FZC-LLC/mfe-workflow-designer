import { buildDiagram, type DiagramSpec } from '../../domain/rules/diagram'
import { deriveValidity } from '../../domain/rules/validation'
import { defaultNode, type AppState, type NodeConfig, type Workflow, type WorkflowVersion } from '../../domain/entities/types'

function flow(ids: string[]): DiagramSpec['flows'] {
  const flows: DiagramSpec['flows'] = []
  for (let index = 0; index < ids.length - 1; index += 1) {
    const source = ids[index]
    const target = ids[index + 1]
    if (!source || !target) continue
    flows.push({ id: `Flow_${index + 1}`, source, target })
  }
  return flows
}

function nodesFrom(spec: DiagramSpec, extras: Record<string, Partial<NodeConfig>>): NodeConfig[] {
  const elements = [
    ...spec.nodes.map((node) => ({ id: node.id, tag: node.tag, name: node.name })),
    ...(spec.boundaries ?? []).map((boundary) => ({
      id: boundary.id,
      tag: 'boundaryEvent' as const,
      name: boundary.name,
    })),
  ]
  return elements.flatMap((element) => {
    const kind =
      element.tag === 'userTask'
        ? 'user'
        : element.tag === 'sendTask'
          ? 'send'
          : element.tag === 'receiveTask'
            ? 'receive'
            : element.tag === 'serviceTask'
              ? 'connector'
              : element.tag === 'callActivity'
                ? 'call'
                : element.tag === 'subProcess'
                  ? 'subprocess'
                  : element.tag === 'boundaryEvent'
                    ? 'boundary'
                    : null
    if (!kind) return []
    return [{ ...defaultNode(element.id, kind, element.name), ...extras[element.id] }]
  })
}

const intakeSpec: DiagramSpec = {
  id: 'intake',
  processName: 'Tender intake',
  lanes: [
    { id: 'Lane_Commercial', name: 'Commercial' },
    { id: 'Lane_Legal', name: 'Legal' },
  ],
  nodes: [
    { id: 'Start_intake', tag: 'startEvent', name: 'Received', laneId: 'Lane_Commercial' },
    { id: 'User_triage', tag: 'userTask', name: 'Triage enquiry', laneId: 'Lane_Commercial' },
    { id: 'Sub_compliance', tag: 'subProcess', name: 'Compliance check', laneId: 'Lane_Commercial' },
    { id: 'Send_ack', tag: 'sendTask', name: 'Send acknowledgement', laneId: 'Lane_Legal' },
    { id: 'Service_erp', tag: 'serviceTask', name: 'Update ERP', laneId: 'Lane_Legal' },
    { id: 'End_intake', tag: 'endEvent', name: 'Triaged', laneId: 'Lane_Legal' },
  ],
  flows: flow(['Start_intake', 'User_triage', 'Sub_compliance', 'Send_ack', 'Service_erp', 'End_intake']),
  boundaries: [
    { id: 'Bound_msg', name: 'Client chaser', attachedTo: 'User_triage', event: 'message' },
    { id: 'Bound_err', name: 'ERP down', attachedTo: 'Service_erp', event: 'error' },
  ],
}

const clarificationSpec: DiagramSpec = {
  id: 'clarification',
  processName: 'Clarification loop',
  lanes: [
    { id: 'Lane_Commercial_c', name: 'Commercial' },
    { id: 'Lane_Delivery', name: 'Delivery' },
  ],
  nodes: [
    { id: 'Start_clar', tag: 'startEvent', name: 'Question opened', laneId: 'Lane_Commercial_c' },
    { id: 'User_draft', tag: 'userTask', name: 'Draft clarification', laneId: 'Lane_Commercial_c' },
    { id: 'Receive_reply', tag: 'receiveTask', name: 'Receive client reply', laneId: 'Lane_Delivery' },
    { id: 'Call_notify', tag: 'callActivity', name: 'Notify stakeholders', laneId: 'Lane_Delivery' },
    { id: 'End_clar', tag: 'endEvent', name: 'Closed', laneId: 'Lane_Delivery' },
  ],
  flows: flow(['Start_clar', 'User_draft', 'Receive_reply', 'Call_notify', 'End_clar']),
}

const awardSpec: DiagramSpec = {
  id: 'award',
  processName: 'Award handover',
  lanes: [{ id: 'Lane_Finance', name: 'Finance' }],
  nodes: [
    { id: 'Start_award', tag: 'startEvent', name: 'Awarded', laneId: 'Lane_Finance' },
    { id: 'User_handover', tag: 'userTask', name: 'Handover pack', laneId: 'Lane_Finance' },
    { id: 'End_award', tag: 'endEvent', name: 'Handed over', laneId: 'Lane_Finance' },
  ],
  flows: flow(['Start_award', 'User_handover', 'End_award']),
}

const signatureSpec: DiagramSpec = {
  id: 'signature',
  processName: 'Contract signature',
  lanes: [{ id: 'Lane_Sign', name: 'Legal' }],
  nodes: [
    { id: 'Start_sign', tag: 'startEvent', name: 'Pack ready', laneId: 'Lane_Sign' },
    { id: 'User_sign', tag: 'userTask', name: 'Collect signature', laneId: 'Lane_Sign' },
    { id: 'End_sign', tag: 'endEvent', name: 'Signed', laneId: 'Lane_Sign' },
  ],
  flows: flow(['Start_sign', 'User_sign', 'End_sign']),
}

const intakeXml = buildDiagram(intakeSpec)
const intakeNodes = nodesFrom(intakeSpec, {
  User_triage: { assignee: 'Lina Okonkwo', stageType: 'Review', slaHours: '16', messageName: 'Client chaser' },
  Send_ack: { assignee: 'Marcus Hale', stageType: 'Notify' },
  Service_erp: {
    assignee: 'Noah Ivers',
    stageType: 'Notify',
    moduleKey: 'mod-erp',
    moduleVersion: '2.1.0',
    connectorInputs: 'enquiryId',
    connectorOutputs: 'erpDocumentId',
    credentialRef: 'vault://connectors/erp',
    errorCode: 'ERP-409',
  },
  Bound_msg: { messageName: 'Client chaser' },
  Bound_err: { errorCode: 'ERP-409' },
})

const clarificationXml = buildDiagram(clarificationSpec)
const clarificationPublished = nodesFrom(clarificationSpec, {
  User_draft: { assignee: 'Lina Okonkwo', stageType: 'Clarification' },
  Receive_reply: { assignee: 'Marcus Hale', stageType: 'Clarification', slaHours: '48' },
  Call_notify: { moduleKey: 'mod-erp', moduleVersion: '2.1.0', inputMapping: 'questionId', outputMapping: 'notified' },
})
const clarificationDraft = clarificationPublished.map((node) =>
  node.id === 'Receive_reply' ? { ...node, assignee: '' } : node,
)

const awardXml = buildDiagram(awardSpec)
const awardNodes = nodesFrom(awardSpec, {
  User_handover: { assignee: 'Noah Ivers', stageType: 'Handover', slaHours: '8', slaWarnHours: '4' },
})
const awardServerSpec: DiagramSpec = {
  ...awardSpec,
  nodes: awardSpec.nodes.map((node) =>
    node.id === 'User_handover' ? { ...node, name: 'Handover pack (server)' } : node,
  ),
}
const awardServerXml = buildDiagram(awardServerSpec)
const awardServerNodes = awardNodes.map((node) =>
  node.id === 'User_handover' ? { ...node, name: 'Handover pack (server)' } : node,
)

const signatureXml = buildDiagram(signatureSpec)
const signatureNodes = nodesFrom(signatureSpec, {
  User_sign: { assignee: 'Marcus Hale', stageType: 'Approval', slaHours: '72' },
})

function version(input: Omit<WorkflowVersion, 'xml' | 'nodes'> & { xml: string; nodes: NodeConfig[] }): WorkflowVersion {
  return input
}

function workflow(input: Workflow): Workflow {
  return input
}

export function createInitialState(): AppState {
  const workflows: Workflow[] = [
    workflow({
      id: 'wf-intake',
      name: 'Intake triage',
      key: 'intake-triage',
      description: 'Triage a new enquiry, check compliance, and update ERP without storing connector secrets in the diagram.',
      status: 'published',
      stageBinding: 'Tender / Intake',
      validity: deriveValidity(intakeXml, intakeNodes),
      activeVersionId: 'wf-intake-v2',
      draftVersionId: null,
      versions: [
        version({
          id: 'wf-intake-v1',
          label: 'v1',
          state: 'retired',
          recordVersion: 4,
          createdAt: '2026-10-02T09:00:00.000Z',
          createdBy: 'Lina Okonkwo',
          note: 'First published intake path',
          xml: intakeXml,
          nodes: intakeNodes,
        }),
        version({
          id: 'wf-intake-v2',
          label: 'v2',
          state: 'published',
          recordVersion: 9,
          createdAt: '2026-11-02T09:00:00.000Z',
          createdBy: 'Lina Okonkwo',
          note: 'Added the ERP connector and compliance subprocess',
          xml: intakeXml,
          nodes: intakeNodes,
        }),
      ],
      runningInstances: 6,
      usages: [
        { system: 'Tender intake', count: 4 },
        { system: 'Partner portal', count: 2 },
      ],
      lockedBy: null,
      conflictArmed: false,
      serverRecordVersion: 9,
      serverXml: intakeXml,
      serverNodes: intakeNodes,
      publishedAt: '2026-11-02T09:00:00.000Z',
      publishedBy: 'Lina Okonkwo',
    }),
    workflow({
      id: 'wf-clarification',
      name: 'Clarification loop',
      key: 'clarification-loop',
      description: 'Draft a clarification, wait for the client, and notify stakeholders.',
      status: 'published',
      stageBinding: 'Tender / Clarification',
      validity: deriveValidity(clarificationXml, clarificationDraft),
      activeVersionId: 'wf-clarification-v2',
      draftVersionId: 'wf-clarification-draft',
      versions: [
        version({
          id: 'wf-clarification-v2',
          label: 'v2',
          state: 'published',
          recordVersion: 5,
          createdAt: '2026-10-18T11:00:00.000Z',
          createdBy: 'Marcus Hale',
          note: 'Published clarification loop',
          xml: clarificationXml,
          nodes: clarificationPublished,
        }),
        version({
          id: 'wf-clarification-draft',
          label: 'Draft',
          state: 'draft',
          recordVersion: 6,
          createdAt: '2026-11-12T15:00:00.000Z',
          createdBy: 'Lina Okonkwo',
          note: 'Reply task is missing a default person',
          xml: clarificationXml,
          nodes: clarificationDraft,
        }),
      ],
      runningInstances: 2,
      usages: [{ system: 'Clarification register', count: 2 }],
      lockedBy: null,
      conflictArmed: false,
      serverRecordVersion: 6,
      serverXml: clarificationXml,
      serverNodes: clarificationDraft,
      publishedAt: '2026-10-18T11:00:00.000Z',
      publishedBy: 'Marcus Hale',
    }),
    workflow({
      id: 'wf-award',
      name: 'Award handover',
      key: 'award-handover',
      description: 'Hand the awarded pack to finance. Publishing reloads if another editor won the race.',
      status: 'draft',
      stageBinding: 'Tender / Award',
      validity: deriveValidity(awardXml, awardNodes),
      activeVersionId: null,
      draftVersionId: 'wf-award-draft',
      versions: [
        version({
          id: 'wf-award-draft',
          label: 'Draft',
          state: 'draft',
          recordVersion: 4,
          createdAt: '2026-11-13T08:30:00.000Z',
          createdBy: 'Noah Ivers',
          note: 'Local draft behind the server record',
          xml: awardXml,
          nodes: awardNodes,
        }),
      ],
      runningInstances: 0,
      usages: [],
      lockedBy: null,
      conflictArmed: true,
      serverRecordVersion: 5,
      serverXml: awardServerXml,
      serverNodes: awardServerNodes,
      publishedAt: null,
      publishedBy: null,
    }),
    workflow({
      id: 'wf-signature',
      name: 'Contract signature',
      key: 'contract-signature',
      description: 'Collect the authorised signature on the contract pack.',
      status: 'published',
      stageBinding: 'Commercial / Signature',
      validity: deriveValidity(signatureXml, signatureNodes),
      activeVersionId: 'wf-signature-v1',
      draftVersionId: null,
      versions: [
        version({
          id: 'wf-signature-v1',
          label: 'v1',
          state: 'published',
          recordVersion: 3,
          createdAt: '2026-09-14T10:00:00.000Z',
          createdBy: 'Amina Rahman',
          note: 'Signature collection',
          xml: signatureXml,
          nodes: signatureNodes,
        }),
      ],
      runningInstances: 1,
      usages: [{ system: 'Contract room', count: 1 }],
      lockedBy: 'Amina Rahman',
      conflictArmed: false,
      serverRecordVersion: 3,
      serverXml: signatureXml,
      serverNodes: signatureNodes,
      publishedAt: '2026-09-14T10:00:00.000Z',
      publishedBy: 'Amina Rahman',
    }),
    workflow({
      id: 'wf-legacy',
      name: 'Legacy filing',
      key: 'legacy-filing',
      description: 'Retired filing path kept for audit.',
      status: 'archived',
      stageBinding: 'Shared / Archive',
      validity: 'unknown',
      activeVersionId: 'wf-legacy-v1',
      draftVersionId: null,
      versions: [
        version({
          id: 'wf-legacy-v1',
          label: 'v1',
          state: 'retired',
          recordVersion: 2,
          createdAt: '2025-06-01T00:00:00.000Z',
          createdBy: 'Noah Ivers',
          note: 'Archived with the 2025 filing rules',
          xml: buildDiagram({
            id: 'legacy',
            processName: 'Legacy filing',
            lanes: [{ id: 'Lane_Archive', name: 'Records' }],
            nodes: [
              { id: 'Start_legacy', tag: 'startEvent', name: 'Filed', laneId: 'Lane_Archive' },
              { id: 'End_legacy', tag: 'endEvent', name: 'Stored', laneId: 'Lane_Archive' },
            ],
            flows: [{ id: 'Flow_legacy', source: 'Start_legacy', target: 'End_legacy' }],
          }),
          nodes: [],
        }),
      ],
      runningInstances: 0,
      usages: [],
      lockedBy: null,
      conflictArmed: false,
      serverRecordVersion: 2,
      serverXml: '',
      serverNodes: [],
      publishedAt: '2025-06-01T00:00:00.000Z',
      publishedBy: 'Noah Ivers',
    }),
  ]

  const enquiry = {
    xml: intakeXml,
    nodes: intakeNodes,
  }

  return {
    workflows,
    modules: [
      {
        id: 'mod-erp',
        name: 'Notify ERP',
        scope: 'platform',
        status: 'published',
        summary: 'Platform connector that files an enquiry in ERP.',
        contract: 'input enquiryId:string → output erpDocumentId:string',
        assignmentKeys: ['erp.notify'],
        messages: ['OrderUpdated'],
        errorCodes: ['ERP-404', 'ERP-409'],
        usedBy: ['Intake triage'],
        versions: [
          { label: '2.1.0', publishedAt: '2026-10-01T00:00:00.000Z', note: 'Adds conflict error ERP-409' },
          { label: '2.0.0', publishedAt: '2026-06-01T00:00:00.000Z', note: 'Initial contract' },
        ],
      },
      {
        id: 'mod-legal',
        name: 'Legal review gate',
        scope: 'tenant',
        status: 'published',
        summary: 'Tenant human task for counsel review.',
        contract: 'input packId:string → output decision:approved|returned',
        assignmentKeys: ['legal.review'],
        messages: ['ReviewRequested'],
        errorCodes: ['LEGAL-422'],
        usedBy: ['Contract signature'],
        versions: [{ label: '1.4.0', publishedAt: '2026-08-12T00:00:00.000Z', note: 'Assignment key legal.review' }],
      },
      {
        id: 'mod-index',
        name: 'Archive indexer',
        scope: 'platform',
        status: 'archived',
        summary: 'Retired indexer. Kept so older call activities still resolve.',
        contract: 'input documentId:string → output archiveKey:string',
        assignmentKeys: ['archive.index'],
        messages: ['Indexed'],
        errorCodes: ['IDX-410'],
        usedBy: [],
        versions: [{ label: '0.9.0', publishedAt: '2025-05-01T00:00:00.000Z', note: 'Archived' }],
      },
    ],
    starters: [
      {
        id: 'starter-enquiry',
        name: 'Enquiry triage',
        category: 'Tender',
        summary: 'Commercial and legal lanes for a new enquiry, including the ERP connector.',
        stageBinding: 'Tender / Intake',
        xml: enquiry.xml,
        nodes: enquiry.nodes,
      },
      {
        id: 'starter-clarification',
        name: 'Clarification loop',
        category: 'Tender',
        summary: 'Draft, receive, and notify for a client question.',
        stageBinding: 'Tender / Clarification',
        xml: clarificationXml,
        nodes: clarificationPublished,
      },
      {
        id: 'starter-award',
        name: 'Award handover',
        category: 'Finance',
        summary: 'A short finance lane that hands an awarded pack onward.',
        stageBinding: 'Tender / Award',
        xml: awardXml,
        nodes: awardNodes,
      },
    ],
    credentials: {},
    seq: 200,
    notice: null,
    conflictWorkflowId: null,
    reloadGeneration: {},
  }
}
