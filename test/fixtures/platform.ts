import { createTestPlatform } from '@bcbp-solutions-fzc-llc/frontend-sdk/testing'
import { registerMessages } from '../../src/app/configuration/i18n'

const STUDIO_GRANTS = ['read:tender', 'update:tender'] as const

/** A fresh SDK runtime with this remote's identity, the English catalog, and the grants passed in. */
export function startPlatform(permissions: readonly (`${string}:${string}`)[] = STUDIO_GRANTS) {
  const platform = createTestPlatform({
    identity: { serviceName: 'mfe-workflow-designer', domain: 'portal', environment: 'test', buildVersion: '0.0.0-test' },
    permissions,
  })
  registerMessages()
  return platform
}
