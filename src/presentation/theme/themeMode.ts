import { storage } from '@bcbp-solutions-fzc-llc/frontend-sdk/storage'
import { APP_ID } from '../../shared/constants/app'
import {
  type AppThemeId,
  type AuraThemeMode,
  auraModeFromAppTheme,
  isAuraTheme,
} from './daisyThemes'

export type ThemeMode = AuraThemeMode

const THEME_MODE_KEY = 'themeMode'
const APP_THEME_KEY = 'appTheme'

export function readStoredAppTheme(): AppThemeId {
  return storage(APP_ID).get<AppThemeId>(APP_THEME_KEY) ?? readStoredThemeMode()
}

export function readStoredThemeMode(): ThemeMode {
  return storage(APP_ID).get<ThemeMode>(THEME_MODE_KEY) === 'dark' ? 'dark' : 'light'
}

/** Shows `themeId` on the page without storing it. */
export function showAppTheme(themeId: AppThemeId): void {
  document.documentElement.dataset.theme = themeId
}

/** Stores the user's choice (the SDK ignores writes while nobody is signed in) and shows it. */
export function saveAppTheme(themeId: AppThemeId): void {
  showAppTheme(themeId)
  const store = storage(APP_ID)
  store.set(APP_THEME_KEY, themeId)
  if (isAuraTheme(themeId)) {
    store.set(THEME_MODE_KEY, themeId)
  }
}

export function applyThemeMode(mode: ThemeMode): void {
  saveAppTheme(mode)
}

export function toggleThemeMode(current: ThemeMode): ThemeMode {
  return current === 'light' ? 'dark' : 'light'
}

export function logoThemeFromAppTheme(themeId: AppThemeId): ThemeMode {
  return auraModeFromAppTheme(themeId)
}

export const dashShellClass = 'bg-aura-canvas text-aura-text'

export const dashSurfaceClass = 'bg-aura-surface'

export const dashBorderClass = 'border-aura-border'

export const dashSidebarClass = 'bg-aura-surface border-r border-aura-border'

export const dashHeaderClass =
  'bg-aura-surface border-b border-aura-border shadow-dash'
