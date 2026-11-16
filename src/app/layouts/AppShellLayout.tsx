import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { MFEErrorBoundary, useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { useWorkflowAccess } from '../providers/useWorkflowAccess'
import { APP_ID } from '../../shared/constants/app'
import { BrandLogo } from '../../presentation/components/BrandLogo'
import { ThemePicker } from '../../presentation/components/ThemePicker'
import { useShellUi } from '../../presentation/state/studioUi'
import { useWorkflows } from '../providers/WorkflowProvider'
import type { AppThemeId } from '../../presentation/theme/daisyThemes'
import {
  dashHeaderClass,
  dashShellClass,
  dashSidebarClass,
  dashSurfaceClass,
  logoThemeFromAppTheme,
  readStoredAppTheme,
  saveAppTheme,
  showAppTheme,
} from '../../presentation/theme/themeMode'
import { workflowBase } from '../../application/queries/query'
import { goToSignIn } from '../../infrastructure/auth/signIn'
import type { AppShellOutletContext } from './appShellContext'

function linkClass({ isActive }: { isActive: boolean }) {
  return `block rounded-lg px-3 py-2 text-sm font-medium no-underline ${
    isActive ? 'bg-aura-primary-soft text-aura-primary' : 'text-aura-muted hover:bg-aura-hover hover:text-aura-text'
  }`
}

export default function AppShellLayout({
  userLabel: userLabelProp,
  onLogout = goToSignIn,
}: {
  userLabel?: string
  onLogout?: () => void
}) {
  const t = useT(APP_ID)
  const { canWrite } = useWorkflowAccess()
  const userLabel = userLabelProp || t('user.default')
  const location = useLocation()
  const base = workflowBase(location.pathname)
  const { notice, dismissNotice } = useWorkflows()
  const search = useShellUi((ui) => ui.search)
  const setSearch = useShellUi((ui) => ui.setSearch)
  const themePickerOpen = useShellUi((ui) => ui.themePickerOpen)
  const setThemePickerOpen = useShellUi((ui) => ui.setThemePickerOpen)
  const [appTheme, setAppTheme] = useState<AppThemeId>(() => readStoredAppTheme())
  const outlet: AppShellOutletContext = { search, userLabel, readOnly: !canWrite }

  useEffect(() => {
    showAppTheme(appTheme)
  }, [appTheme])

  return (
    <div className={`flex min-h-dvh ${dashShellClass}`}>
      <aside className={`flex w-60 shrink-0 flex-col px-3 py-4 ${dashSidebarClass}`}>
        <div className="mb-6 px-2">
          <BrandLogo variant="main" theme={logoThemeFromAppTheme(appTheme)} />
        </div>
        <p className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-aura-muted">{t('nav.label')}</p>
        <nav className="flex flex-col gap-1" aria-label={t('nav.label')}>
          <NavLink to={base} end className={linkClass}>
            {t('nav.workflows')}
          </NavLink>
          <NavLink to={`${base}/modules`} className={linkClass}>
            {t('nav.modules')}
          </NavLink>
          <NavLink to={`${base}/starters`} className={linkClass}>
            {t('nav.starters')}
          </NavLink>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className={`flex items-center gap-3 px-4 py-3 ${dashHeaderClass}`}>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t('search.label')}</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('search.placeholder')}
              className="w-full max-w-md rounded-lg border border-aura-border bg-aura-input px-3 py-2 text-sm text-aura-text outline-none"
            />
          </label>
          <ThemePicker
            activeThemeId={appTheme}
            open={themePickerOpen}
            onOpenChange={setThemePickerOpen}
            onSelect={(themeId) => {
              setAppTheme(themeId)
              saveAppTheme(themeId)
            }}
          />
          <span className="text-sm text-aura-muted">{userLabel}</span>
          <button type="button" onClick={onLogout} className="rounded-lg px-3 py-2 text-sm font-medium text-aura-text hover:bg-aura-hover">
            {t('nav.logout')}
          </button>
        </header>
        {notice ? (
          <div className={`flex items-center justify-between gap-3 border-b border-aura-border px-4 py-2 text-sm ${dashSurfaceClass}`} role="status">
            <span>{t(notice.key, notice.vars)}</span>
            <button type="button" onClick={dismissNotice} className="text-aura-muted hover:text-aura-text">
              {t('nav.dismiss')}
            </button>
          </div>
        ) : null}
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <MFEErrorBoundary mfe={APP_ID} resetKeys={[location.pathname]}>
            <Outlet context={outlet} />
          </MFEErrorBoundary>
        </main>
      </div>
    </div>
  )
}
