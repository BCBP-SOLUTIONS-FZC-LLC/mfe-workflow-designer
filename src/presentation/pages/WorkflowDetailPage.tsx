import { useMemo } from 'react'
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { useRouteTemplate, useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { APP_ID } from '../../shared/constants/app'
import { Badge, PageHeader, Panel, SecondaryButton, SelectInput, statusTone } from '../components/ui'
import { activeVersion, diffNodes, draftLabel, editingVersion, publicationLabel, workflowBase } from '../../application/queries/query'
import { useDiffUi } from '../state/studioUi'
import type { AppShellOutletContext } from '../../app/layouts/appShellContext'
import { useWorkflow, useWorkflows } from '../../app/providers/WorkflowProvider'

function useDetail() {
  const { workflowId } = useParams()
  const location = useLocation()
  const workflow = useWorkflow(workflowId)
  const base = `${workflowBase(location.pathname)}/${workflowId ?? ''}`
  return { workflow, base }
}

export default function WorkflowDetailLayout() {
  useRouteTemplate('/t/:slug/workflows/:workflowId')
  const t = useT(APP_ID)
  const { workflow, base } = useDetail()
  const outlet = useOutletContext<AppShellOutletContext>()
  if (!workflow) return <p>{t('detail.missing')}</p>
  const tabs = [
    { to: base, label: t('detail.tab.overview'), end: true },
    { to: `${base}/versions`, label: t('detail.tab.versions'), end: false },
    { to: `${base}/diff`, label: t('detail.tab.diff'), end: false },
    { to: `${base}/nodes`, label: t('detail.tab.nodes'), end: false },
    { to: `${base}/usage`, label: t('detail.tab.usage'), end: false },
  ]
  return (
    <div>
      <PageHeader
        title={workflow.name}
        section={workflow.key}
        subtitle={workflow.description}
        actions={
          <>
            <Badge tone={statusTone(workflow.status)}>{workflow.status}</Badge>
            <Badge tone={statusTone(workflow.validity)}>{workflow.validity}</Badge>
          </>
        }
      />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label={t('detail.nav')}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm no-underline ${isActive ? 'bg-aura-primary-soft text-aura-primary' : 'text-aura-muted hover:bg-aura-hover'}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet context={outlet} />
    </div>
  )
}

export function OverviewTab() {
  useRouteTemplate('/t/:slug/workflows/:workflowId')
  const t = useT(APP_ID)
  const { workflow, base } = useDetail()
  const { userLabel, readOnly } = useOutletContext<AppShellOutletContext>()
  const api = useWorkflows()
  if (!workflow) return null
  const current = editingVersion(workflow)
  const published = workflow.versions.find((version) => version.state === 'published' || version.id === workflow.activeVersionId)

  function exportDiagram() {
    if (!workflow) return
    const result = api.exportDiagram(workflow.id)
    if (!result || result.outcome !== 'success') return
    try {
      const blob = new Blob([result.xml], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.fileName
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      // The notice still confirms the export payload omitted secrets.
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Panel title={t('detail.tab.overview')}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-aura-muted">{t('detail.stage')}</dt>
            <dd className="m-0 font-medium">{workflow.stageBinding}</dd>
          </div>
          <div>
            <dt className="text-aura-muted">{t('detail.publication')}</dt>
            <dd className="m-0 font-medium">{publicationLabel(workflow)}</dd>
          </div>
          <div>
            <dt className="text-aura-muted">{t('detail.draft')}</dt>
            <dd className="m-0 font-medium">{draftLabel(workflow)}</dd>
          </div>
          <div>
            <dt className="text-aura-muted">{t('detail.running')}</dt>
            <dd className="m-0 font-medium">{t('detail.runningCount', { count: workflow.runningInstances })}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-aura-muted">{workflow.description}</p>
      </Panel>
      <Panel title={t('detail.actions')}>
        <div className="flex flex-col gap-2">
          <Link to={`${base}/editor`} className="rounded-lg bg-aura-primary px-3 py-2 text-center text-sm font-medium text-white no-underline">
            {t('detail.openEditor')}
          </Link>
          <SecondaryButton
            disabled={readOnly || !current || workflow.status === 'archived'}
            onClick={() => current && api.publish(workflow.id, current.xml, current.nodes, userLabel)}
          >
            {t('detail.publish')}
          </SecondaryButton>
          <SecondaryButton onClick={exportDiagram}>{t('detail.export')}</SecondaryButton>
          <SecondaryButton
            disabled={readOnly || !published}
            onClick={() => published && api.saveStarter(workflow.id, published.id)}
          >
            {t('detail.saveStarter')}
          </SecondaryButton>
        </div>
      </Panel>
    </div>
  )
}

export function VersionsTab() {
  useRouteTemplate('/t/:slug/workflows/:workflowId/versions')
  const t = useT(APP_ID)
  const { workflow } = useDetail()
  const { promote } = useWorkflows()
  const { readOnly } = useOutletContext<AppShellOutletContext>()
  if (!workflow) return null
  return (
    <Panel title={t('detail.versions')}>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-aura-muted">
          <tr>
            {(['detail.col.version', 'detail.col.state', 'detail.col.record', 'detail.col.author', 'detail.col.note', ''] as const).map((heading) => (
              <th key={heading || 'actions'} className="py-2 pr-3 font-semibold">
                {heading ? t(heading) : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {workflow.versions.map((version) => (
            <tr key={version.id} className="border-t border-aura-border">
              <td className="py-2 pr-3 font-medium">
                {version.label}
                {version.id === workflow.activeVersionId ? t('detail.active') : ''}
              </td>
              <td className="py-2 pr-3">{version.state}</td>
              <td className="py-2 pr-3">r{version.recordVersion}</td>
              <td className="py-2 pr-3">{version.createdBy}</td>
              <td className="py-2 pr-3 text-aura-muted">{version.note}</td>
              <td className="py-2">
                {version.state !== 'draft' && version.id !== workflow.activeVersionId ? (
                  <SecondaryButton disabled={readOnly} onClick={() => promote(workflow.id, version.id)}>{t('detail.promote', { label: version.label })}</SecondaryButton>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

export function DiffTab() {
  useRouteTemplate('/t/:slug/workflows/:workflowId/diff')
  const t = useT(APP_ID)
  const { workflow } = useDetail()
  const versions = useMemo(() => workflow?.versions ?? [], [workflow])
  const stored = useDiffUi()
  const firstId = versions[0]?.id ?? ''
  const lastId = versions[versions.length - 1]?.id ?? ''
  const synced = Boolean(workflow && stored.workflowId === workflow.id)
  const leftId = synced ? stored.leftId : firstId
  const rightId = synced ? stored.rightId : lastId
  if (workflow && !synced) stored.select(workflow.id, firstId, lastId)
  const lines = useMemo(() => {
    const left = versions.find((version) => version.id === leftId)
    const right = versions.find((version) => version.id === rightId)
    if (!left || !right) return []
    return diffNodes(left.nodes, right.nodes)
  }, [leftId, rightId, versions])
  if (!workflow) return null
  const options = versions.map((version) => ({ value: version.id, label: version.label }))
  return (
    <Panel title={t('detail.compare')}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <SelectInput label={t('detail.from')} value={leftId} onChange={(leftId) => useDiffUi.setState({ leftId })} options={options} />
        <SelectInput label={t('detail.to')} value={rightId} onChange={(rightId) => useDiffUi.setState({ rightId })} options={options} />
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-aura-muted">{t('detail.noDiff')}</p>
      ) : (
        <ul className="m-0 list-disc pl-5 text-sm">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function NodesTab() {
  useRouteTemplate('/t/:slug/workflows/:workflowId/nodes')
  const t = useT(APP_ID)
  const { workflow } = useDetail()
  const nodes = editingVersion(workflow ?? emptyWorkflow())?.nodes ?? []
  if (!workflow) return null
  const human = nodes.filter((node) => node.kind === 'user')
  return (
    <Panel title={t('detail.nodes')}>
      <p className="mt-0 text-sm text-aura-muted">{t('detail.humanCount', { count: human.length })}</p>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-aura-muted">
          <tr>
            {(['detail.col.task', 'detail.col.kind', 'detail.col.stage', 'detail.col.person', 'detail.col.sla'] as const).map((heading) => (
              <th key={heading} className="py-2 pr-3 font-semibold">
                {t(heading)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nodes
            .filter((node) => node.kind !== 'boundary')
            .map((node) => (
              <tr key={node.id} className="border-t border-aura-border">
                <td className="py-2 pr-3 font-medium">{node.name}</td>
                <td className="py-2 pr-3">{node.kind}</td>
                <td className="py-2 pr-3">{node.stageType || '—'}</td>
                <td className="py-2 pr-3">{node.assignee || t('detail.unassigned')}</td>
                <td className="py-2 pr-3">{node.slaHours ? t('detail.sla', { warn: node.slaWarnHours || '0', hours: node.slaHours }) : '—'}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </Panel>
  )
}

export function UsageTab() {
  useRouteTemplate('/t/:slug/workflows/:workflowId/usage')
  const t = useT(APP_ID)
  const { workflow } = useDetail()
  if (!workflow) return null
  const current = activeVersion(workflow)
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title={t('detail.running')}>
        <p className="m-0 text-3xl font-semibold">{workflow.runningInstances}</p>
        <p className="text-sm text-aura-muted">{t('detail.instancesOn', { label: current?.label ?? t('detail.draftLabel') })}</p>
      </Panel>
      <Panel title={t('detail.used')}>
        {workflow.usages.length === 0 ? (
          <p className="text-sm text-aura-muted">{t('detail.noSystems')}</p>
        ) : (
          <ul className="m-0 list-none p-0 text-sm">
            {workflow.usages.map((usage) => (
              <li key={usage.system} className="flex justify-between border-b border-aura-border py-2">
                <span>{usage.system}</span>
                <span>{usage.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function emptyWorkflow() {
  return {
    id: '',
    name: '',
    key: '',
    description: '',
    status: 'draft' as const,
    stageBinding: '',
    validity: 'unknown' as const,
    activeVersionId: null,
    draftVersionId: null,
    versions: [],
    runningInstances: 0,
    usages: [],
    lockedBy: null,
    conflictArmed: false,
    serverRecordVersion: 0,
    serverXml: '',
    serverNodes: [],
    publishedAt: null,
    publishedBy: null,
  }
}
