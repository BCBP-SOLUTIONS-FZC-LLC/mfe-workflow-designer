import { useHasPermission, useReadOnly } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'

/**
 * Who may change a workflow. The shell grants `update:tender` to tender_admin and tenant_admin
 * (web-shell permissions.ts). Members with only `read:tender` can open the studio. A read-only
 * tenant gets no writes. These are UI hints; a workflow API would authorise the request itself.
 */
export function useWorkflowAccess(): { canWrite: boolean } {
  const canUpdate = useHasPermission('update', 'tender')
  const readOnly = useReadOnly()
  return { canWrite: canUpdate && !readOnly }
}
