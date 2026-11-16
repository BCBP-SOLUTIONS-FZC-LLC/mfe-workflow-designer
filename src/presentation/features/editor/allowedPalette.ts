import { PALETTE_ITEMS, bpmnTypeForPalette, type PaletteId } from '../../../application/use-cases/editDiagram'

type PaletteApi = { registerProvider: (provider: unknown) => void }
type CreateApi = { start: (event: unknown, shape: unknown) => void }
type Shape = { businessObject: { eventDefinitions?: unknown[] } }
type ElementFactory = { createShape: (options: { type: string }) => Shape }
type BpmnFactory = { create: (type: string) => unknown }

class AllowedPaletteProvider {
  static $inject = ['palette', 'create', 'elementFactory', 'bpmnFactory']
  private readonly create: CreateApi
  private readonly elementFactory: ElementFactory
  private readonly bpmnFactory: BpmnFactory

  constructor(palette: PaletteApi, create: CreateApi, elementFactory: ElementFactory, bpmnFactory: BpmnFactory) {
    this.create = create
    this.elementFactory = elementFactory
    this.bpmnFactory = bpmnFactory
    palette.registerProvider(this)
  }

  getPaletteEntries() {
    const start = (type: string, define?: (shape: Shape) => void) => (event: unknown) => {
      const shape = this.elementFactory.createShape({ type })
      define?.(shape)
      this.create.start(event, shape)
    }
    const entries: Record<string, unknown> = {
      'create.start-event': entry('Start event', 'bpmn-icon-start-event-none', start('bpmn:StartEvent')),
      'create.end-event': entry('End event', 'bpmn-icon-end-event-none', start('bpmn:EndEvent')),
    }
    for (const item of PALETTE_ITEMS) {
      if (item.id === 'lane') continue
      const type = bpmnTypeForPalette(item.id)
      if (!type) continue
      entries[`create.${item.id}`] = entry(item.label, iconFor(item.id), start(type, (shape) => defineBoundary(shape, item.id, this.bpmnFactory)))
    }
    return entries
  }
}

function defineBoundary(shape: Shape, item: PaletteId, factory: BpmnFactory) {
  if (item === 'message-boundary') shape.businessObject.eventDefinitions = [factory.create('bpmn:MessageEventDefinition')]
  if (item === 'error-boundary') shape.businessObject.eventDefinitions = [factory.create('bpmn:ErrorEventDefinition')]
}

function iconFor(item: PaletteId): string {
  const icons: Partial<Record<PaletteId, string>> = {
    user: 'bpmn-icon-user-task',
    send: 'bpmn-icon-send-task',
    receive: 'bpmn-icon-receive-task',
    connector: 'bpmn-icon-service-task',
    subprocess: 'bpmn-icon-subprocess-collapsed',
    call: 'bpmn-icon-call-activity',
    'message-boundary': 'bpmn-icon-intermediate-event-catch-message',
    'error-boundary': 'bpmn-icon-intermediate-event-catch-error',
  }
  return icons[item] ?? 'bpmn-icon-task'
}

function entry(title: string, className: string, action: (event: unknown) => void) {
  return {
    group: 'activity',
    className,
    title,
    action: { dragstart: action, click: action },
  }
}

export const allowedPaletteModule = {
  __init__: ['paletteProvider'],
  paletteProvider: ['type', AllowedPaletteProvider],
}
