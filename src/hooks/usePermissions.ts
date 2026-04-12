import { useAuth } from '../context/AuthContext'
import { useEffectiveUserId } from '../context/EffectiveUserIdContext'
import { useFamily } from '../context/FamilyContext'
import type { PersonId } from '../types'

/**
 * Simple permission model:
 * - **Calendar owner** (logged-in account = data owner): full control of family list, invites, bulk delete.
 * - **Invited parent** (linked to someone else's family): shared calendar — add/edit/delete/move activities;
 *   cannot add/remove others in family, cannot invite, cannot wipe all events; may edit only their own chip
 *   (`self-*` legacy row or the parent row where `linkedAuthUserId` is them).
 */
export function usePermissions() {
  const { user } = useAuth()
  const { isLinked } = useEffectiveUserId()
  const { people } = useFamily()

  const isCalendarOwner = !isLinked
  const isInvitedParent = isLinked

  const selfFamilyMemberId: PersonId | null = user ? (`self-${user.id}` as PersonId) : null

  function canEditFamilyMember(personId: PersonId): boolean {
    if (isCalendarOwner) return true
    if (!user) return false
    if (selfFamilyMemberId && personId === selfFamilyMemberId) return true
    const claimed = people.find((p) => p.linkedAuthUserId === user.id)
    if (claimed && personId === claimed.id) return true
    return false
  }

  return {
    isCalendarOwner,
    isInvitedParent,
    /** Add / remove anyone, or edit any member */
    canManageFamilyMembers: isCalendarOwner,
    /** Create invite links (only owner) */
    canInviteOthers: isCalendarOwner,
    /** "Slett alle hendelser" (only owner — big blast radius) */
    canClearAllEvents: isCalendarOwner,
    canEditFamilyMember,
    selfFamilyMemberId,
  }
}
