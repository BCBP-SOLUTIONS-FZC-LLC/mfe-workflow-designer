import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { getLogger } from '@bcbp-solutions-fzc-llc/frontend-sdk/logging'
import { msg } from '../../../shared/copy'
import { APP_ID } from '../../../shared/constants/app'
import { allowedPaletteModule } from './allowedPalette'
import { visibleElements } from '../../../application/queries/diagramView'
import type { PaletteId } from '../../../application/use-cases/editDiagram'

export type BpmnCanvasHandle = {
  append: (item: PaletteId) => boolean
  addLane: () => boolean
  rename: (id: string, name: string) => boolean
}

type BpmnCanvasProps = {
  xml: string
  issues: { elementId: string; message: string }[]
  reloadKey: number
  onSelect: (element: { id: string; type: string } | null) => void
  onXml: (xml: string) => void
}

type Shape = {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  businessObject: { name?: string; eventDefinitions?: unknown[] }
}

type ModelerLike = {
  importXML: (xml: string) => Promise<unknown>
  saveXML: (options?: { format?: boolean }) => Promise<{ xml?: string }>
  get: (name: string) => unknown
  on: (event: string, callback: (event: unknown) => void) => void
  destroy: () => void
}

export const BpmnCanvas = forwardRef<BpmnCanvasHandle, BpmnCanvasProps>(function BpmnCanvas(
  { xml, issues, reloadKey, onSelect, onXml },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const modelerRef = useRef<ModelerLike | null>(null)
  const [live, setLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onSelectRef = useRef(onSelect)
  const onXmlRef = useRef(onXml)
  onSelectRef.current = onSelect
  onXmlRef.current = onXml

  useImperativeHandle(ref, () => ({
    append: (item) => appendElement(modelerRef.current, item),
    addLane: () => addDepartmentLane(modelerRef.current),
    rename: (id, name) => renameShape(modelerRef.current, id, name),
  }))

  useEffect(() => {
    if (import.meta.env.RSTEST === 'true') return
    const container = containerRef.current
    if (!container) return
    let disposed = false
    let importing = true
    const mount = async () => {
      let imported: typeof import('bpmn-js/lib/Modeler')
      try {
        await import('bpmn-js/dist/assets/diagram-js.css')
        await import('bpmn-js/dist/assets/bpmn-font/css/bpmn.css')
        await import('bpmn-js/dist/assets/bpmn-js.css')
        imported = await import('bpmn-js/lib/Modeler')
      } catch (cause) {
        getLogger({ mfe: APP_ID }).warn('diagram could not be opened', { error: cause })
        if (!disposed) setError(cause instanceof Error ? cause.message : msg('editor.diagramFailed'))
        return
      }
      if (disposed) return
      const Modeler = imported.default as new (options: {
        container: HTMLElement
        additionalModules?: unknown[]
      }) => ModelerLike
      const modeler = new Modeler({ container, additionalModules: [allowedPaletteModule] })
      modelerRef.current = modeler
      modeler.on('selection.changed', (event) => {
        const selection = (event as { newSelection?: Shape[] }).newSelection?.[0]
        onSelectRef.current(selection ? { id: selection.id, type: selection.type } : null)
      })
      modeler.on('commandStack.changed', () => {
        if (importing) return
        void modeler.saveXML({ format: true }).then((result) => {
          if (result.xml) onXmlRef.current(result.xml)
        })
      })
      try {
        await modeler.importXML(xml)
        const canvas = modeler.get('canvas') as { zoom: (mode: string) => void }
        canvas.zoom('fit-viewport')
        if (!disposed) {
          setError(null)
          setLive(true)
        }
      } catch (cause) {
        getLogger({ mfe: APP_ID }).warn('diagram could not be imported', { error: cause })
        if (!disposed) setError(cause instanceof Error ? cause.message : msg('editor.diagramFailed'))
      } finally {
        importing = false
      }
    }
    void mount()
    return () => {
      disposed = true
      modelerRef.current?.destroy()
      modelerRef.current = null
      setLive(false)
    }
    // Reload when the server record replaces the diagram. Editing streams back through onXml.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])

  useEffect(() => {
    const modeler = modelerRef.current
    if (!modeler || !live) return
    const overlays = modeler.get('overlays') as {
      remove: (filter: { type: string }) => void
      add: (id: string, type: string, overlay: { position: { top: number; right: number }; html: HTMLElement }) => void
    }
    try {
      overlays.remove({ type: 'validation' })
      for (const issue of issues) {
        if (issue.elementId === 'process') continue
        const pin = document.createElement('div')
        pin.className = 'wf-pin'
        pin.title = issue.message
        pin.textContent = '!'
        overlays.add(issue.elementId, 'validation', { position: { top: -12, right: -8 }, html: pin })
      }
    } catch {
      // The shape may not be on the canvas yet.
    }
  }, [issues, live])

  const elements = visibleElements(xml)

  return (
    <div className="relative h-[640px] overflow-hidden rounded-xl border border-aura-border bg-aura-surface">
      <div ref={containerRef} className="wf-canvas absolute inset-0" />
      {live ? null : (
        <div className="absolute inset-0 overflow-auto bg-aura-surface p-4">
          <p className="mt-0 text-xs font-semibold uppercase tracking-wide text-aura-muted">Diagram</p>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            {elements.map((element) => {
              const issue = issues.find((item) => item.elementId === element.id)
              return (
                <button
                  key={element.id}
                  type="button"
                  aria-label={element.name || element.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-aura-border px-3 py-2 text-left text-sm"
                  onClick={() => onSelect({ id: element.id, type: element.tag })}
                >
                  <span>{element.name || element.id}</span>
                  {issue ? (
                    <span className="wf-pin" title={issue.message} aria-hidden="true">
                      !
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})

function registry(modeler: ModelerLike) {
  return modeler.get('elementRegistry') as { get: (id: string) => Shape | undefined; filter: (predicate: (element: Shape) => boolean) => Shape[] }
}

function modeling(modeler: ModelerLike) {
  return modeler.get('modeling') as {
    appendShape: (source: Shape, shape: Shape) => void
    createShape: (shape: Shape, position: { x: number; y: number }, target: Shape, hints?: { attach?: boolean }) => void
    updateProperties: (element: Shape, properties: { name: string }) => void
    addLane: (lane: Shape, position: 'bottom') => void
  }
}

function appendElement(modeler: ModelerLike | null, item: PaletteId): boolean {
  if (!modeler || item === 'lane') return false
  const type = bpmnTypeFor(item)
  if (!type) return false
  try {
    const elements = registry(modeler)
    const factory = modeler.get('elementFactory') as { createShape: (options: { type: string }) => Shape }
    const bpmnFactory = modeler.get('bpmnFactory') as { create: (type: string) => unknown }
    const selected = (modeler.get('selection') as { get: () => Shape[] }).get()[0]
    const shape = factory.createShape({ type })
    if (item === 'message-boundary' || item === 'error-boundary') {
      const host =
        selected && /Task|Activity|SubProcess/.test(selected.type)
          ? selected
          : elements.filter((element) => element.type === 'bpmn:UserTask')[0]
      if (!host) return false
      const definition = item === 'message-boundary' ? 'bpmn:MessageEventDefinition' : 'bpmn:ErrorEventDefinition'
      shape.businessObject.eventDefinitions = [bpmnFactory.create(definition)]
      modeling(modeler).createShape(shape, { x: host.x + host.width, y: host.y + host.height }, host, { attach: true })
      return true
    }
    const source =
      selected && !/Process|Participant|Lane/.test(selected.type)
        ? selected
        : elements.filter((element) => element.type === 'bpmn:StartEvent')[0]
    if (!source) return false
    modeling(modeler).appendShape(source, shape)
    return true
  } catch {
    return false
  }
}

function addDepartmentLane(modeler: ModelerLike | null): boolean {
  if (!modeler) return false
  try {
    const lane = registry(modeler).filter((element) => element.type === 'bpmn:Lane')[0]
    if (!lane) return false
    modeling(modeler).addLane(lane, 'bottom')
    return true
  } catch {
    return false
  }
}

function renameShape(modeler: ModelerLike | null, id: string, name: string): boolean {
  if (!modeler) return false
  try {
    const element = registry(modeler).get(id)
    if (!element) return false
    modeling(modeler).updateProperties(element, { name })
    return true
  } catch {
    return false
  }
}

function bpmnTypeFor(item: PaletteId): string | null {
  const types: Partial<Record<PaletteId, string>> = {
    user: 'bpmn:UserTask',
    send: 'bpmn:SendTask',
    receive: 'bpmn:ReceiveTask',
    connector: 'bpmn:ServiceTask',
    subprocess: 'bpmn:SubProcess',
    call: 'bpmn:CallActivity',
    'message-boundary': 'bpmn:BoundaryEvent',
    'error-boundary': 'bpmn:BoundaryEvent',
  }
  return types[item] ?? null
}
