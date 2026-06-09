/**
 * Felles gate for Tankestrøm-relatert konsoll-støy (ikke brukerfeil).
 * Kun aktivert i development builds — aldri i produksjon.
 *
 * SECURITY: VITE_* debug flags have been intentionally removed.
 * Enabling debug logging in production would expose children's school data
 * and AI response bodies in the browser console (GDPR risk).
 */
export function isTankestromConsoleDebugEnabled(): boolean {
  return import.meta.env.DEV === true
}

/**
 * HTTP-rådata (endpoint, headers, full body).
 * Kun aktivert i development builds — aldri i produksjon.
 */
export function isTankestromHttpDebugEnabled(): boolean {
  return import.meta.env.DEV === true
}
