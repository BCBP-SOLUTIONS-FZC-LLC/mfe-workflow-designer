import type { ReactNode } from 'react'

const fieldClass =
  'w-full rounded-md border border-aura-border bg-aura-input px-3 py-2 text-sm text-aura-text outline-none focus:border-aura-secondary/50 focus:ring-2 focus:ring-aura-secondary/15'

export function PageHeader({
  title,
  section,
  subtitle,
  actions,
}: {
  title: string
  section?: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="m-0 flex flex-wrap items-baseline text-xl font-semibold text-aura-text">
          <span>{title}</span>
          {section ? (
            <>
              <span className="mx-1.5 text-xs font-normal text-aura-muted" aria-hidden>
                &gt;
              </span>
              <span className="text-sm font-medium text-aura-muted">{section}</span>
            </>
          ) : null}
        </h1>
        {subtitle ? <p className="mt-1 max-w-3xl text-sm text-aura-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Panel({ title, children, actions, className = '' }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-aura-border bg-aura-surface p-4 shadow-sm ${className}`}>
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="m-0 text-sm font-semibold text-aura-text">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  )
}

const tones = {
  neutral: 'border-aura-border bg-aura-hover text-aura-muted',
  pink: 'border-pink-200 bg-pink-50 text-pink-700',
  green: 'border-green-200 bg-green-50 text-green-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  red: 'border-red-200 bg-red-50 text-red-700',
  blue: 'border-sky-200 bg-sky-50 text-sky-800',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof tones }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-aura-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-aura-border bg-aura-surface px-3 py-2 text-sm font-medium text-aura-text hover:bg-aura-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-aura-text">{label}</span>
      <input className={fieldClass} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-aura-text">{label}</span>
      <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-xl border border-aura-border bg-aura-surface p-4 shadow-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="m-0 text-base font-semibold text-aura-text">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}

export function statusTone(status: string): keyof typeof tones {
  if (status === 'published') return 'green'
  if (status === 'archived') return 'neutral'
  if (status === 'invalid') return 'red'
  if (status === 'valid') return 'green'
  if (status === 'draft') return 'amber'
  return 'blue'
}
