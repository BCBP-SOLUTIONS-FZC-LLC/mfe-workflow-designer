import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { notifyManager } from '@tanstack/query-core'

// The catalogue is local. Banners and list rows have to paint in the same turn as the click.
notifyManager.setScheduler((callback) => {
  callback()
})
import { useBeforeAuthRedirect } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { recordFromReducer, recordReducerError, recordWorkflowAction } from '../../infrastructure/telemetry/metrics'
import { studioRepository } from '../../infrastructure/storage/studioStore'
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
  createBlank: (input: BlankInput) => string
  createFromStarter: (starterId: string, name?: string) => string
  upload: (name: string, xml: string) => string
  cloneWorkflow: (workflowId: string) => string
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

function CatalogueProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [seed] = useState(() => studioRepository.load())
  const catalogue = useQuery({
    queryKey: CATALOGUE_KEY,
    queryFn: () => studioRepository.load(),
    initialData: seed,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
  const state = catalogue.data
  const stateRef = useRef(state)
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
  useBeforeAuthRedirect(() => studioRepository.save(stateRef.current))
  useEffect(() => {
    studioRepository.save(state)
  }, [state])
  const now = () => new Date().toISOString()

  const api = useMemo<WorkflowApi>(() => {
    return {
      workflows: state.workflows,
      modules: state.modules,
      starters: state.starters,
      notice: state.notice,
      conflictWorkflowId: state.conflictWorkflowId,
      reloadGeneration: state.reloadGeneration,
      dismissNotice: () => sendTracked({ type: 'dismissNotice' }),
      notify: (notice) => sendTracked({ type: 'notify', notice }),
      createBlank: (input) => {
        const id = `wf-${state.seq}`
        sendTracked({ type: 'createBlank', ...input, now: now() })
        return id
      },
      createFromStarter: (starterId, name = '') => {
        const id = `wf-${state.seq}`
        sendTracked({ type: 'createFromStarter', starterId, name, now: now() })
        return id
      },
      upload: (name, xml) => {
        const id = acceptedUploadId(state.seq, xml)
        sendTracked({ type: 'upload', name, xml, now: now() })
        return id
      },
      cloneWorkflow: (workflowId) => {
        const id = `wf-${state.seq}`
        sendTracked({ type: 'clone', workflowId, now: now() })
        return id
      },
      archiveWorkflow: (workflowId) => sendTracked({ type: 'archive', workflowId }),
      saveDraft: (workflowId, xml, nodes) => sendTracked({ type: 'saveDraft', workflowId, xml, nodes, now: now() }),
      keepDraft: (workflowId, xml, nodes) => {
        const action: Action = { type: 'saveDraft', workflowId, xml, nodes, now: now() }
        send(action)
        studioRepository.save(stateRef.current)
      },
      publish: (workflowId, xml, nodes, actor) =>
        sendTracked({ type: 'publish', workflowId, xml, nodes, actor, now: now() }),
      reload: (workflowId) => sendTracked({ type: 'reload', workflowId, now: now() }),
      promote: (workflowId, versionId) => sendTracked({ type: 'promote', workflowId, versionId }),
      saveStarter: (workflowId, versionId) => sendTracked({ type: 'saveStarter', workflowId, versionId }),
      setCredential: (workflowId, elementId, vaultRef, secret) =>
        sendTracked({ type: 'setCredential', workflowId, elementId, vaultRef, secret }),
      credential: (workflowId, elementId) => credentialFor(state, workflowId, elementId),
      publishModule: (moduleId) => sendTracked({ type: 'publishModule', moduleId, now: now() }),
      archiveModule: (moduleId) => sendTracked({ type: 'archiveModule', moduleId }),
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
  }, [send, sendTracked, state])

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
