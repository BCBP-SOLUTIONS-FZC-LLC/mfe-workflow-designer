import { useEffect, useRef } from 'react'
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { useBeforeAuthRedirect, useRouteTemplate, useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { APP_ID } from '../../shared/constants/app'
import { Badge, PrimaryButton, statusTone } from '../components/ui'
import { PALETTE_ITEMS, placePaletteItem, renameDiagramElement, reviewDiagram, syncDiagramNodes, type PaletteId } from '../../application/use-cases/editDiagram'
import { editingVersion, workflowBase } from '../../application/queries/query'
import { BpmnCanvas, type BpmnCanvasHandle } from '../features/editor/BpmnCanvas'
import { PropertiesPanel } from '../features/editor/PropertiesPanel'
import { useEditorUi } from '../state/studioUi'
import type { AppShellOutletContext } from '../../app/layouts/appShellContext'
import { useWorkflow, useWorkflows } from '../../app/providers/WorkflowProvider'

export default function EditorPage() {
  useRouteTemplate('/t/:slug/workflows/:workflowId/editor')
  const { workflowId } = useParams()
  const workflow = useWorkflow(workflowId)
  const location = useLocation()
  const base = workflowBase(location.pathname)
  const { userLabel, readOnly } = useOutletContext<AppShellOutletContext>()
  const t = useT(APP_ID)
  const editingLocked = Boolean(workflow?.lockedBy) || readOnly
  const api = useWorkflows()
  const version = workflow ? editingVersion(workflow) : null
  const generation = workflow ? (api.reloadGeneration[workflow.id] ?? 0) : 0
  const stored = useEditorUi()
  const synced = Boolean(workflow && stored.seenId === workflow.id && stored.seenGeneration === generation)
  const xml = synced ? stored.xml : (version?.xml ?? '')
  const nodes = synced || !version?.nodes ? stored.nodes : version.nodes
  const selectedId = synced ? stored.selectedId : null
  const saveLabel = synced ? stored.saveLabel : 'editor.saved'
  const baseline = synced ? stored.baseline : JSON.stringify({ xml: version?.xml ?? '', nodes: version?.nodes ?? [] })
  if (workflow && !synced) {
    const nextXml = version?.xml ?? ''
    const nextNodes = version?.nodes ?? []
    stored.replaceDraft({
      seenId: workflow.id,
      seenGeneration: generation,
      xml: nextXml,
      nodes: nextNodes,
      selectedId: null,
      saveLabel: 'editor.saved',
      baseline: JSON.stringify({ xml: nextXml, nodes: nextNodes }),
    })
  }
  const canvasRef = useRef<BpmnCanvasHandle>(null)
  const saveDraft = api.saveDraft

  useBeforeAuthRedirect(() => {
    if (!workflow || editingLocked) return
    const draft = useEditorUi.getState()
    if (draft.seenId === workflow.id) api.keepDraft(workflow.id, draft.xml, draft.nodes)
    else api.keepDraft(workflow.id, xml, nodes)
  })

  useEffect(() => {
    if (!workflow || editingLocked) return
    const serial = JSON.stringify({ xml, nodes })
    if (serial === baseline) return
    const timer = window.setTimeout(() => {
      saveDraft(workflow.id, xml, nodes)
      useEditorUi.setState({ baseline: serial, saveLabel: 'editor.autosaved' })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [baseline, editingLocked, nodes, saveDraft, workflow, xml])

  const review = reviewDiagram(xml, nodes, api.secrets())
  const issues = review.issues
  const selected = nodes.find((node) => node.id === selectedId) ?? null
  const clean = review.clean
  const record = workflow ? editingVersion(workflow) : null

  function updateXml(next: string) {
    useEditorUi.setState((ui) => ({ xml: next, nodes: syncDiagramNodes(next, ui.nodes) }))
  }

  function add(item: PaletteId) {
    if (!workflow || editingLocked) return
    if (item === 'lane') {
      if (canvasRef.current?.addLane()) return
      updateXml(placePaletteItem(xml, 'lane'))
      return
    }
    if (canvasRef.current?.append(item)) return
    updateXml(placePaletteItem(xml, item))
  }

  if (!workflow || !version) return <p>{t('editor.missing')}</p>

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs uppercase tracking-wide text-aura-muted">
            <Link to={`${base}/${workflow.id}`} className="text-aura-primary no-underline">
              {t('editor.back')}
            </Link>
          </p>
          <h1 className="m-0 mt-1 text-xl font-semibold">{workflow.name}</h1>
          <p className="mt-1 text-sm text-aura-muted">
            {t('editor.record', { version: record?.recordVersion ?? version.recordVersion })}
            {workflow.conflictArmed ? ` · ${t('editor.serverRecord', { version: workflow.serverRecordVersion })}` : ''}
            {' · '}
            {t(saveLabel)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={statusTone(workflow.validity)}>{workflow.validity}</Badge>
          <PrimaryButton
            disabled={editingLocked || issues.length > 0}
            onClick={() => {
              useEditorUi.setState({ baseline: JSON.stringify({ xml, nodes }) })
              api.publish(workflow.id, xml, nodes, userLabel)
            }}
          >
            {t('editor.publish')}
          </PrimaryButton>
        </div>
      </div>

      {workflow.lockedBy ? (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {t('editor.locked', { name: workflow.lockedBy })}
        </p>
      ) : null}
      {readOnly && !workflow.lockedBy ? (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {t('editor.readOnly')}
        </p>
      ) : null}

      {api.conflictWorkflowId === workflow.id ? (
        <div role="alertdialog" aria-label={t('editor.conflictLabel')} className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-900">
          <p className="m-0">{t('editor.conflict')}</p>
          <button type="button" className="mt-2 rounded-lg bg-aura-primary px-3 py-2 text-white" onClick={() => api.reload(workflow.id)}>
            {t('editor.reload')}
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="mb-3 flex flex-wrap gap-1 rounded-xl border border-aura-border bg-aura-surface p-2">
            {PALETTE_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={editingLocked}
                className="rounded-md px-2 py-1.5 text-left text-sm text-aura-text hover:bg-aura-hover disabled:opacity-50"
                onClick={() => add(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <BpmnCanvas
            ref={canvasRef}
            xml={xml}
            issues={issues}
            reloadKey={generation}
            onSelect={(element) => useEditorUi.setState({ selectedId: element?.id ?? null })}
            onXml={updateXml}
          />
          <ul className="mt-3 list-disc pl-5 text-sm text-red-700">
            {issues.map((issue) => (
              <li key={`${issue.elementId}-${issue.message}`}>
                <button type="button" className="text-left text-red-700" onClick={() => useEditorUi.setState({ selectedId: issue.elementId })}>
                  {issue.message}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-aura-muted">
            {clean ? t('editor.clean') : t('editor.dirty')}
          </p>
        </div>
        <aside className="max-h-[640px] overflow-auto rounded-xl border border-aura-border bg-aura-surface p-3">
          <h2 className="m-0 mb-3 text-xs font-semibold uppercase tracking-wide text-aura-muted">{t('editor.properties')}</h2>
          <fieldset disabled={editingLocked} className="m-0 min-w-0 border-0 p-0">
            <PropertiesPanel
              node={selected}
              modules={api.modules}
              credential={selected ? api.credential(workflow.id, selected.id) : null}
              onChange={(patch) => {
                if (!selected) return
                if (patch.name !== undefined && patch.name !== selected.name) {
                  const renamed = canvasRef.current?.rename(selected.id, patch.name) ?? false
                  if (!renamed) {
                    useEditorUi.setState((ui) => ({ xml: renameDiagramElement(ui.xml, selected.id, patch.name ?? '') }))
                  }
                }
                useEditorUi.setState((ui) => ({
                  nodes: ui.nodes.map((node) => (node.id === selected.id ? { ...node, ...patch } : node)),
                }))
              }}
              onCredential={(vaultRef, secret) => {
                if (!selected) return
                useEditorUi.setState((ui) => ({
                  nodes: ui.nodes.map((node) => (node.id === selected.id ? { ...node, credentialRef: vaultRef } : node)),
                }))
                api.setCredential(workflow.id, selected.id, vaultRef, secret)
              }}
            />
          </fieldset>
        </aside>
      </div>
    </div>
  )
}
