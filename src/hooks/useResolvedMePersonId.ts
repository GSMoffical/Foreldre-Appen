import { useMemo } from 'react'
import type { Person, PersonId } from '../types'

/**
 * Stable “me” chip for filters: prefers saved preference if still valid,
 * then `self-<userId>` when present (invited parent).
 */
export function useResolvedMePersonId(
  people: Person[],
  currentPersonId: PersonId | null,
  userId: string | undefined
): PersonId | null {
  return useMemo(() => {
    const ids = new Set(people.map((p) => p.id))
    if (currentPersonId && ids.has(currentPersonId)) return currentPersonId
    if (userId) {
      const claimed = people.find((p) => p.linkedAuthUserId === userId)
      if (claimed) return claimed.id
      const selfId = `self-${userId}` as PersonId
      if (ids.has(selfId)) return selfId
    }
    return null
  }, [people, currentPersonId, userId])
}
