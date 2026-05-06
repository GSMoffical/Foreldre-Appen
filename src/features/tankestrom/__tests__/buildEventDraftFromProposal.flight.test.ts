import { describe, expect, it } from 'vitest'
import type { Person } from '../../../types'
import { buildEventDraftFromProposal } from '../useTankestromImport'
import type { PortalEventProposal } from '../types'

const people: Person[] = [
  { id: 'p1', name: 'Test', colorTint: 'bg-slate-200', colorAccent: 'border-slate-400', memberKind: 'parent' },
]

function flightProposal(metadata: Record<string, unknown>): PortalEventProposal {
  return {
    proposalId: 'prop-flight-1',
    kind: 'event',
    sourceId: 'src-1',
    originalSourceType: 'boarding_pass',
    confidence: 0.9,
    event: {
      date: '2026-06-01',
      title: 'Flyreise Oslo–Split',
      personId: 'p1',
      start: '06:05',
      end: '07:05',
      metadata,
    },
  }
}

describe('buildEventDraftFromProposal (fly)', () => {
  it('nullstiller kunstig slutt ved fallback_duration uten ankomst', () => {
    const p = flightProposal({
      travel: { type: 'flight' },
      endTimeSource: 'fallback_duration',
    })
    const draft = buildEventDraftFromProposal(p, new Set(['p1']), people, 'p1')
    expect(draft.end).toBe('')
    expect(draft.start).toBe('06:05')
    expect(draft.travelImportType).toBe('flight')
    const m = p.event.metadata as Record<string, unknown>
    expect(m.endTimeSource).toBe('missing_or_unreadable')
    expect(m.requiresManualTimeReview).toBe(true)
    expect(m.inferredEndTime).toBe(false)
  })

  it('beholder slutt ved explicit_arrival_time', () => {
    const p = flightProposal({
      travel: { type: 'flight' },
      endTimeSource: 'explicit_arrival_time',
    })
    const draft = buildEventDraftFromProposal(p, new Set(['p1']), people, 'p1')
    expect(draft.end).toBe('07:05')
  })
})
