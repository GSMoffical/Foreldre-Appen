import { useEffect, useState } from 'react'
import { acceptInvite } from '../../../lib/inviteApi'

export interface InviteNotice {
  variant: 'success' | 'error'
  message: string
}

interface UseInviteAcceptanceOptions {
  userId: string | undefined
  onAccepted: () => Promise<unknown> | unknown
}

export function useInviteAcceptance({ userId, onAccepted }: UseInviteAcceptanceOptions) {
  const [inviteNotice, setInviteNotice] = useState<InviteNotice | null>(null)
  const [inviteProcessing, setInviteProcessing] = useState(false)

  useEffect(() => {
    if (!userId) return
    const params = new URLSearchParams(window.location.search)
    const token = params.get('invite')
    if (!token) return

    let cancelled = false
    setInviteProcessing(true)

    void acceptInvite(token).then((result) => {
      if (cancelled) return
      params.delete('invite')
      const newSearch = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''))
      window.localStorage.removeItem('invite-member-kind')
      if (result.ok) {
        void onAccepted()
        setInviteNotice({ variant: 'success', message: 'Du er nå koblet til familien.' })
      } else {
        setInviteNotice({
          variant: 'error',
          message: result.error ?? 'Kunne ikke godta invitasjonen.',
        })
      }
      setInviteProcessing(false)
    })

    return () => {
      cancelled = true
      setInviteProcessing(false)
    }
  }, [onAccepted, userId])

  useEffect(() => {
    if (inviteNotice?.variant !== 'success') return
    const timer = window.setTimeout(() => setInviteNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [inviteNotice])

  return {
    inviteNotice,
    setInviteNotice,
    inviteProcessing,
  }
}
