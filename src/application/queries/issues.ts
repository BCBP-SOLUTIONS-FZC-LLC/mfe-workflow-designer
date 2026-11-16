import { msg } from '../../shared/copy'
import type { ValidationIssue } from '../../domain/rules/validation'

/** The catalog sentence for a domain issue. The rule itself stays a code. */
export function issueText(issue: ValidationIssue): string {
  return msg(issue.code, issue.vars)
}
