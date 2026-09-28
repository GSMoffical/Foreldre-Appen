/**
 * Shadow Synka v0 — eksplisitt opt-in-gate.
 *
 * Default OFF. Når AV: ingen analysis_runs opprettes, ingen review-UI, vanlig Synka-import
 * er identisk som før. Aktiveres på to måter (begge default av):
 *   1. Build-env: `VITE_SHADOW_MODE=true` (repoets etablerte env-flag-konvensjon).
 *   2. Per-enhet override i nettleseren: localStorage `synka-shadow-mode = 'on'`
 *      (lar piloten skrus på i et deployet bygg uten ny build; speiler `debug_overlay`-mønsteret).
 *
 * Dette er IKKE et admin-system — kun en enkel pilotbryter.
 */

const SHADOW_MODE_LS_KEY = 'synka-shadow-mode'

export type ShadowModeEnv = { VITE_SHADOW_MODE?: string }

/** Ren, testbar kjerne. */
export function computeShadowModeEnabled(env: ShadowModeEnv, localOverride: string | null): boolean {
  if (localOverride === 'on') return true
  return env.VITE_SHADOW_MODE === 'true'
}

function readLocalOverride(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(SHADOW_MODE_LS_KEY) : null
  } catch {
    return null
  }
}

/** Produksjonsbruk. */
export function isShadowModeEnabled(): boolean {
  return computeShadowModeEnabled(import.meta.env as unknown as ShadowModeEnv, readLocalOverride())
}
