import { useGalleryUi } from '../state/studioUi'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { useRouteTemplate, useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { APP_ID } from '../../shared/constants/app'
import { PageHeader, Panel, PrimaryButton, SecondaryButton } from '../components/ui'
import { starterOutline } from '../../application/queries/diagramView'
import { workflowBase } from '../../application/queries/query'
import type { AppShellOutletContext } from '../../app/layouts/appShellContext'
import { useWorkflows } from '../../app/providers/WorkflowProvider'

export default function StarterGalleryPage() {
  useRouteTemplate('/t/:slug/workflows/starters')
  const t = useT(APP_ID)
  const navigate = useNavigate()
  const location = useLocation()
  const base = workflowBase(location.pathname)
  const { readOnly } = useOutletContext<AppShellOutletContext>()
  const { starters, createFromStarter } = useWorkflows()
  const previewId = useGalleryUi((ui) => ui.previewId)
  const setPreviewId = useGalleryUi((ui) => ui.setPreviewId)
  const categories = [...new Set(starters.map((starter) => starter.category))]
  const preview = starters.find((starter) => starter.id === (previewId ?? starters[0]?.id)) ?? null

  return (
    <div>
      <PageHeader
        title={t('starters.title')}
        section={t('starters.section')}
        subtitle={t('starters.subtitle')}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-aura-muted">{category}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {starters
                  .filter((starter) => starter.category === category)
                  .map((starter) => (
                    <article key={starter.id} className="rounded-xl border border-aura-border bg-aura-surface p-4">
                      <h3 className="m-0 text-base">{starter.name}</h3>
                      <p className="text-sm text-aura-muted">{starter.summary}</p>
                      <p className="text-xs text-aura-muted">{starter.stageBinding}</p>
                      <div className="flex gap-2">
                        <SecondaryButton onClick={() => setPreviewId(starter.id)}>{t('starters.previewNamed', { name: starter.name })}</SecondaryButton>
                        <PrimaryButton
                          disabled={readOnly}
                          onClick={() => {
                            const created = createFromStarter(starter.id, starter.name)
                            const open = (id: string) => {
                              if (id) navigate(`${base}/${id}/editor`)
                            }
                            if (typeof created === 'string') open(created)
                            else void created.then(open)
                          }}
                        >
                          {t('starters.useNamed', { name: starter.name })}
                        </PrimaryButton>
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </div>
        <Panel title={preview ? preview.name : t('starters.preview')}>
          {preview ? (
            <StarterPreview xml={preview.xml} />
          ) : (
            <p className="text-sm text-aura-muted">{t('starters.choose')}</p>
          )}
        </Panel>
      </div>
    </div>
  )
}

function StarterPreview({ xml }: { xml: string }) {
  const t = useT(APP_ID)
  const outline = starterOutline(xml)
  return (
    <div>
      <p className="mt-0 text-xs font-semibold uppercase tracking-wide text-aura-muted">{t('starters.lanes')}</p>
      <div className="flex flex-col gap-2">
        {outline.lanes.map((lane) => (
          <div key={lane.id} className="rounded-lg border border-aura-border px-3 py-2 text-sm">
            {lane.name}
          </div>
        ))}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-aura-muted">{t('starters.elements')}</p>
      <ul className="m-0 list-disc pl-5 text-sm">
        {outline.tasks.map((task) => (
          <li key={task.id}>
            {task.name || task.id}
          </li>
        ))}
      </ul>
    </div>
  )
}
