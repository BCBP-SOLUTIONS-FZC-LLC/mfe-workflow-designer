import { readProblem, type ServiceProblem } from './problem'

export class DefinitionError extends Error {
  readonly problem: ServiceProblem

  constructor(problem: ServiceProblem) {
    super(problem.code)
    this.name = 'DefinitionError'
    this.problem = problem
  }
}

type Page<K extends string, T> = { pagination: { total_count: number } } & Record<K, T[]>

async function send<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      accept: 'application/json',
      ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(init?.method && init.method !== 'GET' ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (!response.ok) throw new DefinitionError(await readProblem(response))
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function everyPage<K extends string, T>(path: string, key: K): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; page < 1000; page += 1) {
    const join = path.includes('?') ? '&' : '?'
    const body = await send<Page<K, T>>(`${path}${join}page=${page}&limit=100`)
    const chunk = body[key] ?? []
    rows.push(...chunk)
    if (chunk.length === 0 || rows.length >= (body.pagination?.total_count ?? rows.length)) break
  }
  return rows
}

export type WorkflowSummary = {
  id: string
  key: string
  name: string
  description: string
  active_version_id?: string
  active_version_number?: number
  has_draft: boolean
  updated_at: string
}

export type VersionSummary = {
  id: string
  version_number?: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  is_valid: boolean
  created_by_user_id: string
  published_at?: string
  created_at: string
}

export type VersionDetail = VersionSummary & {
  bpmn_xml: string
  record_version: number
}

export type WorkflowDetail = WorkflowSummary & { versions: VersionSummary[] }

export type WriteResult = {
  workflow_id: string
  version_id: string
  status: string
  version_number: number | null
  record_version?: number
  message: string
}

export type ModuleSummary = {
  id: string
  scope: 'tenant' | 'global'
  name: string
  description: string
  process_id: string
  active_version_id?: string
}

export type ModuleContract = {
  slots: { id: string; label: string; open: boolean }[]
  tasks: { assignee_key: string }[]
  messages: string[]
  error_codes: string[]
}

export type StarterTemplate = {
  id: string
  scope: 'tenant' | 'global'
  name: string
  description: string
  category?: string
  bpmn_xml: string
}

export const definitionApi = {
  workflows: () => everyPage< 'workflows', WorkflowSummary>('/workflows', 'workflows'),
  workflow: (id: string) => send<WorkflowDetail>(`/workflows/${id}?versions_limit=100`),
  version: (workflowId: string, versionId: string) =>
    send<VersionDetail>(`/workflows/${workflowId}/versions/${versionId}`),
  draft: (workflowId: string) => send<VersionDetail>(`/workflows/${workflowId}/draft`),
  createWorkflow: (body: { key: string; name: string; description?: string; bpmn_xml: string }) =>
    send<WriteResult>('/workflows', { method: 'POST', body }),
  initDraft: (workflowId: string) => send<WriteResult>(`/workflows/${workflowId}/draft`, { method: 'POST' }),
  updateDraft: (
    workflowId: string,
    body: { bpmn_xml: string; name?: string; description?: string; record_version: number },
  ) => send<WriteResult>(`/workflows/${workflowId}/draft`, { method: 'PUT', body }),
  publish: (workflowId: string, versionId: string, force: boolean) =>
    send<WriteResult>(`/workflows/${workflowId}/versions/${versionId}/publish`, {
      method: 'POST',
      body: force ? { force_publish_structural: true } : {},
    }),
  clone: (workflowId: string, versionId: string, body: { new_key: string; new_name: string; new_description?: string }) =>
    send<WriteResult>(`/workflows/${workflowId}/versions/${versionId}/clone`, { method: 'POST', body }),
  archive: (workflowId: string) => send<unknown>(`/workflows/${workflowId}/archive`, { method: 'POST' }),
  promote: (workflowId: string, versionId: string) =>
    send<WriteResult>(`/workflows/${workflowId}/versions/${versionId}/promote`, { method: 'POST' }),
  modules: () => everyPage<'modules', ModuleSummary>('/modules', 'modules'),
  contract: (moduleId: string, versionId: string) =>
    send<ModuleContract>(`/modules/${moduleId}/versions/${versionId}/contract`),
  moduleVersions: (moduleId: string) =>
    send<{ versions: { id: string; status: string; version_number?: number }[] }>(`/modules/${moduleId}/versions?limit=20`),
  publishModule: (moduleId: string, versionId: string) =>
    send<unknown>(`/modules/${moduleId}/versions/${versionId}/publish`, { method: 'POST' }),
  archiveModule: (moduleId: string) => send<unknown>(`/modules/${moduleId}`, { method: 'DELETE' }),
  starters: () => everyPage<'starters', StarterTemplate>('/starters', 'starters'),
  saveStarter: (versionId: string, body: { name: string; description?: string; category: string }) =>
    send<StarterTemplate>(`/starters/from-workflow-version/${versionId}`, { method: 'POST', body }),
}
