import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { APP_ID } from '../../../shared/constants/app'
import { personOptions, stageOptions } from '../../../application/queries/assignment'
import type { ModuleRecord, NodeConfig, SecureCredential } from '../../../application/queries/query'
import { SelectInput, TextInput } from '../../components/ui'

const fieldClass =
  'w-full rounded-md border border-aura-border bg-aura-input px-3 py-2 text-sm text-aura-text outline-none'

export function PropertiesPanel({
  node,
  modules,
  credential,
  onChange,
  onCredential,
}: {
  node: NodeConfig | null
  modules: ModuleRecord[]
  credential: SecureCredential | null
  onChange: (patch: Partial<NodeConfig>) => void
  onCredential: (vaultRef: string, secret: string) => void
}) {
  const t = useT(APP_ID)
  if (!node) {
    return (
      <p className="m-0 text-sm text-aura-muted">
        {t('props.empty')}
      </p>
    )
  }

  const moduleOptions = modules
    .filter((module) => module.status === 'published')
    .flatMap((module) => module.versions.map((version) => ({ module, version })))

  return (
    <div className="flex flex-col gap-3">
      <TextInput label={t('props.name')} value={node.name} onChange={(name) => onChange({ name })} />
      {node.kind !== 'boundary' ? (
        <SelectInput
          label={t('props.stage')}
          value={node.stageType}
          onChange={(stageType) => onChange({ stageType })}
          options={[{ value: '', label: t('props.noStage') }, ...stageOptions().map((stage) => ({ value: stage, label: stage }))]}
        />
      ) : null}
      {node.kind === 'user' || node.kind === 'send' || node.kind === 'receive' || node.kind === 'connector' ? (
        <SelectInput
          label={t('props.person')}
          value={node.assignee}
          onChange={(assignee) => onChange({ assignee })}
          options={[
            { value: '', label: t('props.selectPerson') },
            ...personOptions().map((person) => ({ value: person.name, label: `${person.name} · ${person.department}` })),
          ]}
        />
      ) : null}
      {node.kind !== 'boundary' && node.kind !== 'subprocess' ? (
        <div className="grid grid-cols-2 gap-2">
          <TextInput label={t('props.warn')} value={node.slaWarnHours} onChange={(slaWarnHours) => onChange({ slaWarnHours })} />
          <TextInput label={t('props.sla')} value={node.slaHours} onChange={(slaHours) => onChange({ slaHours })} />
        </div>
      ) : null}
      <TextInput label={t('props.message')} value={node.messageName} onChange={(messageName) => onChange({ messageName })} />
      <TextInput label={t('props.error')} value={node.errorCode} onChange={(errorCode) => onChange({ errorCode })} />
      {node.kind === 'call' || node.kind === 'connector' ? (
        <>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-aura-text">{t('props.module')}</span>
            <select
              className={fieldClass}
              value={`${node.moduleKey}@${node.moduleVersion}`}
              onChange={(event) => {
                const [moduleKey = '', moduleVersion = ''] = event.target.value.split('@')
                onChange({ moduleKey, moduleVersion })
              }}
            >
              <option value="@">{t('props.selectModule')}</option>
              {moduleOptions.map(({ module, version }) => (
                <option key={`${module.id}@${version.label}`} value={`${module.id}@${version.label}`}>
                  {module.name} {version.label}
                </option>
              ))}
            </select>
          </label>
          <TextInput label={t('props.input')} value={node.inputMapping} onChange={(inputMapping) => onChange({ inputMapping })} />
          <TextInput label={t('props.output')} value={node.outputMapping} onChange={(outputMapping) => onChange({ outputMapping })} />
        </>
      ) : null}
      {node.kind === 'connector' ? (
        <form
          className="rounded-lg border border-aura-border bg-aura-surface-elevated p-3"
          onSubmit={(event) => event.preventDefault()}
          autoComplete="off"
        >
          <h3 className="m-0 text-sm font-semibold">{t('props.secure')}</h3>
          <p className="text-xs text-aura-muted">
            {t('props.secureHint')}
          </p>
          <TextInput
            label={t('props.vault')}
            value={node.credentialRef}
            onChange={(vaultRef) => onCredential(vaultRef, credential?.secret ?? '')}
          />
          <label className="mt-2 block text-sm">
            <span className="mb-1 block font-medium text-aura-text">{t('props.secret')}</span>
            <input
              type="password"
              name="connector-secret"
              autoComplete="new-password"
              className={fieldClass}
              value={credential?.secret ?? ''}
              placeholder={t('props.secretPlaceholder')}
              onChange={(event) => onCredential(node.credentialRef, event.target.value)}
            />
          </label>
        </form>
      ) : null}
      {node.kind === 'connector' ? (
        <>
          <TextInput
            label={t('props.inputs')}
            value={node.connectorInputs}
            onChange={(connectorInputs) => onChange({ connectorInputs })}
          />
          <TextInput
            label={t('props.outputs')}
            value={node.connectorOutputs}
            onChange={(connectorOutputs) => onChange({ connectorOutputs })}
          />
        </>
      ) : null}
    </div>
  )
}
