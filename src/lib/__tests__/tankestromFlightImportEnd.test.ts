import { describe, expect, it } from 'vitest'
import {
  tankestromShouldStripSyntheticFlightEnd,
  tankestromFlightHasReliableEndSignal,
} from '../tankestromFlightImportEnd'

describe('tankestromShouldStripSyntheticFlightEnd', () => {
  const baseMeta = (extra: Record<string, unknown> = {}) => ({ travel: { type: 'flight' }, ...extra })

  it('stripper ved fallback_duration uten ankomst/varighet', () => {
    expect(
      tankestromShouldStripSyntheticFlightEnd('flight', baseMeta({ endTimeSource: 'fallback_duration' }))
    ).toBe(true)
  })

  it('stripper når endTimeSource mangler', () => {
    expect(tankestromShouldStripSyntheticFlightEnd('flight', baseMeta({}))).toBe(true)
  })

  it('stripper når inferredEndTime er true uten pålitelig signal', () => {
    expect(
      tankestromShouldStripSyntheticFlightEnd('flight', baseMeta({ endTimeSource: 'explicit', inferredEndTime: true }))
    ).toBe(true)
  })

  it('beholder slutt ved explicit_arrival_time', () => {
    expect(
      tankestromShouldStripSyntheticFlightEnd('flight', baseMeta({ endTimeSource: 'explicit_arrival_time' }))
    ).toBe(false)
  })

  it('beholder slutt ved computed_from_duration', () => {
    expect(
      tankestromShouldStripSyntheticFlightEnd('flight', baseMeta({ endTimeSource: 'computed_from_duration' }))
    ).toBe(false)
  })

  it('beholder slutt når arrivalTime er satt', () => {
    expect(
      tankestromShouldStripSyntheticFlightEnd('flight', {
        travel: { type: 'flight', arrivalTime: '09:00' },
        endTimeSource: 'fallback_duration',
      })
    ).toBe(false)
  })

  it('beholder slutt når durationMinutes > 0', () => {
    expect(
      tankestromShouldStripSyntheticFlightEnd('flight', {
        travel: { type: 'flight', durationMinutes: 120 },
        endTimeSource: 'fallback_duration',
        inferredEndTime: true,
      })
    ).toBe(false)
  })

  it('gjør ingenting for ikke-fly', () => {
    expect(
      tankestromShouldStripSyntheticFlightEnd('train', baseMeta({ endTimeSource: 'fallback_duration' }))
    ).toBe(false)
  })
})

describe('tankestromFlightHasReliableEndSignal', () => {
  it('durationMinutes 0 er ikke pålitelig signal', () => {
    expect(
      tankestromFlightHasReliableEndSignal({
        travel: { type: 'flight', durationMinutes: 0 },
        endTimeSource: 'fallback_duration',
      })
    ).toBe(false)
  })
})
