import { storage } from '@bcbp-solutions-fzc-llc/frontend-sdk/storage'
import { APP_ID } from '../../shared/constants/app'
import type { StudioRepository } from '../../domain/repositories/studioRepository'
import type { AppState } from '../../domain/entities/types'
import { createInitialState } from './seed'

const KEY = 'catalogue'

type StoredStudio = Omit<AppState, 'credentials'>

function readArea(area: 'session' | 'local'): StoredStudio | undefined {
  const value = storage(APP_ID, { area }).get<StoredStudio>(KEY)
  if (!value || !Array.isArray(value.workflows) || value.workflows.length === 0) return undefined
  return value
}

/** The signed-in workspace's catalogue. Connector secrets are never read back. */
export function loadStudio(): AppState {
  const stored = readArea('session') ?? readArea('local')
  if (!stored) return createInitialState()
  return { ...stored, credentials: {}, notice: null }
}

/**
 * Writes the catalogue for this workspace. The secret map is dropped before the write: storage()
 * keeps the draft across a reload, and a credential belongs in the vault, not in the browser.
 */
export function saveStudio(state: AppState): void {
  const safe: StoredStudio = {
    workflows: state.workflows,
    modules: state.modules,
    starters: state.starters,
    seq: state.seq,
    notice: null,
    conflictWorkflowId: state.conflictWorkflowId,
    reloadGeneration: state.reloadGeneration,
  }
  storage(APP_ID, { area: 'session' }).set(KEY, safe)
  storage(APP_ID, { area: 'local' }).set(KEY, safe)
}

export const studioRepository: StudioRepository = {
  load: loadStudio,
  save: saveStudio,
}
