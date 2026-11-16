import type { AppState } from '../entities/types'

/**
 * Catalogue port for this bounded context. The application asks the port to load and save.
 * Infrastructure implements it. Connector secrets are not part of the stored document.
 */
export type StudioRepository = {
  load(): AppState
  save(state: AppState): void
}
