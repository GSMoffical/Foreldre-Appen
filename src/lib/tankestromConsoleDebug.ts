/**
 * Felles gate for Tankestrøm-relatert konsoll-støy (ikke brukerfeil).
 * Slås på i dev, eller eksplisitt via env.
 */
export function isTankestromConsoleDebugEnabled(): boolean {
  return (
    import.meta.env.DEV === true ||
    import.meta.env.VITE_TANKESTROM_HTTP_DEBUG === 'true' ||
    import.meta.env.VITE_DEBUG_SCHOOL_IMPORT === 'true'
  )
}

/**
 * HTTP-rådata (endpoint, headers, full body). Ikke koblet til skole-import alene —
 * unngår sensitiv logging når kun VITE_DEBUG_SCHOOL_IMPORT er satt.
 */
export function isTankestromHttpDebugEnabled(): boolean {
  return import.meta.env.DEV === true || import.meta.env.VITE_TANKESTROM_HTTP_DEBUG === 'true'
}
