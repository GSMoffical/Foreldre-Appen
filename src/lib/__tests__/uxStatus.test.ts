import { describe, expect, it } from 'vitest'
import { buildDailyStatusText } from '../uxStatus'

describe('buildDailyStatusText', () => {
  it('shows collision-first status', () => {
    expect(buildDailyStatusText(2, 5)).toBe('2 kollisjoner må avklares')
  })

  it('shows remaining work when no collisions', () => {
    expect(buildDailyStatusText(0, 3)).toBe('3 ting igjen i dag')
  })

  it('shows calm state when clear', () => {
    expect(buildDailyStatusText(0, 0)).toBe('Alt klart')
  })
})
