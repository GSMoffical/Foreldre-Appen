import { describe, expect, it, vi } from 'vitest'
import type { Event } from '../../types'
import {
  cleanupParallelClusterDayRowsAfterEmbeddedParentUpdate,
  isLikelyPriorTankestromEmbeddedDayRow,
} from '../tankestromExistingEventClusterCleanup'

describe('cleanupParallelClusterDayRowsAfterEmbeddedParentUpdate', () => {
  it('sletter parallelle dag-rader med samme arrangementskjerne og Tankestrøm-spor på programdatoer', async () => {
    const deleted: string[] = []
    const deleteEvent = vi.fn(async (_date: string, eventId: string) => {
      deleted.push(eventId)
    })

    const anchorId = 'anchor-1'
    const satId = 'sat-1'

    const anchor: Event = {
      id: anchorId,
      personId: 'child-1',
      title: 'Vårcupen – fredag',
      start: '10:00',
      end: '12:00',
      metadata: { integration: { proposalId: 'x' } },
    }
    const saturday: Event = {
      id: satId,
      personId: 'child-1',
      title: 'Vårcupen – lørdag',
      start: '09:00',
      end: '11:00',
      metadata: { integration: { proposalId: 'y' } },
    }

    await cleanupParallelClusterDayRowsAfterEmbeddedParentUpdate({
      deleteEvent,
      getAnchoredForegroundEventsForMatching: () => [
        { event: anchor, anchorDate: '2026-06-12' },
        { event: saturday, anchorDate: '2026-06-13' },
      ],
      anchorEventId: anchorId,
      importParentTitleRaw: 'Vårcupen 2026',
      importPersonId: 'child-1',
      programDates: ['2026-06-12', '2026-06-13'],
    })

    expect(deleted).toEqual([satId])
    expect(deleteEvent).toHaveBeenCalledTimes(1)
    expect(deleteEvent).toHaveBeenCalledWith('2026-06-13', satId)
  })

  it('sletter ikke anker-rad eller rader utenfor programdatoer', async () => {
    const deleteEvent = vi.fn(async () => {})

    const anchorId = 'anchor-1'
    const sundayId = 'sun-1'

    const anchor: Event = {
      id: anchorId,
      personId: 'child-1',
      title: 'Vårcupen – fredag',
      start: '10:00',
      end: '12:00',
      metadata: { integration: {} },
    }
    const sunday: Event = {
      id: sundayId,
      personId: 'child-1',
      title: 'Vårcupen – søndag',
      start: '09:00',
      end: '11:00',
      metadata: { integration: {} },
    }

    await cleanupParallelClusterDayRowsAfterEmbeddedParentUpdate({
      deleteEvent,
      getAnchoredForegroundEventsForMatching: () => [
        { event: anchor, anchorDate: '2026-06-12' },
        { event: sunday, anchorDate: '2026-06-14' },
      ],
      anchorEventId: anchorId,
      importParentTitleRaw: 'Vårcupen 2026',
      importPersonId: 'child-1',
      programDates: ['2026-06-12', '2026-06-13'],
    })

    expect(deleteEvent).not.toHaveBeenCalled()
  })

  it('sletter ikke rader uten Tankestrøm-spor (manuell hendelse)', async () => {
    const deleteEvent = vi.fn(async () => {})

    const anchorId = 'a'
    const manualId = 'm'

    const anchor: Event = {
      id: anchorId,
      personId: 'child-1',
      title: 'Vårcupen – fredag',
      start: '10:00',
      end: '12:00',
      metadata: { integration: {} },
    }
    const manual: Event = {
      id: manualId,
      personId: 'child-1',
      title: 'Vårcupen – lørdag',
      start: '09:00',
      end: '11:00',
      metadata: {},
    }

    await cleanupParallelClusterDayRowsAfterEmbeddedParentUpdate({
      deleteEvent,
      getAnchoredForegroundEventsForMatching: () => [
        { event: anchor, anchorDate: '2026-06-12' },
        { event: manual, anchorDate: '2026-06-13' },
      ],
      anchorEventId: anchorId,
      importParentTitleRaw: 'Vårcupen 2026',
      importPersonId: 'child-1',
      programDates: ['2026-06-12', '2026-06-13'],
    })

    expect(deleteEvent).not.toHaveBeenCalled()
  })
})

describe('isLikelyPriorTankestromEmbeddedDayRow', () => {
  it('returnerer true for integration eller detachedFromEmbeddedParentId', () => {
    expect(
      isLikelyPriorTankestromEmbeddedDayRow({
        id: '1',
        personId: 'c',
        title: 'x',
        start: '10:00',
        end: '11:00',
        metadata: { integration: {} },
      })
    ).toBe(true)
    expect(
      isLikelyPriorTankestromEmbeddedDayRow({
        id: '1',
        personId: 'c',
        title: 'x',
        start: '10:00',
        end: '11:00',
        metadata: { detachedFromEmbeddedParentId: 'p' },
      })
    ).toBe(true)
  })
})
