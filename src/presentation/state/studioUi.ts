import { create } from 'zustand'
import type { NodeConfig } from '../../application/queries/query'

type ListUi = {
  status: string
  draft: string
  validity: string
  localSearch: string
  seenSearch: string
  menuOpen: boolean
  blankOpen: boolean
  name: string
  key: string
  stageBinding: string
  syncSearch: (search: string) => void
  setLocalSearch: (localSearch: string) => void
  setStatus: (status: string) => void
  setDraft: (draft: string) => void
  setValidity: (validity: string) => void
  setMenuOpen: (menuOpen: boolean) => void
  setBlankOpen: (blankOpen: boolean) => void
  setName: (name: string) => void
  setKey: (key: string) => void
  setStageBinding: (stageBinding: string) => void
}

const listDefaults = {
  status: 'all',
  draft: 'all',
  validity: 'all',
  localSearch: '',
  seenSearch: '',
  menuOpen: false,
  blankOpen: false,
  name: 'Untitled workflow',
  key: 'untitled-workflow',
  stageBinding: 'Tender / Intake',
}

export const useListUi = create<ListUi>((set) => ({
  ...listDefaults,
  syncSearch: (search) =>
    set((ui) => (ui.seenSearch === search ? ui : { seenSearch: search, localSearch: search })),
  setLocalSearch: (localSearch) => set({ localSearch }),
  setStatus: (status) => set({ status }),
  setDraft: (draft) => set({ draft }),
  setValidity: (validity) => set({ validity }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  setBlankOpen: (blankOpen) => set({ blankOpen }),
  setName: (name) => set({ name }),
  setKey: (key) => set({ key }),
  setStageBinding: (stageBinding) => set({ stageBinding }),
}))

type ShellUi = {
  search: string
  setSearch: (search: string) => void
  themePickerOpen: boolean
  setThemePickerOpen: (themePickerOpen: boolean) => void
}

export const useShellUi = create<ShellUi>((set) => ({
  search: '',
  setSearch: (search) => set({ search }),
  themePickerOpen: false,
  setThemePickerOpen: (themePickerOpen) => set({ themePickerOpen }),
}))

type GalleryUi = {
  previewId: string | null
  setPreviewId: (previewId: string) => void
  openModuleId: string
  setOpenModuleId: (openModuleId: string) => void
}

export const useGalleryUi = create<GalleryUi>((set) => ({
  previewId: null,
  setPreviewId: (previewId) => set({ previewId }),
  openModuleId: '',
  setOpenModuleId: (openModuleId) => set({ openModuleId }),
}))

export function resetStudioUi(): void {
  useListUi.setState(listDefaults)
  useShellUi.setState({ search: '', themePickerOpen: false })
  useGalleryUi.setState({ previewId: null, openModuleId: '' })
  useEditorUi.setState(editorDefaults)
  useDiffUi.setState(diffDefaults)
}

type EditorDraft = {
  seenId: string
  seenGeneration: number
  xml: string
  nodes: NodeConfig[]
  selectedId: string | null
  saveLabel: 'editor.saved' | 'editor.autosaved'
  baseline: string
}

type EditorUi = EditorDraft & {
  replaceDraft: (draft: EditorDraft) => void
}

const editorDefaults: EditorDraft = {
  seenId: '',
  seenGeneration: 0,
  xml: '',
  nodes: [],
  selectedId: null,
  saveLabel: 'editor.saved',
  baseline: '',
}

export const useEditorUi = create<EditorUi>((set) => ({
  ...editorDefaults,
  replaceDraft: (draft) => set(draft),
}))

type DiffUi = {
  workflowId: string
  leftId: string
  rightId: string
  select: (workflowId: string, leftId: string, rightId: string) => void
}

const diffDefaults = { workflowId: '', leftId: '', rightId: '' }

export const useDiffUi = create<DiffUi>((set) => ({
  ...diffDefaults,
  select: (workflowId, leftId, rightId) => set({ workflowId, leftId, rightId }),
}))
