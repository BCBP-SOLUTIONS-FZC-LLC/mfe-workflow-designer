import { isProcessDocument } from '../../domain/rules/diagram'
import { diagramOmitsSecrets } from '../../domain/rules/validation'
import type { NodeConfig } from '../../domain/entities/types'

export function acceptedUploadId(seq: number, xml: string): string {
  return isProcessDocument(xml) ? `wf-${seq}` : ''
}

export type ExportAssessment = {
  outcome: 'success' | 'failure'
  xml: string
  fileName: string
}

export function assessExport(xml: string, nodes: NodeConfig[], secrets: string[], key: string): ExportAssessment {
  const fileName = `${key || 'workflow'}.bpmn`
  const outcome = diagramOmitsSecrets(xml, nodes, secrets) ? 'success' : 'failure'
  return { outcome, xml, fileName }
}
