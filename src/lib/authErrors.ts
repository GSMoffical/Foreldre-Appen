/**
 * Map Supabase auth error codes/messages to user-friendly Norwegian messages.
 */
export function getAuthErrorMessage(error: { message?: string; code?: string } | null): string {
  if (!error) return 'Noe gikk galt.'
  const msg = (error.message ?? '').toLowerCase()
  const code = (error as { code?: string }).code ?? ''

  if (msg.includes('invalid login credentials') || code === 'invalid_credentials') {
    return 'Feil e-post eller passord. Prøv igjen.'
  }
  if (msg.includes('email not confirmed') || code === 'email_not_confirmed') {
    return 'Bekreft e-posten din. Sjekk innboksen (og søppelpost) for lenke fra oss.'
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'Denne e-posten er allerede registrert. Logg inn i stedet.'
  }
  if (msg.includes('password') && msg.includes('6 character')) {
    return 'Passordet må være minst 6 tegn.'
  }
  if (msg.includes('invalid email')) {
    return 'Ugyldig e-postadresse.'
  }
  if (msg.includes('signup requires a valid password')) {
    return 'Velg et passord på minst 6 tegn.'
  }
  if (msg.includes('too many requests') || code === 'over_request_rate_limit') {
    return 'For mange forsøk. Vent litt og prøv igjen.'
  }

  return error.message ?? 'Noe gikk galt. Prøv igjen.'
}
