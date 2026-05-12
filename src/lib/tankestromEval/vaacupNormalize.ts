import { readTankestromScheduleDetailsFromMetadata } from '../tankestromScheduleDetails'
import type { VaacupNormalizedDay } from '../tankestromVaacupInvariants'
import { dayKeyFromDateForVaacup } from '../tankestromVaacupInvariants'
import type { EventMetadata } from '../../types'
import { parseEmbeddedScheduleFromMetadata } from '../embeddedSchedule'

export function normalizeVaacupDaysFromEmbeddedMetadata(metadata: EventMetadata): VaacupNormalizedDay[] {
  const parsed = parseEmbeddedScheduleFromMetadata(metadata)
  const days: VaacupNormalizedDay[] = []
  for (const seg of parsed) {
    const dayKey = dayKeyFromDateForVaacup(seg.date)
    if (!dayKey) continue
    const segMetadata: EventMetadata = {
      tankestromHighlights: seg.tankestromHighlights,
      tankestromNotes: seg.tankestromNotes,
      bringItems: seg.bringItems,
      packingItems: seg.packingItems,
      timeWindowCandidates: seg.timeWindowCandidates,
    }
    const normalized = readTankestromScheduleDetailsFromMetadata(segMetadata, [seg.title], {
      fallbackStartTime: seg.start,
      sourceTextForValidation: seg.notes,
      isConditionalSegment: seg.isConditional === true,
    })
    days.push({
      date: seg.date,
      dayKey,
      highlights: normalized.highlights,
      notes: normalized.notes,
      start: seg.start,
      end: seg.end,
      isConditional: seg.isConditional,
    })
  }
  return days
}

export type EvalEmbeddedDaySnapshot = {
  date: string
  title: string
  highlights: { time: string; label: string; type?: string }[]
  notes: string[]
  isConditional?: boolean
}

/** Generisk normalisering av alle embeddedSchedule-rader (brukes av Høstcup-eval m.m.). */
export function normalizeEmbeddedScheduleDaySnapshots(metadata: EventMetadata): EvalEmbeddedDaySnapshot[] {
  const parsed = parseEmbeddedScheduleFromMetadata(metadata)
  const out: EvalEmbeddedDaySnapshot[] = []
  for (const seg of parsed) {
    const segMetadata: EventMetadata = {
      tankestromHighlights: seg.tankestromHighlights,
      tankestromNotes: seg.tankestromNotes,
      bringItems: seg.bringItems,
      packingItems: seg.packingItems,
      timeWindowCandidates: seg.timeWindowCandidates,
    }
    const normalized = readTankestromScheduleDetailsFromMetadata(segMetadata, [seg.title], {
      fallbackStartTime: seg.start,
      sourceTextForValidation: typeof seg.notes === 'string' ? seg.notes : undefined,
      isConditionalSegment: seg.isConditional === true,
    })
    out.push({
      date: seg.date,
      title: seg.title,
      highlights: normalized.highlights,
      notes: normalized.notes,
      isConditional: seg.isConditional,
    })
  }
  return out
}
