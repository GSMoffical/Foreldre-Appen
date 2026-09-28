import { describe, expect, it } from 'vitest'
import { computeShadowModeEnabled } from '../shadowMode'

describe('computeShadowModeEnabled — default OFF opt-in', () => {
  it('default AV (ingen env, ingen override)', () => {
    expect(computeShadowModeEnabled({}, null)).toBe(false)
    expect(computeShadowModeEnabled({ VITE_SHADOW_MODE: 'false' }, null)).toBe(false)
    expect(computeShadowModeEnabled({ VITE_SHADOW_MODE: '' }, 'off')).toBe(false)
  })
  it('på via build-env', () => {
    expect(computeShadowModeEnabled({ VITE_SHADOW_MODE: 'true' }, null)).toBe(true)
  })
  it('på via localStorage-override', () => {
    expect(computeShadowModeEnabled({}, 'on')).toBe(true)
    expect(computeShadowModeEnabled({ VITE_SHADOW_MODE: 'false' }, 'on')).toBe(true)
  })
})
