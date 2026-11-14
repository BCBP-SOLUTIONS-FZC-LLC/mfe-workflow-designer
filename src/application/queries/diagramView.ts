import { readElements, readLanes } from '../../domain/rules/diagram'

const HIDDEN = new Set(['lane', 'participant', 'startEvent', 'endEvent'])

export function visibleElements(xml: string) {
  return readElements(xml).filter((element) => element.tag !== 'lane' && element.tag !== 'participant')
}

export function starterOutline(xml: string) {
  return {
    lanes: readLanes(xml),
    tasks: readElements(xml).filter((element) => !HIDDEN.has(element.tag)),
  }
}
