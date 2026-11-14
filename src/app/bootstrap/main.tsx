import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/inter'
import { MFEErrorBoundary } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import App from '../routes/App'
import { APP_ID } from '../../shared/constants/app'
import { startStandalone } from '../../infrastructure/configuration/standalone'
import { readStoredAppTheme, showAppTheme } from '../../presentation/theme/themeMode'

showAppTheme(readStoredAppTheme())

const root = document.getElementById('app')
if (!root) {
  throw new Error('Root element #app not found')
}

void startStandalone().then(() =>
  createRoot(root).render(
    <StrictMode>
      <MFEErrorBoundary mfe={APP_ID}>
        <App />
      </MFEErrorBoundary>
    </StrictMode>,
  ),
)
