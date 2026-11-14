import { pluginReact } from '@rsbuild/plugin-react'
import { defineConfig } from '@rstest/core'

export default defineConfig({
  plugins: [pluginReact()],
  testEnvironment: {
    name: 'happy-dom',
    options: { url: 'http://localhost:5005/' },
  },
  setupFiles: ['./test/setup.ts'],
  include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  coverage: {
    provider: 'v8',
    reporters: ['text', 'json-summary'],
    reportsDirectory: 'coverage',
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['src/**/*.d.ts', 'src/**/*.css', 'src/presentation/features/editor/allowedPalette.ts', 'src/presentation/features/editor/BpmnCanvas.tsx'],
  },
})
