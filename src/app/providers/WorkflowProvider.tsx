import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { notifyManager } from '@tanstack/query-core'

// The catalogue is local. Banners and list rows have to paint in the same turn as the click.
notifyManager.setScheduler((callback) => {
  callback()
})
import { tryGetConfig } from '@bcbp-solutions-fzc-llc/frontend-sdk/config'
import { useBeforeAuthRedirect } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { recordFromReducer, recordReducerError, recordWorkflowAction } from '../../infrastructure/telemetry/metrics'
import { studioRepository } from '../../infrastructure/storage/studioStore'
import { DefinitionError } from '../../infrastructure/definition/client'
import { emptyCatalogue } from '../../infrastructure/definition/mapCatalogue'
import { loadDefinitionCatalogue, runDefinitionAction } from './definitionSession'
import { credentialFor, workflowReducer, type Action } from '../../application/commands/reducer'
import { acceptedUploadId, assessExport, type ExportAssessment } from '../../application/use-cases/catalogueActions'
import { editingVersion, type AppState, type NodeConfig, type Notice, type SecureCredential, type Workflow } from '../../domain/entities/types'
import { createInitialState } from '../../infrastructure/storage/seed'

const CATALOGUE_KEY = ['studio', 'catalogue'] as const

type BlankInput = { name: string; key: string; stageBinding: string }

export type WorkflowApi = {
  workflows: Workflow[]
  modules: ReturnType<typeof createInitialState>['modules']
  starters: ReturnType<typeof createInitialState>['starters']
  notice: Notice | null
  conflictWorkflowId: string | null
  reloadGeneration: Record<string, number>
  dismissNotice: () => void
  notify: (notice: Notice) => void
  createBlank: (input: BlankInput) => string | Promise<string>
  createFromStarter: (starterId: string, name?: string) => string | Promise<string>
  upload: (name: string, xml: string) => string | Promise<string>
  cloneWorkflow: (workflowId: string) => string | Promise<string>
  archiveWorkflow: (workflowId: string) => void
  saveDraft: (workflowId: string, xml: string, nodes: NodeConfig[]) => void
  keepDraft: (workflowId: string, xml: string, nodes: NodeConfig[]) => void
  publish: (workflowId: string, xml: string, nodes: NodeConfig[], actor: string) => void
  reload: (workflowId: string) => void
  promote: (workflowId: string, versionId: string) => void
  saveStarter: (workflowId: string, versionId: string) => void
  setCredential: (workflowId: string, elementId: string, vaultRef: string, secret: string) => void
  credential: (workflowId: string, elementId: string) => SecureCredential | null
  publishModule: (moduleId: string) => void
  archiveModule: (moduleId: string) => void
  secrets: () => string[]
  exportDiagram: (workflowId: string) => ExportAssessment | null
}

const WorkflowContext = createContext<WorkflowApi | null>(null)

function definitionServiceEnabled(): boolean {
  const flags = tryGetConfig()?.flags as Record<string, unknown> | undefined
  return flags?.definition_service === true
}

function createdId(before: AppState, after: AppState): string {
  const known = new Set(before.workflows.map((workflow) => workflow.id))
  return after.workflows.find((workflow) => !known.has(workflow.id))?.id ?? ''
}

function CatalogueProvider({ children }: { children: ReactNode }) {
  const remote = definitionServiceEnabled()
  const queryClient = useQueryClient()
  const [seed] = useState(() => (remote ? emptyCatalogue() : studioRepository.load()))
  const catalogue = useQuery({
    queryKey: CATALOGUE_KEY,
    queryFn: async () => {
      if (!remote) return studioRepository.load()
      try {
        return await loadDefinitionCatalogue()
      } catch (error) {
        const notice = error instanceof DefinitionError
          ? { key: 'notice.serviceRefused', vars: { code: error.problem.code, detail: error.problem.detail || error.problem.code } }
          : { key: 'notice.definitionUnavailable' as const }
        return emptyCatalogue(notice)
      }
    },
    initialData: seed,
    staleTime: remote ? 0 : Infinity,
    refetchOnMount: remote ? 'always' : false,
    refetchOnWindowFocus: false,
  })
  const state = catalogue.data
  const stateRef = useRef(state)
  const chain = useRef(Promise.resolve())
  const send = useCallback((action: Action) => {
    const next = workflowReducer(stateRef.current, action)
    stateRef.current = next
    queryClient.setQueryData<AppState>(CATALOGUE_KEY, next)
  }, [queryClient])
  const sendTracked = useCallback(
    (action: Action) => {
      const prev = stateRef.current
      try {
        send(action)
      } catch (error) {
        recordReducerError(action)
        throw error
      }
      recordFromReducer(prev, action)
    },
    [send],
  )
  const dispatch = useCallback(
    (action: Action) => {
      if (!remote) {
        sendTracked(action)
        return Promise.resolve(stateRef.current)
      }
      const run = chain.current.then(async () => {
        const next = await runDefinitionAction(stateRef.current, action)
        stateRef.current = next
        queryClient.setQueryData<AppState>(CATALOGUE_KEY, next)
        return next
      })
      chain.current = run.then(
        () => undefined,
        () => undefined,
      )
      return run
    },
    [queryClient, remote, sendTracked],
  )
  useBeforeAuthRedirect(() => {
    if (!remote) studioRepository.save(stateRef.current)
  })
  useEffect(() => {
    stateRef.current = state
    if (!remote) studioRepository.save(state)
  }, [remote, state])
  const now = () => new Date().toISOString()

  const api = useMemo<WorkflowApi>(() => {
    return {
      workflows: state.workflows,
      modules: state.modules,
      starters: state.starters,
      notice: state.notice,
      conflictWorkflowId: state.conflictWorkflowId,
      reloadGeneration: state.reloadGeneration,
      dismissNotice: () => {
        void dispatch({ type: 'dismissNotice' })
      },
      notify: (notice) => {
        void dispatch({ type: 'notify', notice })
      },
      createBlank: (input) => {
        if (!remote) {
          const id = `wf-${state.seq}`
          sendTracked({ type: 'createBlank', ...input, now: now() })
          return id
        }
        const before = stateRef.current
        return dispatch({ type: 'createBlank', ...input, now: now() }).then((after) => createdId(before, after))
      },
      createFromStarter: (starterId, name = '') => {
        if (!remote) {
          const id = `wf-${state.seq}`
          sendTracked({ type: 'createFromStarter', starterId, name, now: now() })
          return id
        }
        const before = stateRef.current
        return dispatch({ type: 'createFromStarter', starterId, name, now: now() }).then((after) => createdId(before, after))
      },
      upload: (name, xml) => {
        if (!remote) {
          const id = acceptedUploadId(state.seq, xml)
          sendTracked({ type: 'upload', name, xml, now: now() })
          return id
        }
        const before = stateRef.current
        return dispatch({ type: 'upload', name, xml, now: now() }).then((after) => createdId(before, after))
      },
      cloneWorkflow: (workflowId) => {
        if (!remote) {
          const id = `wf-${state.seq}`
          sendTracked({ type: 'clone', workflowId, now: now() })
          return id
        }
        const before = stateRef.current
        return dispatch({ type: 'clone', workflowId, now: now() }).then((after) => createdId(before, after))
      },
      archiveWorkflow: (workflowId) => {
        void dispatch({ type: 'archive', workflowId })
      },
      saveDraft: (workflowId, xml, nodes) => {
        void dispatch({ type: 'saveDraft', workflowId, xml, nodes, now: now() })
      },
      keepDraft: (workflowId, xml, nodes) => {
        if (remote) {
          const workflow = stateRef.current.workflows.find((item) => item.id === workflowId)
          const record = workflow?.versions.find((version) => version.id === workflow.draftVersionId)?.recordVersion ?? workflow?.serverRecordVersion
          if (!workflow || record == null) return
          void fetch(`/api/v1/workflows/${workflowId}/draft`, {
            method: 'PUT',
            keepalive: true,
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
              'Idempotency-Key': crypto.randomUUID(),
            },
            body: JSON.stringify({
              bpmn_xml: xml,
              name: workflow.name,
              description: workflow.description,
              record_version: record,
            }),
          })
          return
        }
        const action: Action = { type: 'saveDraft', workflowId, xml, nodes, now: now() }
        send(action)
        studioRepository.save(stateRef.current)
      },
      publish: (workflowId, xml, nodes, actor) => {
        void dispatch({ type: 'publish', workflowId, xml, nodes, actor, now: now() })
      },
      reload: (workflowId) => {
        void dispatch({ type: 'reload', workflowId, now: now() })
      },
      promote: (workflowId, versionId) => {
        void dispatch({ type: 'promote', workflowId, versionId })
      },
      saveStarter: (workflowId, versionId) => {
        void dispatch({ type: 'saveStarter', workflowId, versionId })
      },
      setCredential: (workflowId, elementId, vaultRef, secret) => {
        void dispatch({ type: 'setCredential', workflowId, elementId, vaultRef, secret })
      },
      credential: (workflowId, elementId) => credentialFor(state, workflowId, elementId),
      publishModule: (moduleId) => {
        void dispatch({ type: 'publishModule', moduleId, now: now() })
      },
      archiveModule: (moduleId) => {
        void dispatch({ type: 'archiveModule', moduleId })
      },
      secrets: () => Object.values(state.credentials).map((entry) => entry.secret),
      exportDiagram: (workflowId) => {
        const workflow = state.workflows.find((item) => item.id === workflowId)
        const current = workflow ? editingVersion(workflow) : null
        if (!workflow || !current) return null
        const result = assessExport(current.xml, current.nodes, Object.values(state.credentials).map((entry) => entry.secret), workflow.key)
        recordWorkflowAction('export', result.outcome)
        sendTracked({
          type: 'notify',
          notice: result.outcome === 'success'
            ? { key: 'detail.exported', vars: { file: result.fileName } }
            : { key: 'detail.exportBlocked' },
        })
        return result
      },
    }
  }, [dispatch, remote, send, sendTracked, state])

  return <WorkflowContext.Provider value={api}>{children}</WorkflowContext.Provider>
}

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false, staleTime: Infinity },
        },
      }),
  )
  return (
    <QueryClientProvider client={client}>
      <CatalogueProvider>{children}</CatalogueProvider>
    </QueryClientProvider>
  )
}

export function useWorkflows(): WorkflowApi {
  const api = useContext(WorkflowContext)
  if (!api) throw new Error('WorkflowProvider is missing')
  return api
}

export function useWorkflow(id: string | undefined): Workflow | null {
  const { workflows } = useWorkflows()
  if (!id) return null
  return workflows.find((workflow) => workflow.id === id) ?? null
}
