import { registerNamespace } from '@bcbp-solutions-fzc-llc/frontend-sdk/i18n'
import { APP_ID } from '../../shared/constants/app'
import en from './locales/en.json'

export function registerMessages(): void {
  registerNamespace(APP_ID, async (locale) => (locale.split('-')[0] === 'en' ? en : {}))
}

registerMessages()
