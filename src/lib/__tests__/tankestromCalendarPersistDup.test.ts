import { describe, it, expect } from 'vitest'
import {
  findTankestromPersistDuplicateInAnchors,
  tankestromPersistFingerprint,
} from '../tankestromCalendarPersistDup'
import type { Event } from '../../types'

describe('tankestromCalendarPersistDup', () => {
  it('samme fingerprint for like programnøkler og tid', () => {
    const meta = {
      arrangementBlockGroupId: 'grp-1',
      parentArrangementStableKey: 'cup-1',
      detachedEmbeddedOrigIndex: 0,
      timePrecision: 'start_only',
    }
    const a = tankestromPersistFingerprint({
      date: '2026-06-13',
      start: '08:35',
      end: '09:35',
      title: 'Vårcupen – lørdag',
      personId: 'child-1',
      metadata: meta,
    })
    const b = tankestromPersistFingerprint({
      date: '2026-06-13',
      start: '08:35',
      end: '09:35',
      title: 'vårcupen – lørdag',
      personId: 'child-1',
      metadata: meta,
    })
    expect(a).toBe(b)
  })

  it('matcher eksisterende rad på integration.proposalId', () => {
    const existing: Event = {
      id: 'ev-1',
      personId: 'c1',
      title: 'Test',
      start: '08:35',
      end: '09:35',
      metadata: {
        integration: { proposalId: 'ts-emb:parent:0' },
        arrangementBlockGroupId: 'g',
      },
    }
    const hit = findTankestromPersistDuplicateInAnchors(
      [{ event: existing, anchorDate: '2026-06-13' }],
      {
        date: '2026-06-13',
        start: '10:00',
        end: '11:00',
        title: 'Annen',
        personId: 'c2',
        metadata: {},
      },
      'ts-emb:parent:0'
    )
    expect(hit?.event.id).toBe('ev-1')
  })
})
