import { defaultNode, type NodeConfig, type NodeKind } from '../entities/types'

export type BpmnTag =
  | 'startEvent'
  | 'endEvent'
  | 'userTask'
  | 'sendTask'
  | 'receiveTask'
  | 'serviceTask'
  | 'callActivity'
  | 'subProcess'
  | 'boundaryEvent'
  | 'lane'
  | 'participant'

export type DiagramNode = {
  id: string
  tag: BpmnTag
  name: string
}

export type DiagramSpec = {
  id: string
  processName: string
  lanes: { id: string; name: string }[]
  nodes: { id: string; tag: BpmnTag; name: string; laneId: string }[]
  flows: { id: string; source: string; target: string }[]
  boundaries?: { id: string; name: string; attachedTo: string; event: 'message' | 'error' }[]
}

export type PaletteId =
  | 'user'
  | 'send'
  | 'receive'
  | 'connector'
  | 'subprocess'
  | 'call'
  | 'lane'
  | 'message-boundary'
  | 'error-boundary'

export const PALETTE_ITEMS: { id: PaletteId; label: string }[] = [
  { id: 'user', label: 'User task' },
  { id: 'send', label: 'Send task' },
  { id: 'receive', label: 'Receive task' },
  { id: 'connector', label: 'Connector task' },
  { id: 'subprocess', label: 'Subprocess' },
  { id: 'call', label: 'Call activity' },
  { id: 'lane', label: 'Department lane' },
  { id: 'message-boundary', label: 'Message boundary' },
  { id: 'error-boundary', label: 'Error boundary' },
]

const KIND_BY_TAG: Partial<Record<BpmnTag, NodeKind>> = {
  userTask: 'user',
  sendTask: 'send',
  receiveTask: 'receive',
  serviceTask: 'connector',
  callActivity: 'call',
  subProcess: 'subprocess',
  boundaryEvent: 'boundary',
}

const TAG_BY_PALETTE: Partial<Record<PaletteId, BpmnTag>> = {
  user: 'userTask',
  send: 'sendTask',
  receive: 'receiveTask',
  connector: 'serviceTask',
  subprocess: 'subProcess',
  call: 'callActivity',
  'message-boundary': 'boundaryEvent',
  'error-boundary': 'boundaryEvent',
}

export function kindForTag(tag: string): NodeKind | null {
  return KIND_BY_TAG[tag as BpmnTag] ?? null
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sizeFor(tag: BpmnTag): { w: number; h: number } {
  if (tag === 'startEvent' || tag === 'endEvent' || tag === 'boundaryEvent') return { w: 36, h: 36 }
  if (tag === 'subProcess') return { w: 150, h: 100 }
  return { w: 120, h: 80 }
}

export function buildDiagram(spec: DiagramSpec): string {
  const laneIndex = new Map(spec.lanes.map((lane, index) => [lane.id, index]))
  const counters = new Map<string, number>()
  const placed = spec.nodes.map((node) => {
    const order = counters.get(node.laneId) ?? 0
    counters.set(node.laneId, order + 1)
    const size = sizeFor(node.tag)
    const lane = laneIndex.get(node.laneId) ?? 0
    const x = 200 + order * 190
    const laneTop = 80 + lane * 170
    const y = laneTop + (170 - size.h) / 2
    return { ...node, ...size, x, y, lane }
  })
  const byId = new Map(placed.map((node) => [node.id, node]))
  const incoming = new Map<string, string[]>()
  const outgoing = new Map<string, string[]>()
  for (const flow of spec.flows) {
    outgoing.set(flow.source, [...(outgoing.get(flow.source) ?? []), flow.id])
    incoming.set(flow.target, [...(incoming.get(flow.target) ?? []), flow.id])
  }
  const refs = (id: string) =>
    [
      ...(incoming.get(id) ?? []).map((flowId) => `<bpmn:incoming>${flowId}</bpmn:incoming>`),
      ...(outgoing.get(id) ?? []).map((flowId) => `<bpmn:outgoing>${flowId}</bpmn:outgoing>`),
    ].join('')

  const nodeXml = placed
    .map((node) => {
      const inner = refs(node.id)
      const open = `<bpmn:${node.tag} id="${esc(node.id)}" name="${esc(node.name)}"`
      return inner ? `${open}>${inner}</bpmn:${node.tag}>` : `${open} />`
    })
    .join('')

  const boundaryXml = (spec.boundaries ?? [])
    .map((boundary) => {
      const eventTag = boundary.event === 'message' ? 'messageEventDefinition' : 'errorEventDefinition'
      return `<bpmn:boundaryEvent id="${esc(boundary.id)}" name="${esc(boundary.name)}" attachedToRef="${esc(boundary.attachedTo)}"><bpmn:${eventTag} id="${esc(boundary.id)}_def" /></bpmn:boundaryEvent>`
    })
    .join('')

  const flowXml = spec.flows
    .map(
      (flow) =>
        `<bpmn:sequenceFlow id="${esc(flow.id)}" sourceRef="${esc(flow.source)}" targetRef="${esc(flow.target)}" />`,
    )
    .join('')

  const laneXml = spec.lanes
    .map((lane) => {
      const ids = [
        ...placed.filter((node) => node.laneId === lane.id).map((node) => node.id),
        ...(spec.boundaries ?? [])
          .filter((boundary) => byId.get(boundary.attachedTo)?.laneId === lane.id)
          .map((boundary) => boundary.id),
      ]
      const flowRefs = ids.map((id) => `<bpmn:flowNodeRef>${id}</bpmn:flowNodeRef>`).join('')
      return `<bpmn:lane id="${esc(lane.id)}" name="${esc(lane.name)}">${flowRefs}</bpmn:lane>`
    })
    .join('')

  const laneCount = Math.max(spec.lanes.length, 1)
  const maxX = placed.reduce((max, node) => Math.max(max, node.x + node.w), 480)
  const width = Math.max(640, maxX + 80 - 120)
  const height = laneCount * 170
  const shapes = [
    `<bpmndi:BPMNShape id="Participant_${esc(spec.id)}_di" bpmnElement="Participant_${esc(spec.id)}" isHorizontal="true"><dc:Bounds x="120" y="80" width="${width}" height="${height}" /></bpmndi:BPMNShape>`,
    ...spec.lanes.map(
      (lane, index) =>
        `<bpmndi:BPMNShape id="${esc(lane.id)}_di" bpmnElement="${esc(lane.id)}" isHorizontal="true"><dc:Bounds x="150" y="${80 + index * 170}" width="${width - 30}" height="170" /></bpmndi:BPMNShape>`,
    ),
    ...placed.map(
      (node) =>
        `<bpmndi:BPMNShape id="${esc(node.id)}_di" bpmnElement="${esc(node.id)}"><dc:Bounds x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" /></bpmndi:BPMNShape>`,
    ),
    ...(spec.boundaries ?? []).map((boundary) => {
      const host = byId.get(boundary.attachedTo)
      const x = host ? host.x + host.w - 18 : 240
      const y = host ? host.y + host.h - 18 : 180
      return `<bpmndi:BPMNShape id="${esc(boundary.id)}_di" bpmnElement="${esc(boundary.id)}"><dc:Bounds x="${x}" y="${y}" width="36" height="36" /></bpmndi:BPMNShape>`
    }),
  ].join('')

  const edges = spec.flows
    .map((flow) => {
      const source = byId.get(flow.source)
      const target = byId.get(flow.target)
      const x1 = source ? source.x + source.w : 0
      const y1 = source ? source.y + source.h / 2 : 0
      const x2 = target ? target.x : 0
      const y2 = target ? target.y + target.h / 2 : 0
      const points =
        source && target && Math.abs(y1 - y2) > 8
          ? `<di:waypoint x="${x1}" y="${y1}" /><di:waypoint x="${x1 + 30}" y="${y1}" /><di:waypoint x="${x1 + 30}" y="${y2}" /><di:waypoint x="${x2}" y="${y2}" />`
          : `<di:waypoint x="${x1}" y="${y1}" /><di:waypoint x="${x2}" y="${y2}" />`
      return `<bpmndi:BPMNEdge id="${esc(flow.id)}_di" bpmnElement="${esc(flow.id)}">${points}</bpmndi:BPMNEdge>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="Definitions_${esc(spec.id)}" targetNamespace="http://bcbp.local/workflows">
  <bpmn:collaboration id="Collaboration_${esc(spec.id)}">
    <bpmn:participant id="Participant_${esc(spec.id)}" name="${esc(spec.processName)}" processRef="Process_${esc(spec.id)}" />
  </bpmn:collaboration>
  <bpmn:process id="Process_${esc(spec.id)}" isExecutable="true">
    <bpmn:laneSet id="LaneSet_${esc(spec.id)}">${laneXml}</bpmn:laneSet>
    ${nodeXml}
    ${boundaryXml}
    ${flowXml}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_${esc(spec.id)}">
    <bpmndi:BPMNPlane id="Plane_${esc(spec.id)}" bpmnElement="Collaboration_${esc(spec.id)}">
      ${shapes}
      ${edges}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
}

const ELEMENT_PATTERN =
  /<bpmn:(startEvent|endEvent|userTask|sendTask|receiveTask|serviceTask|callActivity|subProcess|boundaryEvent|lane|participant)\b([^>]*?)(?:\/>|>)/g

function attr(source: string, name: string): string {
  return new RegExp(`${name}="([^"]*)"`).exec(source)?.[1] ?? ''
}

export function readElements(xml: string): DiagramNode[] {
  const nodes: DiagramNode[] = []
  for (const match of xml.matchAll(ELEMENT_PATTERN)) {
    const tag = match[1] as BpmnTag
    const attrs = match[2] ?? ''
    const id = attr(attrs, 'id')
    if (!id) continue
    nodes.push({ id, tag, name: attr(attrs, 'name') })
  }
  return nodes
}

export function readFlows(xml: string): { id: string; source: string; target: string }[] {
  const flows: { id: string; source: string; target: string }[] = []
  for (const match of xml.matchAll(/<bpmn:sequenceFlow\b([^>]*?)(?:\/>|>)/g)) {
    const attrs = match[1] ?? ''
    const id = attr(attrs, 'id')
    const source = attr(attrs, 'sourceRef')
    const target = attr(attrs, 'targetRef')
    if (id && source && target) flows.push({ id, source, target })
  }
  return flows
}

export function readLanes(xml: string): { id: string; name: string }[] {
  return readElements(xml)
    .filter((element) => element.tag === 'lane')
    .map((element) => ({ id: element.id, name: element.name || element.id }))
}

export function reconcileNodes(xml: string, current: NodeConfig[]): NodeConfig[] {
  return readElements(xml).flatMap((element) => {
    const kind = kindForTag(element.tag)
    if (!kind) return []
    const existing = current.find((node) => node.id === element.id)
    if (!existing) return [defaultNode(element.id, kind, element.name || element.id)]
    return [{ ...existing, kind, name: element.name || existing.name }]
  })
}

function nextId(xml: string, prefix: string): string {
  let n = 1
  while (xml.includes(`${prefix}_${n}`)) n += 1
  return `${prefix}_${n}`
}

export function renameElement(xml: string, id: string, name: string): string {
  const withName = new RegExp(`(<bpmn:[A-Za-z]+\\b[^>]*\\bid="${id}"[^>]*\\bname=")([^"]*)(")`)
  if (withName.test(xml)) return xml.replace(withName, `$1${esc(name)}$3`)
  const missing = new RegExp(`(<bpmn:[A-Za-z]+\\b[^>]*\\bid="${id}")(\\s*/?>)`)
  return xml.replace(missing, `$1 name="${esc(name)}"$2`)
}

/** A BPMN process document. Anything else is refused at upload. */
export function isProcessDocument(xml: string): boolean {
  return typeof xml === 'string' && /<bpmn:definitions\b/.test(xml) && /<bpmn:process\b/.test(xml)
}

type Box = { id: string; x: number; y: number; w: number; h: number }

function shapeBoxes(xml: string): Box[] {
  const boxes: Box[] = []
  for (const match of xml.matchAll(/<bpmndi:BPMNShape\b([^>]*)>([\s\S]*?)<\/bpmndi:BPMNShape>/g)) {
    const id = attr(match[1] ?? '', 'bpmnElement')
    const box = /<dc:Bounds x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(match[2] ?? '')
    if (!id || !box) continue
    boxes.push({ id, x: Number(box[1]), y: Number(box[2]), w: Number(box[3]), h: Number(box[4]) })
  }
  return boxes
}

function placeInLane(xml: string, height: number): { x: number; y: number } {
  const boxes = shapeBoxes(xml)
  const lane = boxes.find((box) => box.id.startsWith('Lane'))
  let right = 180
  for (const box of boxes) {
    if (box.id.startsWith('Participant') || box.id.startsWith('Lane')) continue
    right = Math.max(right, box.x + box.w)
  }
  return { x: right + 70, y: lane ? lane.y + Math.max(0, (lane.h - height) / 2) : 120 }
}

function shapeXml(id: string, x: number, y: number, width: number, height: number): string {
  return `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"><dc:Bounds x="${x}" y="${y}" width="${width}" height="${height}" /></bpmndi:BPMNShape>`
}

function addShape(xml: string, shape: string): string {
  if (!xml.includes('</bpmndi:BPMNPlane>')) return xml
  return xml.replace('</bpmndi:BPMNPlane>', `${shape}</bpmndi:BPMNPlane>`)
}

function claimFirstLane(xml: string, id: string): string {
  if (!xml.includes('</bpmn:lane>')) return xml
  return xml.replace('</bpmn:lane>', `<bpmn:flowNodeRef>${id}</bpmn:flowNodeRef></bpmn:lane>`)
}

export function insertLane(xml: string, name = 'New department'): string {
  const id = nextId(xml, 'Lane')
  const lane = `<bpmn:lane id="${id}" name="${esc(name)}"></bpmn:lane>`
  const withLane = xml.includes('</bpmn:laneSet>')
    ? xml.replace('</bpmn:laneSet>', `${lane}</bpmn:laneSet>`)
    : xml.replace(/<bpmn:process\b([^>]*)>/, `<bpmn:process$1><bpmn:laneSet id="${id}_set">${lane}</bpmn:laneSet>`)
  const lanes = shapeBoxes(withLane).filter((box) => box.id.startsWith('Lane'))
  const y = lanes.length ? Math.max(...lanes.map((box) => box.y + box.h)) : 250
  const width = lanes[0]?.w ?? 900
  return addShape(withLane, shapeXml(id, 150, y, width, 170))
}

export function insertElement(xml: string, item: PaletteId): string {
  if (item === 'lane') return insertLane(xml)
  const tag = TAG_BY_PALETTE[item]
  if (!tag) return xml
  const id = nextId(xml, item === 'message-boundary' || item === 'error-boundary' ? 'Boundary' : 'Activity')
  const label = PALETTE_ITEMS.find((entry) => entry.id === item)?.label ?? 'Activity'
  if (item === 'message-boundary' || item === 'error-boundary') {
    const host = readElements(xml).find((element) => element.tag === 'userTask' || element.tag === 'serviceTask')
    if (!host) return xml
    const eventTag = item === 'message-boundary' ? 'messageEventDefinition' : 'errorEventDefinition'
    const boundary = `<bpmn:boundaryEvent id="${id}" name="${esc(label)}" attachedToRef="${host.id}"><bpmn:${eventTag} id="${id}_def" /></bpmn:boundaryEvent>`
    const hostBox = shapeBoxes(xml).find((box) => box.id === host.id)
    const x = hostBox ? hostBox.x + hostBox.w - 18 : 240
    const y = hostBox ? hostBox.y + hostBox.h - 18 : 180
    return addShape(claimFirstLane(xml.replace('</bpmn:process>', `${boundary}</bpmn:process>`), id), shapeXml(id, x, y, 36, 36))
  }
  const size = sizeFor(tag)
  const at = placeInLane(xml, size.h)
  const start = readElements(xml).find((element) => element.tag === 'startEvent')
  const startBox = start ? shapeBoxes(xml).find((box) => box.id === start.id) : undefined
  const flowId = nextId(xml, 'Flow')
  const task = `<bpmn:${tag} id="${id}" name="${esc(label)}" />`
  const flow = start ? `<bpmn:sequenceFlow id="${flowId}" sourceRef="${start.id}" targetRef="${id}" />` : ''
  const x1 = startBox ? startBox.x + startBox.w : at.x
  const y1 = startBox ? startBox.y + startBox.h / 2 : at.y + size.h / 2
  const edge = start
    ? `<bpmndi:BPMNEdge id="${flowId}_di" bpmnElement="${flowId}"><di:waypoint x="${x1}" y="${y1}" /><di:waypoint x="${at.x}" y="${at.y + size.h / 2}" /></bpmndi:BPMNEdge>`
    : ''
  const withTask = claimFirstLane(xml.replace('</bpmn:process>', `${task}${flow}</bpmn:process>`), id)
  return addShape(withTask, `${shapeXml(id, at.x, at.y, size.w, size.h)}${edge}`)
}

export function blankDiagram(): string {
  return buildDiagram({
    id: 'blank',
    processName: 'New workflow',
    lanes: [{ id: 'Lane_Team', name: 'Unassigned' }],
    nodes: [
      { id: 'Start_1', tag: 'startEvent', name: 'Start', laneId: 'Lane_Team' },
      { id: 'End_1', tag: 'endEvent', name: 'End', laneId: 'Lane_Team' },
    ],
    flows: [{ id: 'Flow_1', source: 'Start_1', target: 'End_1' }],
  })
}

export function bpmnTypeForPalette(item: PaletteId): string | null {
  const tag = TAG_BY_PALETTE[item]
  return tag ? `bpmn:${tag}` : null
}
