import { describe, expect, it } from 'vitest'
import type { EventMetadata } from '../../types'
import {
  formatTankestromTimeComputationDevLine,
  tankestromTimeSourceIsComputedFromDuration,
} from '../tankestromComputedTimePresentation'

describe('tankestromTimeSourceIsComputedFromDuration', () => {
  it('gjenkjenner computed_from_duration', () => {
    expect(tankestromTimeSourceIsComputedFromDuration('computed_from_duration')).toBe(true)
    expect(tankestromTimeSourceIsComputedFromDuration('Computed_From_Duration')).toBe(true)
    expect(tankestromTimeSourceIsComputedFromDuration('explicit')).toBe(false)
  })
})

describe('formatTankestromTimeComputationDevLine', () => {
  it('bygger linje fra start, durationMinutes og end', () => {
    const meta: EventMetadata = {
      timeComputation: { start: '08:30', durationMinutes: 90, end: '10:00' },
    }
    expect(formatTankestromTimeComputationDevLine(meta)).toBe('08:30 + 90 min = 10:00')
  })

  it('bruker expression når satt', () => {
    const meta: EventMetadata = {
      timeComputation: { expression: '08:30 + 1t30m = 10:00' },
    }
    expect(formatTankestromTimeComputationDevLine(meta)).toBe('08:30 + 1t30m = 10:00')
  })
})
