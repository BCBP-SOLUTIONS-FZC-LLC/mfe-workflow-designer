import { useCallback } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useInRouterContext } from 'react-router-dom'
import { slugFromPath } from '@bcbp-solutions-fzc-llc/frontend-sdk/auth'
import { tryGetConfig } from '@bcbp-solutions-fzc-llc/frontend-sdk/config'
import { useCurrentUser, useRouteTemplate, useSignOut } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { goToSignIn } from '../../infrastructure/auth/signIn'
import AppShellLayout from '../layouts/AppShellLayout'
import EditorPage from '../../presentation/pages/EditorPage'
import ModuleLibraryPage from '../../presentation/pages/ModuleLibraryPage'
import StarterGalleryPage from '../../presentation/pages/StarterGalleryPage'
import WorkflowDetailLayout, {
  DiffTab,
  NodesTab,
  OverviewTab,
  UsageTab,
  VersionsTab,
} from '../../presentation/pages/WorkflowDetailPage'
import WorkflowListPage from '../../presentation/pages/WorkflowListPage'
import { WorkflowProvider } from '../providers/WorkflowProvider'
import '../configuration/i18n'
import '../../index.css'

export type WorkflowAppProps = {
  userLabel?: string
  onLogout?: () => void
}

/** The shell's router basename for `pathname`: '<workspacePathPrefix><slug>', or '' outside a workspace. */
export function workspaceBasename(pathname: string): string {
  const auth = tryGetConfig()?.auth
  const slug = auth && slugFromPath(pathname, auth)
  return slug ? `${auth.workspacePathPrefix}${slug}` : ''
}

function WorkflowRoutes({ userLabel, onLogout }: WorkflowAppProps) {
  useRouteTemplate('/t/:slug/workflows')
  return (
    <WorkflowProvider>
      <Routes>
        <Route element={<AppShellLayout userLabel={userLabel} onLogout={onLogout} />}>
          <Route index element={<WorkflowListPage />} />
          <Route path="modules" element={<ModuleLibraryPage />} />
          <Route path="starters" element={<StarterGalleryPage />} />
          <Route path=":workflowId" element={<WorkflowDetailLayout />}>
            <Route index element={<OverviewTab />} />
            <Route path="versions" element={<VersionsTab />} />
            <Route path="diff" element={<DiffTab />} />
            <Route path="nodes" element={<NodesTab />} />
            <Route path="usage" element={<UsageTab />} />
          </Route>
          <Route path=":workflowId/editor" element={<EditorPage />} />
          <Route path="*" element={<Navigate to=".." relative="route" replace />} />
        </Route>
      </Routes>
    </WorkflowProvider>
  )
}

export default function App(props: WorkflowAppProps) {
  const user = useCurrentUser()
  const signOut = useSignOut()
  const sdkLogout = useCallback(() => {
    signOut().catch(goToSignIn)
  }, [signOut])
  const resolved = {
    userLabel: props.userLabel ?? user?.email ?? user?.name,
    onLogout: props.onLogout ?? sdkLogout,
  }

  if (useInRouterContext()) return <WorkflowRoutes {...resolved} />

  // The shell does not share react-router. Under /t/<slug>/ this remote uses the same basename the
  // shell does, and routes at /workflows/*. With no workspace in the URL, standalone serves
  // /workflows and still accepts a full /t/<slug>/workflows path.
  const basename = workspaceBasename(window.location.pathname)
  if (basename) {
    return (
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/workflows/*" element={<WorkflowRoutes {...resolved} />} />
          <Route path="*" element={<Navigate to="/workflows" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/t/:slug/workflows/*" element={<WorkflowRoutes {...resolved} />} />
        <Route path="/workflows/*" element={<WorkflowRoutes {...resolved} />} />
        <Route path="/" element={<Navigate to="/workflows" replace />} />
        <Route path="*" element={<Navigate to="/workflows" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
