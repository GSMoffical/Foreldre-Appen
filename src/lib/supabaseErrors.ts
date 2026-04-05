import type { PostgrestError } from '@supabase/supabase-js'

/** User-facing Norwegian message for PostgREST / Supabase errors */
export function formatSupabaseError(err: PostgrestError | null | undefined): string {
  if (!err) return 'Noe gikk galt. Prøv igjen.'
  const code = err.code
  const msg = (err.message ?? '').toLowerCase()

  if (code === 'PGRST301' || msg.includes('jwt') || (msg.includes('expired') && msg.includes('token'))) {
    return 'Sesjonen er utløpt. Logg inn på nytt.'
  }
  if (code === '42P01' || msg.includes('does not exist') || (msg.includes('relation') && msg.includes('not exist'))) {
    return 'Databasen mangler en tabell eller funksjon. Sjekk at Supabase-oppsettet er kjørt.'
  }
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('load failed')) {
    return 'Ingen nettverk eller serveren svarer ikke. Sjekk tilkoblingen og prøv igjen.'
  }
  if (code === '42501' || msg.includes('permission denied') || msg.includes('rls') || msg.includes('policy')) {
    return 'Du har ikke tilgang (sikkerhetsregler). Sjekk RLS-policyer i Supabase.'
  }
  if (err.message && err.message.length < 120) return err.message
  return 'Noe gikk galt. Prøv igjen om litt.'
}

export function formatFamilyLoadError(err: PostgrestError): string {
  return `Kunne ikke laste familien. ${formatSupabaseError(err)}`
}

export function formatFamilySeedError(err: PostgrestError): string {
  return `Kunne ikke opprette standard familiemedlemmer. ${formatSupabaseError(err)}`
}

/** RPC `accept_invite` returns `{ error: string }` from app logic */
export function formatInviteAcceptError(code: string | undefined): string {
  switch (code) {
    case 'invalid_token':
      return 'Invitasjonslenken er ugyldig eller finnes ikke.'
    case 'expired':
      return 'Invitasjonen er utløpt. Be om en ny lenke fra den andre forelderen.'
    case 'already_accepted':
      return 'Denne invitasjonen er allerede brukt.'
    case 'cannot_accept_own':
      return 'Du kan ikke bruke en invitasjonslenke du har laget selv.'
    case 'invalid_target_member':
      return 'Invitasjonen passer ikke til denne familien lenger. Be om en ny lenke.'
    case 'email_mismatch':
      return 'Invitasjonen er knyttet til en annen e-postadresse. Logg inn med riktig e-post.'
    case 'not_authenticated':
      return 'Logg inn for å godta invitasjonen.'
    default:
      if (code && code.length < 80) return `Kunne ikke godta invitasjonen: ${code}`
      return 'Kunne ikke godta invitasjonen. Prøv igjen.'
  }
}

export function formatScheduleLoadError(err: PostgrestError): string {
  return `Kunne ikke hente aktiviteter. ${formatSupabaseError(err)}`
}
