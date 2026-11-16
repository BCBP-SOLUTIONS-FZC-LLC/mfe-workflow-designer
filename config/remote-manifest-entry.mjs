import { readFileSync, writeFileSync } from 'node:fs'
import { DOMAINS } from '@bcbp-solutions-fzc-llc/frontend-sdk/core'
import { integrityOf } from '@bcbp-solutions-fzc-llc/webpack-preset'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const version = (process.env.BUILD_VERSION || pkg.version).replace(/^v/, '')
const entry = readFileSync(new URL('../dist/remoteEntry.js', import.meta.url))

const ownerDomain = 'portal'
if (!DOMAINS.includes(ownerDomain)) throw new Error(`ownerDomain "${ownerDomain}" is not one of ${DOMAINS.join(', ')}`)

const manifestEntry = {
  workflows: { entry: 'remoteEntry.js', version, ownerDomain, integrity: integrityOf(entry) },
}
writeFileSync(new URL('../dist/remote-manifest-entry.json', import.meta.url), `${JSON.stringify(manifestEntry, null, 2)}\n`)
console.log(`remote-manifest-entry.json: workflows ${version} ${manifestEntry.workflows.integrity}`)
