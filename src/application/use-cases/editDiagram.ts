import {
  PALETTE_ITEMS,
  bpmnTypeForPalette,
  insertElement,
  insertLane,
  reconcileNodes,
  renameElement,
  type PaletteId,
} from '../../domain/rules/diagram'
import { diagramOmitsSecrets, validateWorkflow } from '../../domain/rules/validation'
import type { NodeConfig } from '../../domain/entities/types'
import { issueText } from '../queries/issues'

export type { PaletteId }
export { PALETTE_ITEMS, bpmnTypeForPalette }

export function placePaletteItem(xml: string, item: PaletteId): string {
  return item === 'lane' ? insertLane(xml) : insertElement(xml, item)
}

export function renameDiagramElement(xml: string, id: string, name: string): string {
  return renameElement(xml, id, name)
}

export function syncDiagramNodes(xml: string, nodes: NodeConfig[]): NodeConfig[] {
  return reconcileNodes(xml, nodes)
}

export function reviewDiagram(xml: string, nodes: NodeConfig[], secrets: string[]) {
  return {
    issues: validateWorkflow(xml, nodes, secrets).map((issue) => ({ ...issue, message: issueText(issue) })),
    clean: diagramOmitsSecrets(xml, nodes, secrets),
  }
}
