import { useGalleryUi } from '../state/studioUi'
import { useOutletContext } from 'react-router-dom'
import { useRouteTemplate, useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { APP_ID } from '../../shared/constants/app'
import { Badge, PageHeader, Panel, SecondaryButton, statusTone } from '../components/ui'
import type { AppShellOutletContext } from '../../app/layouts/appShellContext'
import { formatStamp } from '../../application/queries/query'
import { useWorkflows } from '../../app/providers/WorkflowProvider'

export default function ModuleLibraryPage() {
  useRouteTemplate('/t/:slug/workflows/modules')
  const t = useT(APP_ID)
  const { readOnly } = useOutletContext<AppShellOutletContext>()
  const { modules, publishModule, archiveModule } = useWorkflows()
  const openId = useGalleryUi((ui) => ui.openModuleId)
  const setOpenId = useGalleryUi((ui) => ui.setOpenModuleId)
  const selected = modules.find((module) => module.id === openId) ?? modules[0]

  return (
    <div>
      <PageHeader
        title={t('modules.title')}
        section={t('modules.section')}
        subtitle={t('modules.subtitle')}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="overflow-x-auto rounded-xl border border-aura-border bg-aura-surface">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-aura-muted">
              <tr>
                {(['modules.col.module', 'modules.col.scope', 'modules.col.latest', 'modules.col.dependency', 'modules.col.status', ''] as const).map((heading) => (
                  <th key={heading || 'actions'} className="px-3 py-3 font-semibold">
                    {heading ? t(heading) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <tr key={module.id} className="border-t border-aura-border">
                  <td className="px-3 py-3">
                    <button type="button" className="font-medium text-aura-primary" onClick={() => setOpenId(module.id)}>
                      {module.name}
                    </button>
                  </td>
                  <td className="px-3 py-3">{module.scope === 'platform' ? t('modules.scope.platform') : t('modules.scope.tenant')}</td>
                  <td className="px-3 py-3">{module.versions[0]?.label}</td>
                  <td className="px-3 py-3">{module.usedBy.length ? t('modules.inUse', { count: module.usedBy.length }) : t('modules.unused')}</td>
                  <td className="px-3 py-3">
                    <Badge tone={statusTone(module.status)}>{module.status}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <SecondaryButton ariaLabel={t('modules.publishNamed', { name: module.name })} disabled={readOnly} onClick={() => publishModule(module.id)}>
                        {t('modules.publish')}
                      </SecondaryButton>
                      <SecondaryButton
                        ariaLabel={t('modules.archiveNamed', { name: module.name })}
                        disabled={readOnly || module.status === 'archived'}
                        onClick={() => archiveModule(module.id)}
                      >
                        {t('modules.archive')}
                      </SecondaryButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected ? (
          <Panel title={selected.name}>
            <p className="mt-0 text-sm text-aura-muted">{selected.summary}</p>
            <p className="text-sm">
              <span className="text-aura-muted">{t('modules.contract')} </span>
              {selected.contract}
            </p>
            <p className="text-sm">
              <span className="text-aura-muted">{t('modules.keys')} </span>
              {selected.assignmentKeys.join(', ')}
            </p>
            <p className="text-sm">
              <span className="text-aura-muted">{t('modules.messages')} </span>
              {selected.messages.join(', ')}
            </p>
            <p className="text-sm">
              <span className="text-aura-muted">{t('modules.errors')} </span>
              {selected.errorCodes.join(', ')}
            </p>
            <p className="text-sm">
              <span className="text-aura-muted">{t('modules.usedBy')} </span>
              {selected.usedBy.join(', ') || t('modules.nothing')}
            </p>
            <h3 className="text-sm">{t('modules.versions')}</h3>
            <ul className="m-0 list-none p-0 text-sm">
              {selected.versions.map((version) => (
                <li key={version.label} className="border-t border-aura-border py-2">
                  <span className="font-medium">{version.label}</span>
                  <span className="text-aura-muted"> · {formatStamp(version.publishedAt)} · {version.note}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </div>
  )
}
