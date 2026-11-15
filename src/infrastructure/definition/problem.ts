export type InvalidParam = {
  name: string
  code: string
  reason: string
}

export type ServiceProblem = {
  status: number
  code: string
  detail: string
  invalidParams: InvalidParam[]
  currentRecordVersion?: number
}

type ProblemBody = {
  code?: unknown
  errorCode?: unknown
  detail?: unknown
  title?: unknown
  invalid_params?: unknown
  validationErrors?: unknown
  current_record_version?: unknown
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function paramsOf(body: ProblemBody): InvalidParam[] {
  if (Array.isArray(body.invalid_params)) {
    return body.invalid_params.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as { name?: unknown; code?: unknown; reason?: unknown }
      return [{ name: text(row.name), code: text(row.code), reason: text(row.reason) }]
    })
  }
  if (Array.isArray(body.validationErrors)) {
    return body.validationErrors.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as { field?: unknown; message?: unknown; code?: unknown }
      return [{ name: text(row.field), code: text(row.code), reason: text(row.message) }]
    })
  }
  return []
}

/** The service writes `code` today and `errorCode` after WF-2. Either body is read. */
export function problemFromBody(status: number, body: unknown): ServiceProblem {
  const record = body && typeof body === 'object' ? (body as ProblemBody) : {}
  const code = text(record.code) || text(record.errorCode) || 'INTERNAL_ERROR'
  const version = record.current_record_version
  return {
    status,
    code,
    detail: text(record.detail) || text(record.title),
    invalidParams: paramsOf(record),
    currentRecordVersion: typeof version === 'number' ? version : undefined,
  }
}

export async function readProblem(response: Response): Promise<ServiceProblem> {
  const body = await response.json().catch(() => undefined)
  return problemFromBody(response.status, body)
}
