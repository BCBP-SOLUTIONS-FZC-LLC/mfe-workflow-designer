import { t } from '@bcbp-solutions-fzc-llc/frontend-sdk/i18n'
import { APP_ID } from './constants/app'

/** A catalog message for code that is not a component. `useT` is the same lookup inside a screen. */
export function msg(key: string, vars?: Record<string, string | number>): string {
  return t(APP_ID, key, vars)
}
