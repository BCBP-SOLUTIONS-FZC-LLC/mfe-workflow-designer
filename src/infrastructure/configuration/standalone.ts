import { initializeCore } from '@bcbp-solutions-fzc-llc/frontend-sdk/core'
import { loadRuntimeConfig, setRuntimeConfig, tryGetConfig, type RuntimeConfig } from '@bcbp-solutions-fzc-llc/frontend-sdk/config'
import { roleMapAuthorizer, setAuthorizer, setAuthzSubject } from '@bcbp-solutions-fzc-llc/frontend-sdk/authz'
import { getLogger } from '@bcbp-solutions-fzc-llc/frontend-sdk/logging'
import { APP_ID } from '../../shared/constants/app'

/** local on the dev server, prod in a build, when /config/runtime.json does not name an environment. */
export const FALLBACK_ENVIRONMENT = import.meta.env.DEV ? 'local' : 'prod'

export function standaloneIdentity(environment: string) {
  return { serviceName: 'mfe-workflow-designer', domain: 'portal', environment, buildVersion: import.meta.env.BUILD_VERSION }
}

export const RUNTIME_CONFIG_TIMEOUT_MS = 5000

/** Standalone page only. Inside the shell this never runs: the shell owns identity and config. */
export async function startStandalone(): Promise<void> {
  let config: RuntimeConfig | undefined = tryGetConfig()
  let failure: unknown
  if (!config) {
    try {
      config = await loadRuntimeConfig({ timeoutMs: RUNTIME_CONFIG_TIMEOUT_MS })
    } catch (error) {
      failure = error
    }
  }
  try {
    initializeCore(standaloneIdentity(config?.environment ?? FALLBACK_ENVIRONMENT))
    if (config && !tryGetConfig()) setRuntimeConfig(config)
    if ((config?.environment ?? FALLBACK_ENVIRONMENT) === 'local') {
      setAuthorizer(roleMapAuthorizer({ studio: ['read:tender', 'update:tender'] }))
      setAuthzSubject({ roles: ['studio'] })
    }
  } catch (error) {
    failure = error
  }
  if (failure !== undefined) {
    getLogger({ mfe: APP_ID }).warn('runtime config unavailable; logout returns to the page root', { error: failure })
  }
}
