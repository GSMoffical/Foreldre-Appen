import type { Event, Task, TaskIntent, Person } from '../types'

export type TankestromV2Item = {
  kind: 'event' | 'task'
  title: string
  date: string
  start?: string | null
  end?: string | null
  location?: string | null
  notes?: string | null
  dueTime?: string | null
  taskIntent?: 'must_do' | 'can_help' | null
  recurrence?: string | null
  personHints?: {
    names: string[]
    class?: string | null
    school?: string | null
    targetGroup?: 'barn' | 'foreldre' | 'familie' | null
  }
  transport?: {
    needed: boolean
    hints: string[]
  }
}

export type TankestromV2Response = {
  version: string
  items: TankestromV2Item[]
}

export function resolvePersonFromHints(
  hints: TankestromV2Item['personHints'],
  people: Person[]
): { personId: string | null; confidence: 'high' | 'low' } {
  if (!hints) return { personId: null, confidence: 'low' }

  const parents = people.filter((p) => p.memberKind === 'parent')
  const children = people.filter((p) => p.memberKind === 'child')

  if (hints.names && hints.names.length > 0) {
    for (const hint of hints.names) {
      const lower = hint.toLowerCase()
      const match = people.find((p) => p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase()))
      if (match) return { personId: match.id, confidence: 'high' }
    }
  }

  if (hints.school) {
    const schoolLower = hints.school.toLowerCase()
    const schoolMatch = children.find((p) => {
      const profile = p.school
      if (!profile) return false
      const schoolName = (profile as { schoolName?: string }).schoolName
      return typeof schoolName === 'string' && schoolName.toLowerCase().includes(schoolLower)
    })
    if (schoolMatch) return { personId: schoolMatch.id, confidence: 'low' }
  }

  if (hints.targetGroup === 'foreldre') {
    return { personId: parents[0]?.id ?? null, confidence: 'low' }
  }

  if (hints.targetGroup === 'barn') {
    return { personId: children[0]?.id ?? null, confidence: 'low' }
  }

  if (hints.targetGroup === 'familie') {
    return { personId: null, confidence: 'low' }
  }

  return { personId: null, confidence: 'low' }
}

function isHm(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(s)
}

function safeHm(val: string | null | undefined): string {
  if (!val) return ''
  const trimmed = val.trim()
  if (trimmed.length >= 16 && trimmed[10] === 'T') return trimmed.slice(11, 16)
  return isHm(trimmed) ? trimmed : ''
}

function isTaskIntent(v: unknown): v is TaskIntent {
  return v === 'must_do' || v === 'can_help'
}

export function testParseTankestromV2(rawJson: string, people: Person[] = []) {
  const json = JSON.parse(rawJson)
  return parseTankestromV2Response(json, people)
}

export function parseTankestromV2Response(
  json: unknown,
  people: Person[]
): {
  events: Array<{ event: Omit<Event, 'id'>; date: string; confidence: 'high' | 'low' }>
  tasks: Array<{ task: Omit<Task, 'id'>; confidence: 'high' | 'low' }>
} {
  if (
    !json ||
    typeof json !== 'object' ||
    Array.isArray(json)
  ) {
    throw new Error('Ugyldig Tankestrøm v2-svar: forventet objekt')
  }

  const res = json as Record<string, unknown>

  if (typeof res.version !== 'string' || !res.version.startsWith('2.')) {
    throw new Error(`Ugyldig Tankestrøm v2-svar: versjon "${String(res.version)}" støttes ikke`)
  }

  if (!Array.isArray(res.items)) {
    throw new Error('Ugyldig Tankestrøm v2-svar: items mangler eller er ikke en liste')
  }

  const items = res.items as TankestromV2Item[]
  const events: Array<{ event: Omit<Event, 'id'>; date: string; confidence: 'high' | 'low' }> = []
  const tasks: Array<{ task: Omit<Task, 'id'>; confidence: 'high' | 'low' }> = []

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    if (!item.title?.trim() || !item.date?.trim()) continue

    const { personId, confidence } = resolvePersonFromHints(item.personHints, people)

    if (item.kind === 'event') {
      const start = safeHm(item.start)
      const end = safeHm(item.end)
      const event: Omit<Event, 'id'> = {
        personId: personId ?? null,
        title: item.title.trim(),
        start,
        end,
        ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
        ...(item.location?.trim() ? { location: item.location.trim() } : {}),
        ...(item.recurrence?.trim() ? { recurrenceGroupId: item.recurrence.trim() } : {}),
      }
      events.push({ event, date: item.date.trim(), confidence })
    } else if (item.kind === 'task') {
      const dueTime = safeHm(item.dueTime) || undefined
      const person = personId ? people.find((p) => p.id === personId) : undefined
      const isChild = person?.memberKind === 'child'
      const task: Omit<Task, 'id'> = {
        title: item.title.trim(),
        date: item.date.trim(),
        ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
        ...(dueTime ? { dueTime } : {}),
        ...(personId && isChild ? { childPersonId: personId } : {}),
        ...(personId && !isChild ? { assignedToPersonId: personId } : {}),
        taskIntent: isTaskIntent(item.taskIntent) ? item.taskIntent : 'must_do',
      }
      tasks.push({ task, confidence })
    }
  }

  return { events, tasks }
}
