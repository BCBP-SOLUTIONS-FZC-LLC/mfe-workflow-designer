import { tryGetConfig } from '@bcbp-solutions-fzc-llc/frontend-sdk/config'

/** The sign-in page from the runtime config, without a trailing slash; '/' when there is none. */
export function signInUrl(): string {
  return tryGetConfig()?.auth.signInUrl?.replace(/\/$/, '') || '/'
}

/** Leaves for the sign-in page (a full navigation: it is another application). */
export function goToSignIn(): void {
  window.location.assign(signInUrl())
}
