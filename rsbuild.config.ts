// Two builds in one: `remote` is the Module Federation remote the shell loads (`workflows`,
// remoteEntry.js, exposing ./App), where React, the OTel API and the platform SDK come from the shell
// as strict singletons and the SDK is never bundled (import: false). `standalone` is the page served
// at / (http://localhost:5005 in dev, / in the image): no Module Federation, the SDK bundled, and with
// no shell around it every SDK API answers with its anonymous defaults. Both write to dist/; their
// file names never collide. bpmn-js stays in this remote.
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginPlatform } from '@bcbp-solutions-fzc-llc/webpack-preset/rsbuild'
import { readFileSync } from 'node:fs'

const assets = { js: 'assets', css: 'assets', font: 'assets', image: 'assets', svg: 'assets', media: 'assets', wasm: 'assets', assets: 'assets' }

const RUNTIME_LOCAL = new URL('./config/runtime.local.json', import.meta.url)

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
        if (req.method !== 'GET' || req.url?.split('?')[0] !== '/config/runtime.json') return next()
        res.setHeader('content-type', 'application/json')
        res.setHeader('cache-control', 'no-cache')
        res.end(readFileSync(RUNTIME_LOCAL))
      })
    },
  },
  dev: { hmr: false, liveReload: false },
})
