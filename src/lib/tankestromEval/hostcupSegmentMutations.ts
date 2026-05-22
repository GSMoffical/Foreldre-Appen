/**
 * Deterministiske segment-mutasjoner på Høstcup embeddedSchedule (sammen med tekstvarianter).
 */
import type { EmbeddedScheduleSegment, EventMetadata } from '../../types'

export type HostcupSegmentMutationKind =
  | 'noop'
  | 'fri_drop_segment_end'
  | 'fri_segment_end_2359'
  | 'fri_start_1815_only'
  | 'fri_drop_highlights'
  | 'lor_drop_segment_end'
  | 'lor_segment_end_2359'
  | 'lor_drop_oppmote_highlights'
  | 'lor_mislabel_0900_oppmote'
  | 'son_confirmed_times'
  | 'son_leak_fri_1730'

export type HostcupSegmentMutation = {
  kind: HostcupSegmentMutationKind
  description: string
  segments: EmbeddedScheduleSegment[]
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export function buildCanonicalHostcupSegments(): EmbeddedScheduleSegment[] {
  return [
    {
      date: '2026-09-18',
      title: 'Fredag',
      start: '17:30',
      end: '19:00',
      tankestromHighlights: [
        { time: '17:30', label: 'Oppmøte', type: 'meeting' },
        { time: '18:15', label: 'Første kamp', type: 'match' },
      ],
      notes: 'Sjekk værmelding og kle dere etter været. Foreldre hjelper med rydding etter siste kamp.',
      bringItems: ['drikkeflaske', 'matpakke', 'ekstra t-skjorte'],
    },
    {
      date: '2026-09-19',
      title: 'Lørdag',
      start: '08:20',
      end: '16:00',
      tankestromHighlights: [
        { time: '08:20', label: 'Oppmøte før første kamp', type: 'meeting' },
        { time: '09:00', label: 'Første kamp', type: 'match' },
        { time: '13:55', label: 'Oppmøte før andre kamp', type: 'meeting' },
        { time: '14:40', label: 'Andre kamp', type: 'match' },
      ],
      notes: 'Laget spiser felles lunsj mellom kampene. Foreldre hjelper med rydding etter siste kamp.',
      bringItems: ['drikkeflaske', 'matpakke', 'ekstra klær'],
    },
    {
      date: '2026-09-20',
      title: 'Søndag',
      isConditional: true,
      notes:
        'Sluttspill avhenger av plassering etter lørdagens kamper. Tidspunkt for eventuell kamp er ikke endelig avklart.',
      bringItems: ['drikkeflaske', 'matpakke', 'ekstra t-skjorte'],
      tankestromHighlights: [],
    },
  ]
}

export function applyHostcupSegmentMutation(kind: HostcupSegmentMutationKind): HostcupSegmentMutation {
  const segments = clone(buildCanonicalHostcupSegments())
  const fri = segments.find((s) => s.date === '2026-09-18')!
  const lor = segments.find((s) => s.date === '2026-09-19')!
  const son = segments.find((s) => s.date === '2026-09-20')!

  switch (kind) {
    case 'noop':
      return { kind, description: 'Uendret canonical segmenter', segments }
    case 'fri_drop_segment_end':
      delete fri.end
      return { kind, description: 'Fredag: fjern segment.end', segments }
    case 'fri_segment_end_2359':
      fri.end = '23:59'
      return { kind, description: 'Fredag: bred segment.end 23:59', segments }
    case 'fri_start_1815_only':
      fri.start = '18:15'
      fri.tankestromHighlights = fri.tankestromHighlights?.filter((h) => h.time !== '17:30')
      return { kind, description: 'Fredag: start=18:15, drop 17:30 highlight', segments }
    case 'fri_drop_highlights':
      fri.tankestromHighlights = []
      return { kind, description: 'Fredag: tom highlight-liste', segments }
    case 'lor_drop_segment_end':
      delete lor.end
      return { kind, description: 'Lørdag: fjern segment.end', segments }
    case 'lor_segment_end_2359':
      lor.end = '23:59'
      return { kind, description: 'Lørdag: bred segment.end 23:59', segments }
    case 'lor_drop_oppmote_highlights':
      lor.tankestromHighlights = lor.tankestromHighlights?.filter((h) => !/oppm/i.test(h.label)) ?? []
      return { kind, description: 'Lørdag: kun kamp-highlights i JSON', segments }
    case 'lor_mislabel_0900_oppmote':
      lor.tankestromHighlights = lor.tankestromHighlights?.map((h) =>
        h.time === '09:00' ? { ...h, label: 'Oppmøte', type: 'meeting' } : h
      )
      return { kind, description: 'Lørdag: 09:00 feillabel Oppmøte', segments }
    case 'son_confirmed_times':
      son.isConditional = false
      son.start = '10:30'
      son.end = '12:00'
      son.tankestromHighlights = [
        { time: '10:30', label: 'Oppmøte', type: 'meeting' },
        { time: '11:15', label: 'Kamp', type: 'match' },
      ]
      return { kind, description: 'Søndag: bekreftede tider i segment', segments }
    case 'son_leak_fri_1730':
      son.tankestromHighlights = [{ time: '17:30', label: 'Oppmøte', type: 'meeting' }]
      son.start = '17:30'
      return { kind, description: 'Søndag: lekkasje fredag 17:30 i highlights', segments }
    default:
      return { kind: 'noop', description: 'fallback', segments }
  }
}

export const HOSTCUP_SEGMENT_MUTATION_KINDS: HostcupSegmentMutationKind[] = [
  'noop',
  'fri_drop_segment_end',
  'fri_segment_end_2359',
  'fri_start_1815_only',
  'fri_drop_highlights',
  'lor_drop_segment_end',
  'lor_segment_end_2359',
  'lor_drop_oppmote_highlights',
  'lor_mislabel_0900_oppmote',
  'son_confirmed_times',
  'son_leak_fri_1730',
]

export function buildMetadataFromHostcupSegments(segments: EmbeddedScheduleSegment[]): EventMetadata {
  return {
    isArrangementParent: true,
    exportAsCalendarEvent: false,
    endDate: '2026-09-20',
    embeddedSchedule: segments,
  } as unknown as EventMetadata
}
