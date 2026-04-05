import { describe, expect, it } from 'vitest'
import { formatInviteAcceptError } from '../supabaseErrors'

describe('formatInviteAcceptError', () => {
  it('maps known invite accept errors to Norwegian copy', () => {
    expect(formatInviteAcceptError('invalid_token')).toContain('ugyldig')
    expect(formatInviteAcceptError('expired')).toContain('utløpt')
    expect(formatInviteAcceptError('already_accepted')).toContain('allerede brukt')
    expect(formatInviteAcceptError('cannot_accept_own')).toContain('laget selv')
    expect(formatInviteAcceptError('invalid_target_member')).toContain('passer ikke')
    expect(formatInviteAcceptError('not_authenticated')).toContain('Logg inn')
    expect(formatInviteAcceptError('email_mismatch')).toContain('annen e-postadresse')
  })

  it('falls back to generic text for unknown or missing code', () => {
    expect(formatInviteAcceptError('other_error')).toContain('other_error')
    expect(formatInviteAcceptError(undefined)).toContain('Kunne ikke godta invitasjonen')
  })
})

