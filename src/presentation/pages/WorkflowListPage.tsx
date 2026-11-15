import { useMemo, useRef } from 'react'
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { useRouteTemplate, useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { APP_ID } from '../../shared/constants/app'
import { Badge, Dialog, PageHeader, PrimaryButton, SecondaryButton, SelectInput, TextInput, statusTone } from '../components/ui'
import { activeVersionLabel, draftLabel, filterWorkflows, publicationLabel, workflowBase } from '../../application/queries/query'
import type { AppShellOutletContext } from '../../app/layouts/appShellContext'
import { useWorkflows } from '../../app/providers/WorkflowProvider'
import { useListUi } from '../state/studioUi'

export default function WorkflowListPage() {
  useRouteTemplate('/t/:slug/workflows')
  const t = useT(APP_ID)
  const navigate = useNavigate()
  const location = useLocation()
  const base = workflowBase(location.pathname)
  const { search, readOnly } = useOutletContext<AppShellOutletContext>()
  const { workflows, createBlank, upload, cloneWorkflow, archiveWorkflow } = useWorkflows()
  const fileRef = useRef<HTMLInputElement>(null)
  const list = useListUi()
  if (search !== list.seenSearch) list.syncSearch(search)
  const { localSearch, status, draft, validity, menuOpen, blankOpen, name, key, stageBinding } = list
  const { setLocalSearch, setStatus, setDraft, setValidity, setMenuOpen, setBlankOpen, setName, setKey, setStageBinding } = list

  const rows = useMemo(
    () => filterWorkflows(workflows, { search: localSearch, status, draft, validity }),
    [workflows, localSearch, status, draft, validity],
  )

  return (
    <div>
      <PageHeader
        title={t('list.title')}
        section={t('list.section')}
        subtitle={t('list.subtitle')}
        actions={
          <div className="relative">
            <PrimaryButton disabled={readOnly} onClick={() => setMenuOpen(!menuOpen)}>{t('list.create')}</PrimaryButton>
            {menuOpen ? (
              <div role="menu" className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-aura-border bg-aura-surface py-1 shadow-lg">
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-aura-hover"
                  onClick={() => {
                    setMenuOpen(false)
                    setBlankOpen(true)
                  }}
                >
                  {t('list.blank')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-aura-hover"
                  onClick={() => navigate(`${base}/starters`)}
                >
                  {t('list.fromStarter')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-aura-hover"
                  onClick={() => fileRef.current?.click()}
                >
                  {t('list.upload')}
                </button>
              </div>
            ) : null}
            <input
              ref={fileRef}
              aria-label={t('list.upload')}
              type="file"
              accept=".bpmn,.xml,text/xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                void file.text().then((xml) => {
                  const created = upload(file.name.replace(/\.(bpmn|xml)$/i, ''), xml)
                  const open = (id: string) => {
                    if (id) navigate(`${base}/${id}/editor`)
                  }
                  if (typeof created === 'string') open(created)
                  else void created.then(open)
                })
              }}
            />
          </div>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <TextInput label={t('list.search')} value={localSearch} onChange={setLocalSearch} placeholder={t('list.searchPlaceholder')} />
        <SelectInput
          label={t('list.status')}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: t('list.status.all') },
            { value: 'draft', label: t('list.status.draft') },
            { value: 'published', label: t('list.status.published') },
            { value: 'archived', label: t('list.status.archived') },
          ]}
        />
        <SelectInput
          label={t('list.draft')}
          value={draft}
          onChange={setDraft}
          options={[
            { value: 'all', label: t('list.draft.any') },
            { value: 'yes', label: t('list.draft.yes') },
            { value: 'no', label: t('list.draft.no') },
          ]}
        />
        <SelectInput
          label={t('list.validity')}
          value={validity}
          onChange={setValidity}
          options={[
            { value: 'all', label: t('list.validity.any') },
            { value: 'valid', label: t('list.validity.valid') },
            { value: 'invalid', label: t('list.validity.invalid') },
            { value: 'unknown', label: t('list.validity.unknown') },
          ]}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-aura-border bg-aura-surface">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-aura-muted">
            <tr>
              {(['list.col.name', 'list.col.key', 'list.col.status', 'list.col.active', 'list.col.draft', 'list.col.validity', 'list.col.stage', 'list.col.publication', 'list.col.actions'] as const).map((heading) => (
                <th key={heading} className="px-3 py-3 font-semibold">
                  {t(heading)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-aura-muted">
                  {t('list.empty')}
                </td>
              </tr>
            ) : (
              rows.map((workflow) => (
                <tr key={workflow.id} className="border-t border-aura-border">
                  <td className="px-3 py-3 font-medium">
                    <Link to={`${base}/${workflow.id}`} className="block text-aura-primary no-underline">
                      {workflow.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-aura-muted">{workflow.key}</td>
                  <td className="px-3 py-3">
                    <Badge tone={statusTone(workflow.status)}>{workflow.status}</Badge>
                  </td>
                  <td className="px-3 py-3">{activeVersionLabel(workflow)}</td>
                  <td className="px-3 py-3">{draftLabel(workflow)}</td>
                  <td className="px-3 py-3">
                    <Badge tone={statusTone(workflow.validity)}>{workflow.validity}</Badge>
                  </td>
                  <td className="px-3 py-3">{workflow.stageBinding}</td>
                  <td className="px-3 py-3">{publicationLabel(workflow)}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <SecondaryButton ariaLabel={t('list.cloneNamed', { name: workflow.name })} disabled={readOnly} onClick={() => cloneWorkflow(workflow.id)}>
                        {t('list.clone')}
                      </SecondaryButton>
                      <SecondaryButton
                        ariaLabel={t('list.archiveNamed', { name: workflow.name })}
                        disabled={readOnly || workflow.status === 'archived'}
                        onClick={() => archiveWorkflow(workflow.id)}
                      >
                        {t('list.archive')}
                      </SecondaryButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {blankOpen ? (
        <Dialog title={t('list.blank')} onClose={() => setBlankOpen(false)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              const created = createBlank({ name, key, stageBinding })
              const open = (id: string) => {
                if (id) navigate(`${base}/${id}/editor`)
              }
              if (typeof created === 'string') open(created)
              else void created.then(open)
            }}
          >
            <TextInput label={t('list.field.name')} value={name} onChange={setName} />
            <TextInput label={t('list.field.key')} value={key} onChange={setKey} />
            <TextInput label={t('list.field.stage')} value={stageBinding} onChange={setStageBinding} />
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setBlankOpen(false)}>{t('list.cancel')}</SecondaryButton>
              <PrimaryButton type="submit">{t('list.submit')}</PrimaryButton>
            </div>
          </form>
        </Dialog>
      ) : null}
    </div>
  )
}
