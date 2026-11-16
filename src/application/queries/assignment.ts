import { PEOPLE, STAGE_TYPES } from '../../domain/entities/types'

export function stageOptions(): string[] {
  return [...STAGE_TYPES]
}

export function personOptions(): { name: string; department: string }[] {
  return PEOPLE.map((person) => ({ name: person.name, department: person.department }))
}
