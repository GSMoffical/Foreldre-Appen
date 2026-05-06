import { describe, expect, it } from 'vitest'
import { normalizeImportTime, rawEventTimeInput } from '../tankestromImportTime'
import { parsePortalImportProposalBundle } from '../tankestromApi'
import { validateTankestromDraft, getTankestromDraftFieldErrors } from '../../features/tankestrom/useTankestromImport'
import type { TankestromEventDraft } from '../../features/tankestrom/types'

describe('normalizeImportTime', () => {
  it('normaliserer HH:mm og ISO datetime', () => {
    expect(normalizeImportTime('08:30')).toBe('08:30')
    expect(normalizeImportTime('2025-06-10T08:30:00')).toBe('08:30')
    expect(normalizeImportTime('2025-06-10T11:30:00')).toBe('11:30')
  })

  it('returnerer null for tom/undefined', () => {
    expect(normalizeImportTime('')).toBe(null)
    expect(normalizeImportTime(undefined)).toBe(null)
    expect(normalizeImportTime(null)).toBe(null)
  })

  it('returnerer null for uleselig format', () => {
    expect(normalizeImportTime('lunch')).toBe(null)
    expect(normalizeImportTime('8:30')).toBe(null)
  })
})

describe('rawEventTimeInput', () => {
  it('mapper JSON null til undefined', () => {
    expect(rawEventTimeInput(null)).toBe(undefined)
    expect(rawEventTimeInput(undefined)).toBe(undefined)
  })
})

const provenance = {
  sourceSystem: 'tankestrom' as const,
  sourceType: 'boarding_pass',
  generatedAt: '2026-05-05T12:00:00.000Z',
  importRunId: '00000000-0000-4000-8000-000000000001',
}

function eventProposal(event: Record<string, unknown>) {
  return {
    proposalId: '11111111-1111-4111-8111-111111111111',
    kind: 'event' as const,
    sourceId: '22222222-2222-4222-8222-222222222222',
    originalSourceType: 'boarding_pass',
    confidence: 0.92,
    event,
  }
}

describe('parsePortalImportProposalBundle (event-tid)', () => {
  it('parser ISO start/slutt uten å kaste — normaliserer til HH:mm', () => {
    const bundle = parsePortalImportProposalBundle({
      schemaVersion: '1.0.0',
      provenance,
      items: [
        eventProposal({
          date: '2025-06-10',
          title: 'Flybillett fra New York til London – Avreise',
          personId: null,
          start: '2025-06-10T08:30:00',
          end: '2025-06-10T11:30:00',
        }),
      ],
    })
    const item = bundle.items[0]
    expect(item.kind).toBe('event')
    if (item.kind !== 'event') return
    expect(item.event.start).toBe('08:30')
    expect(item.event.end).toBe('11:30')
    const meta = item.event.metadata as Record<string, unknown> | undefined
    expect(meta?.requiresManualTimeReview).toBeUndefined()
  })

  it('mangler sluttid: analyse lykkes, metadata flagger manuell review', () => {
    const bundle = parsePortalImportProposalBundle({
      schemaVersion: '1.0.0',
      provenance,
      items: [
        eventProposal({
          date: '2025-06-10',
          title: 'Flybillett',
          personId: null,
          start: '08:30',
          end: null,
        }),
      ],
    })
    const item = bundle.items[0]
    expect(item.kind).toBe('event')
    if (item.kind !== 'event') return
    expect(item.event.start).toBe('08:30')
    expect(item.event.end).toBe('')
    const meta = item.event.metadata as Record<string, unknown>
    expect(meta.requiresManualTimeReview).toBe(true)
    expect(meta.inferredEndTime).toBe(false)
    expect(meta.endTimeSource).toBe('missing_or_unreadable')
  })
})

describe('validateTankestromDraft tid', () => {
  const base: TankestromEventDraft = {
    title: 'X',
    date: '2026-06-01',
    start: '10:00',
    end: '11:00',
    personId: 'p1',
    location: '',
    notes: '',
    includeRecurrence: false,
    dropoffBy: '',
    pickupBy: '',
    isManualCalendarEntry: true,
  }

  it('blokkerer import med tydelig melding når sluttid mangler', () => {
    const d = { ...base, end: '' }
    expect(validateTankestromDraft(d, new Set(['p1']))).toBe(
      'Sluttid ikke oppgitt – rediger før import.'
    )
    const err = getTankestromDraftFieldErrors(d, new Set(['p1']))
    expect(err.end).toBe('Sluttid ikke oppgitt – rediger før import.')
  })

  it('blokkerer import når starttid mangler', () => {
    const d = { ...base, start: '' }
    expect(validateTankestromDraft(d, new Set(['p1']))).toBe(
      'Starttid ikke oppgitt. Rediger forslaget og legg inn starttid før import.'
    )
  })
})
