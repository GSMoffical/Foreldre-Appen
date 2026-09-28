/**
 * Felles gate for skole-INNHOLDS-diagnostikk (kan inneholde barnenavn, skoledata, tider).
 *
 * Personvern-invariant: slik innholdslogging skal ALDRI kunne aktiveres i en
 * produksjonsbygg bare ved å sette `VITE_DEBUG_SCHOOL_IMPORT=true`.
 *
 * Prinsipp (opt-in AND non-production, men behold lokal diagnostikk):
 *   - DEV                         → på (nyttig lokal diagnostikk beholdes)
 *   - PROD                        → alltid av (flagget er maktesløst i prod)
 *   - ellers (test/preview o.l.)  → kun på ved eksplisitt VITE_DEBUG_SCHOOL_IMPORT==='true'
 */

export type SchoolImportDebugEnv = {
  DEV?: boolean
  PROD?: boolean
  VITE_DEBUG_SCHOOL_IMPORT?: string
}

/** Ren, testbar kjerne — tar env eksplisitt. */
export function computeSchoolImportContentDebug(env: SchoolImportDebugEnv): boolean {
  if (env.DEV) return true
  if (env.PROD) return false
  return env.VITE_DEBUG_SCHOOL_IMPORT === 'true'
}

/** Produksjonsbruk: leser Vite-env. */
export function isSchoolImportContentDebugEnabled(): boolean {
  return computeSchoolImportContentDebug(import.meta.env as unknown as SchoolImportDebugEnv)
}
