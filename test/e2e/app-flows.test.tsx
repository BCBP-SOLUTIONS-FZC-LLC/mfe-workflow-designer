import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, rs } from '@rstest/core'
import App from '../../src/App'
import { startPlatform } from '../fixtures/platform'

function renderAt(path: string, onLogout = rs.fn()) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/t/:slug/workflows/*" element={<App userLabel="Avery Chen" onLogout={onLogout} />} />
      </Routes>
    </MemoryRouter>,
  )
  return onLogout
}

describe('workflow studio', () => {
  it('opens the studio from the site root', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /Workflows\s+All workflows/ })).toBeInTheDocument()
  })

  it('filters, clones, archives, and creates a blank workflow', async () => {
    const onLogout = renderAt('/t/demo/workflows')
    expect(screen.getByRole('heading', { name: /Workflows\s+All workflows/ })).toBeInTheDocument()
    expect(screen.getByText('intake-triage')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'archived' } })
    expect(screen.getByText('Legacy filing')).toBeInTheDocument()
    expect(screen.queryByText('Intake triage')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } })
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'award' } })
    expect(screen.getByText('Award handover')).toBeInTheDocument()
    expect(screen.queryByText('Intake triage')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: 'Clone Intake triage' }))
    expect(screen.getByText('Cloned Intake triage.')).toBeInTheDocument()
    expect(screen.getByText('Copy of Intake triage')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Archive Contract signature' }))
    expect(screen.getByText('Archived Contract signature.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Blank workflow' }))
    fireEvent.change(screen.getByLabelText('Workflow name'), { target: { value: 'Nightly close' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create workflow' }))
    expect(screen.getByRole('heading', { name: 'Nightly close' })).toBeInTheDocument()
    expect(screen.getByText('Add at least one task before publishing.')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }))
    expect(onLogout).toHaveBeenCalled()
  })

  it('lets a member look and keeps them from creating a workflow', async () => {
    startPlatform(['read:tender'])
    await new Promise((resolve) => setTimeout(resolve, 0))
    renderAt('/t/demo/workflows')
    expect(screen.getByRole('heading', { name: /Workflows\s+All workflows/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
  })

  it('walks detail tabs, promotes a version, exports, and saves a starter', () => {
    renderAt('/t/demo/workflows/wf-intake')
    expect(screen.getByRole('heading', { name: /Intake triage/ })).toBeInTheDocument()
    expect(screen.getByText('Tender / Intake')).toBeInTheDocument()
    expect(screen.getByText('6 running instances')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Versions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Promote v1' }))
    expect(screen.getByText('Promoted v1 to the active version.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Nodes' }))
    expect(screen.getByText('Triage enquiry')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Usage' }))
    expect(screen.getByText('Tender intake')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Overview' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export BPMN' }))
    expect(screen.getByText('Exported intake-triage.bpmn. Connector secrets were not included.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save as starter' }))
    expect(screen.getByText('Saved Intake triage as a starter.')).toBeInTheDocument()
  })

  it('compares clarification versions', () => {
    renderAt('/t/demo/workflows/wf-clarification/diff')
    expect(screen.getByText('Receive client reply assignee changed from Marcus Hale to unset.')).toBeInTheDocument()
  })

  it('blocks publish until every task has a person, then publishes', () => {
    renderAt('/t/demo/workflows/wf-clarification/editor')
    expect(screen.getByText('Choose a default person for Receive client reply.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Receive client reply' }))
    fireEvent.change(screen.getByLabelText('Default person'), { target: { value: 'Marcus Hale' } })
    expect(screen.queryByText('Choose a default person for Receive client reply.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(screen.getByText('Published Clarification loop.')).toBeInTheDocument()
  })

  it('shows the concurrent editor lock', () => {
    renderAt('/t/demo/workflows/wf-signature/editor')
    expect(screen.getByText(/Amina Rahman is editing this workflow/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
  })

  it('reloads a publish conflict onto the server record', () => {
    renderAt('/t/demo/workflows/wf-award/editor')
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(screen.getByRole('alertdialog', { name: 'Publish conflict' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest record' }))
    expect(screen.getByRole('button', { name: 'Handover pack (server)' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(screen.getByText('Published Award handover.')).toBeInTheDocument()
  })

  it('keeps a connector secret out of the diagram', () => {
    renderAt('/t/demo/workflows/wf-intake/editor')
    fireEvent.click(screen.getByRole('button', { name: 'Update ERP' }))
    fireEvent.change(screen.getByLabelText('Connector secret'), { target: { value: 'vault-secret-do-not-export' } })
    expect(screen.getByText('Diagram check: no credential values in the BPMN.')).toBeInTheDocument()
    expect(screen.queryByText('vault-secret-do-not-export')).not.toBeInTheDocument()
  })

  it('publishes a module version and opens a starter in the editor', () => {
    renderAt('/t/demo/workflows/modules')
    fireEvent.click(screen.getByRole('button', { name: 'Publish Notify ERP version' }))
    expect(screen.getAllByText('2.1.1').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Archive Legal review gate' }))
    expect(screen.getByText('Archived Legal review gate.')).toBeInTheDocument()

    cleanup()
    renderAt('/t/demo/workflows/starters')
    fireEvent.click(screen.getByRole('button', { name: 'Preview Enquiry triage' }))
    expect(screen.getAllByText('Commercial').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Use Enquiry triage' }))
    expect(screen.getByRole('heading', { name: 'Enquiry triage' })).toBeInTheDocument()
    expect(screen.getByText('Opened Enquiry triage in the editor.')).toBeInTheDocument()
  })
})
