// Two builds in one: `remote` is the Module Federation remote the shell loads (`workflows`,
// remoteEntry.js, exposing ./App), where React, the OTel API and the platform SDK come from the shell
// as strict singletons and the SDK is never bundled (import: false). `standalone` is the page served
// at / (http://localhost:5005 in dev, / in the image): no Module Federation, the SDK bundled, and with
// no shell around it every SDK API answers with its anonymous defaults. Both write to dist/; their
// file names never collide. bpmn-js stays in this remote.
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginPlatform } from '@bcbp-solutions-fzc-llc/webpack-preset/rsbuild'
import { existsSync, readFileSync } from 'node:fs'
import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http'

const assets = { js: 'assets', css: 'assets', font: 'assets', image: 'assets', svg: 'assets', media: 'assets', wasm: 'assets', assets: 'assets' }

const RUNTIME_LOCAL = new URL('./config/runtime.local.json', import.meta.url)

type DefinitionIdentity = { tenantId: string; userId: string; roles: string; plan: string }

function definitionIdentity(): DefinitionIdentity {
  const fallback: DefinitionIdentity = {
    tenantId: '7ca648b2-b432-4744-884c-35fd556a310c',
    userId: '4da18bde-7244-47ac-986c-665cd42caaaa',
    roles: 'tenant_admin',
    plan: 'pro',
  }
  const local = new URL('./config/definition.local.json', import.meta.url)
  const file = existsSync(local) ? local : new URL('./config/definition.example.json', import.meta.url)
  try {
    return { ...fallback, ...JSON.parse(readFileSync(file, 'utf8')) }
  } catch {
    return fallback
  }
}

function proxyDefinition(req: IncomingMessage, res: ServerResponse) {
  const identity = definitionIdentity()
  const headers = {
    ...req.headers,
    'x-tenant-id': identity.tenantId,
    'x-user-id': identity.userId,
    'x-tenant-roles': identity.roles,
    'x-plan': identity.plan,
  }
  delete headers.host
  const upstream = httpRequest(
    {
      hostname: '127.0.0.1',
      port: Number(process.env.DEFINITION_PORT || 8080),
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )
  upstream.on('error', () => {
    if (res.headersSent) return
    res.statusCode = 502
    res.setHeader('content-type', 'application/problem+json')
    res.end(JSON.stringify({ status: 502, code: 'UPSTREAM_UNAVAILABLE', title: 'Bad Gateway', detail: 'The definition service is not reachable.' }))
  })
  req.pipe(upstream)
}

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    define: {
      'import.meta.env.BUILD_VERSION': JSON.stringify(process.env.BUILD_VERSION || process.env.npm_package_version || ''),
      'import.meta.env.RSTEST': 'false',
    },
  },
  output: {
    distPath: assets,
    cleanDistPath: false,
    sourceMap: { css: false },
    inlineScripts: false,
    inlineStyles: false,
  },
  tools: { cssLoader: { url: { filter: (url: string) => !url.startsWith('/') } } },
  environments: {
    remote: {
      plugins: [pluginPlatform({ role: 'remote', name: 'workflows', exposes: { './App': './src/App.tsx' } })],
      source: { entry: { remote: './src/app/bootstrap/remote.ts' } },
      splitChunks: { preset: 'none', chunks: 'async' },
      tools: { htmlPlugin: false },
      server: { publicDir: false },
    },
    standalone: {
      source: { entry: { index: './src/app/bootstrap/main.tsx' } },
      html: { template: './index.html' },
      output: { assetPrefix: '/' },
    },
  },
  server: {
    port: 5005,
    strictPort: true,
    host: 'localhost',
    cors: { origin: '*' },
    setup: ({ server }) => {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        if (url.startsWith('/api/v1')) {
          proxyDefinition(req, res)
          return
        }
        if (req.method !== 'GET' || url.split('?')[0] !== '/config/runtime.json') return next()
        res.setHeader('content-type', 'application/json')
        res.setHeader('cache-control', 'no-cache')
        res.end(readFileSync(RUNTIME_LOCAL))
      })
    },
  },
  dev: { hmr: false, liveReload: false },
})
