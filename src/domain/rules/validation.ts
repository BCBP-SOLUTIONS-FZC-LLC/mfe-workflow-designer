import { readElements, readFlows } from './diagram'
import { TASK_KINDS, type NodeConfig } from '../entities/types'

export type IssueCode =
  | 'validation.start'
  | 'validation.end'
  | 'validation.task'
  | 'validation.person'
  | 'validation.module'
  | 'validation.connected'
  | 'validation.credentials'
  | 'validation.diagram'

export type ValidationIssue = {
  elementId: string
  code: IssueCode
  vars?: Record<string, string | number>
}

const SECRET_ASSIGNMENT = /(password|clientSecret|api[_-]?key|secretValue|BEGIN PRIVATE KEY)\s*[:=]/i

export function credentialMaterial(value: string): boolean {
  return SECRET_ASSIGNMENT.test(value)
}

export function containsSecret(value: string, secrets: string[]): boolean {
  return secrets.some((secret) => secret.trim().length >= 4 && value.includes(secret))
}

export function validateWorkflow(xml: string, nodes: NodeConfig[], secrets: string[] = []): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const elements = readElements(xml)
  if (!elements.some((element) => element.tag === 'startEvent')) {
    issues.push({ elementId: 'process', code: 'validation.start' })
  }
  if (!elements.some((element) => element.tag === 'endEvent')) {
    issues.push({ elementId: 'process', code: 'validation.end' })
  }
  const tasks = nodes.filter((node) => TASK_KINDS.has(node.kind) || node.kind === 'call' || node.kind === 'subprocess')
  if (tasks.length === 0) {
    issues.push({ elementId: 'process', code: 'validation.task' })
  }
  const linked = new Set(readFlows(xml).flatMap((flow) => [flow.source, flow.target]))
  for (const node of nodes) {
    const name = node.name || node.id
    if (TASK_KINDS.has(node.kind) && !node.assignee.trim()) {
      issues.push({ elementId: node.id, code: 'validation.person', vars: { name } })
    }
    if (node.kind === 'call' && !node.moduleVersion.trim()) {
      issues.push({ elementId: node.id, code: 'validation.module', vars: { name } })
    }
    if (node.kind !== 'boundary' && !linked.has(node.id)) {
      issues.push({ elementId: node.id, code: 'validation.connected', vars: { name } })
    }
    const fields = [
      node.name,
      node.inputMapping,
      node.outputMapping,
      node.connectorInputs,
      node.connectorOutputs,
      node.messageName,
    ].join('\n')
    if (credentialMaterial(fields) || containsSecret(fields, secrets)) {
      issues.push({ elementId: node.id, code: 'validation.credentials', vars: { name } })
    }
  }
  if (credentialMaterial(xml) || containsSecret(xml, secrets)) {
    issues.push({ elementId: 'process', code: 'validation.diagram' })
  }
  return issues
}

export function deriveValidity(xml: string, nodes: NodeConfig[], secrets: string[] = []): 'valid' | 'invalid' {
  return validateWorkflow(xml, nodes, secrets).length === 0 ? 'valid' : 'invalid'
}

export function diagramOmitsSecrets(xml: string, nodes: NodeConfig[], secrets: string[]): boolean {
  const document = `${xml}\n${JSON.stringify(nodes)}`
  return !containsSecret(document, secrets) && !credentialMaterial(document)
}
