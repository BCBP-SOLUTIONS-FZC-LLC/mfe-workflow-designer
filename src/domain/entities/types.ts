export type WorkflowStatus = 'draft' | 'published' | 'archived'
export type Validity = 'valid' | 'invalid' | 'unknown'
export type NodeKind = 'user' | 'send' | 'receive' | 'connector' | 'call' | 'subprocess' | 'boundary'
export type VersionState = 'draft' | 'published' | 'retired'
export type ModuleScope = 'platform' | 'tenant'
export type ModuleStatus = 'published' | 'archived'

export type NodeConfig = {
  id: string
  kind: NodeKind
  name: string
  stageType: string
  assignee: string
  slaHours: string
  slaWarnHours: string
  messageName: string
  errorCode: string
  moduleKey: string
  moduleVersion: string
  inputMapping: string
  outputMapping: string
  connectorInputs: string
  connectorOutputs: string
  credentialRef: string
}

export type WorkflowVersion = {
  id: string
  label: string
  state: VersionState
  recordVersion: number
  createdAt: string
  createdBy: string
  note: string
  xml: string
  nodes: NodeConfig[]
}

export type UsageRow = {
  system: string
  count: number
}

export type Workflow = {
  id: string
  name: string
  key: string
  description: string
  status: WorkflowStatus
  stageBinding: string
  validity: Validity
  activeVersionId: string | null
  draftVersionId: string | null
  versions: WorkflowVersion[]
  runningInstances: number
  usages: UsageRow[]
  lockedBy: string | null
  conflictArmed: boolean
  serverRecordVersion: number
  serverXml: string
  serverNodes: NodeConfig[]
  publishedAt: string | null
  publishedBy: string | null
}

export type ModuleVersion = {
  label: string
  publishedAt: string
  note: string
}

export type ModuleRecord = {
  id: string
  name: string
  scope: ModuleScope
  status: ModuleStatus
  summary: string
  contract: string
  assignmentKeys: string[]
  messages: string[]
  errorCodes: string[]
  usedBy: string[]
  versions: ModuleVersion[]
}

export type Starter = {
  id: string
  name: string
  category: string
  summary: string
  stageBinding: string
  xml: string
  nodes: NodeConfig[]
}

export type SecureCredential = {
  vaultRef: string
  secret: string
}

export type Notice = {
  key: string
  vars?: Record<string, string | number>
}

export type AppState = {
  workflows: Workflow[]
  modules: ModuleRecord[]
  starters: Starter[]
  credentials: Record<string, SecureCredential>
  seq: number
  notice: Notice | null
  conflictWorkflowId: string | null
  reloadGeneration: Record<string, number>
}

export type Person = {
  id: string
  name: string
  department: string
}

export const PEOPLE: Person[] = [
  { id: 'lina', name: 'Lina Okonkwo', department: 'Commercial' },
  { id: 'marcus', name: 'Marcus Hale', department: 'Legal' },
  { id: 'amina', name: 'Amina Rahman', department: 'Delivery' },
  { id: 'noah', name: 'Noah Ivers', department: 'Finance' },
]

export const STAGE_TYPES = ['Review', 'Approval', 'Clarification', 'Handover', 'Notify']

export const TASK_KINDS = new Set<NodeKind>(['user', 'send', 'receive', 'connector'])

export function defaultNode(id: string, kind: NodeKind, name: string): NodeConfig {
  const stage =
    kind === 'user' ? 'Review' : kind === 'receive' ? 'Clarification' : kind === 'call' ? 'Handover' : 'Notify'
  return {
    id,
    kind,
    name,
    stageType: kind === 'boundary' ? '' : stage,
    assignee: '',
    slaHours: kind === 'boundary' || kind === 'subprocess' ? '' : '24',
    slaWarnHours: kind === 'boundary' || kind === 'subprocess' ? '' : '16',
    messageName: '',
    errorCode: '',
    moduleKey: '',
    moduleVersion: '',
    inputMapping: '',
    outputMapping: '',
    connectorInputs: '',
    connectorOutputs: '',
    credentialRef: '',
  }
}

export function activeVersion(workflow: Workflow): WorkflowVersion | null {
  return workflow.versions.find((version) => version.id === workflow.activeVersionId) ?? null
}

export function draftVersion(workflow: Workflow): WorkflowVersion | null {
  return workflow.versions.find((version) => version.id === workflow.draftVersionId) ?? null
}

export function editingVersion(workflow: Workflow): WorkflowVersion | null {
  return draftVersion(workflow) ?? activeVersion(workflow) ?? workflow.versions[0] ?? null
}
