import { describe, expect, it } from 'vitest'
import type { EmbeddedScheduleSegment } from '../../types'
import { resolveCanonicalEmbeddedChildExportTimes } from '../tankestromCanonicalPreview'
import { buildEmbeddedChildCanonicalPreview } from '../tankestromCanonicalPreview'
import {
  resolveTankestromApiInferredEnd,
  readTankestromSegmentDurationFacts,
  segmentHasTrustedApiEnd,
} from '../tankestromSegmentDurationFacts'
import { normalizeTankestromScheduleDetails } from '../tankestromScheduleDetails'

function minimalPreviewForSegment(
  segment: EmbeddedScheduleSegment,
  highlights: Array<{ time: string; label: string }>
) {
  const normalized = normalizeTankestromScheduleDetails({ highlights, notes: [] })
  return buildEmbeddedChildCanonicalPreview(segment, 'Høstcup', segment.title, 'child-0', {
    normalizeDetails: () => normalized,
    originalImportText: 'Fredag spiller vi første kamp kl. 17:30. Oppmøte 50 min før.',
  })
}

describe('tankestromSegmentDurationFacts', () => {
  it('computed_from_duration uten buffer er ikke trusted API', () => {
    const seg: EmbeddedScheduleSegment = {
      date: '2026-09-19',
      title: 'Lørdag',
      start: '08:30',
      endTimeSource: 'computed_from_duration',
    }
    expect(segmentHasTrustedApiEnd(readTankestromSegmentDurationFacts(seg))).toBe(false)
    expect(
      resolveTankestromApiInferredEnd(seg, '08:30', { latestConfirmedHighlightHm: '14:40' })
    ).toBeNull()
  })

  it('leser duration-felt fra segment', () => {
    const seg: EmbeddedScheduleSegment = {
      date: '2026-09-18',
      title: 'Fredag',
      start: '10:00',
      end: '18:45',
      inferredEndTime: true,
      endTimeSource: 'computed_from_duration_and_aftertime',
      activityDurationMinutes: 45,
      afterBufferMinutes: 30,
      timePrecision: 'start_only',
    }
    expect(readTankestromSegmentDurationFacts(seg)).toMatchObject({
      inferredEndTime: true,
      endTimeSource: 'computed_from_duration_and_aftertime',
      activityDurationMinutes: 45,
      afterBufferMinutes: 30,
      timePrecision: 'start_only',
    })
  })

  it('API inferred end: bruker segment.end når evidence finnes', () => {
    const seg: EmbeddedScheduleSegment = {
      date: '2026-09-18',
      title: 'Fredag',
      start: '10:00',
      end: '18:45',
      inferredEndTime: true,
      endTimeSource: 'computed_from_duration_and_aftertime',
      activityDurationMinutes: 45,
      afterBufferMinutes: 30,
    }
    const api = resolveTankestromApiInferredEnd(seg, '16:40', { latestConfirmedHighlightHm: '17:30' })
    expect(api).toMatchObject({
      end: '18:45',
      endTimeSource: 'computed_from_duration_and_aftertime',
      inferredEndTime: true,
    })
  })

  it('API inferred end: beregner fra varighetsfelt når end mangler', () => {
    const seg: EmbeddedScheduleSegment = {
      date: '2026-09-18',
      title: 'Fredag',
      start: '10:00',
      inferredEndTime: true,
      endTimeSource: 'computed_from_duration',
      activityDurationMinutes: 45,
      afterBufferMinutes: 30,
    }
    const api = resolveTankestromApiInferredEnd(seg, '16:40', { latestConfirmedHighlightHm: '17:30' })
    expect(api?.end).toBe('18:45')
  })

  it('canonical: API før lokal fallback', () => {
    const seg: EmbeddedScheduleSegment = {
      date: '2026-09-18',
      title: 'Fredag',
      start: '10:00',
      end: '18:45',
      inferredEndTime: true,
      endTimeSource: 'computed_from_duration_and_aftertime',
      activityDurationMinutes: 45,
      afterBufferMinutes: 30,
      tankestromHighlights: [
        { time: '16:40', label: 'Oppmøte', type: 'meeting' },
        { time: '17:30', label: 'Første kamp', type: 'match' },
      ],
    }
    const preview = minimalPreviewForSegment(seg, [
      { time: '16:40', label: 'Oppmøte' },
      { time: '17:30', label: 'Første kamp' },
    ])
    const times = resolveCanonicalEmbeddedChildExportTimes(preview, seg)
    expect(times.start).toBe('16:40')
    expect(times.end).toBe('18:45')
    expect(times.endTimeProvenance).toBe('api_inferred_end')
    expect(times.endTimeSource).toBe('computed_from_duration_and_aftertime')
  })

  it('canonical: lokal fallback når API mangler duration-felt', () => {
    const seg: EmbeddedScheduleSegment = {
      date: '2026-09-18',
      title: 'Fredag',
      start: '10:00',
      tankestromHighlights: [
        { time: '16:40', label: 'Oppmøte', type: 'meeting' },
        { time: '17:30', label: 'Første kamp', type: 'match' },
      ],
    }
    const preview = minimalPreviewForSegment(seg, [
      { time: '16:40', label: 'Oppmøte' },
      { time: '17:30', label: 'Første kamp' },
    ])
    const times = resolveCanonicalEmbeddedChildExportTimes(preview, seg)
    expect(times.start).toBe('16:40')
    expect(times.end).toBe('18:45')
    expect(times.endTimeProvenance).toBe('frontend_canonical_fallback')
    expect(times.endTimeSource).toBe('frontend_canonical_fallback')
    expect(times.inferredEndTime).toBe(true)
  })
})
