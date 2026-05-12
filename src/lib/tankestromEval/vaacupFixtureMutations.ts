/**
 * Deterministiske mutasjoner mot kanonisk Vårcupen embeddedSchedule (eval + soak).
 * Endrer ikke produksjonslogikk — brukes kun i tester og eval-runner.
 */
import type { EmbeddedScheduleSegment, EventMetadata } from '../../types'

export type VaacupMutationKind =
  | 'noop'
  | 'fredag_drop_oppmote_highlight'
  | 'fredag_segment_start_18_40'
  | 'lordag_mislabel_kamp_as_oppmote'
  | 'lordag_first_kamp_at_second_slot'
  | 'sondag_leak_1745_oppmote'
  | 'sondag_synthetic_oppmote_label'
  | 'fredag_drop_all_highlights'

export type VaacupMutation = { kind: VaacupMutationKind; segments: EmbeddedScheduleSegment[] }

export function buildCanonicalVaacupSegments(): EmbeddedScheduleSegment[] {
  return [
    {
      date: '2026-06-12',
      title: 'Fredag',
      start: '17:45',
      end: '19:00',
      notes: 'Oppmøte kl. 17:45 ved kunstgressbanen. Første kamp starter 18:40.',
      tankestromHighlights: [
        { time: '17:45', label: 'Oppmøte', type: 'meeting' },
        { time: '18:40', label: 'Første kamp', type: 'match' },
      ],
    },
    {
      date: '2026-06-13',
      title: 'Lørdag',
      start: '08:35',
      end: '16:00',
      notes:
        'Oppmøte før første kamp kl. 08:35. Første kamp 09:20. Oppmøte før andre kamp 14:25. Andre kamp 15:10.',
      tankestromHighlights: [
        { time: '08:35', label: 'Oppmøte før første kamp', type: 'meeting' },
        { time: '09:20', label: 'Første kamp', type: 'match' },
        { time: '14:25', label: 'Oppmøte før andre kamp', type: 'meeting' },
        { time: '15:10', label: 'Andre kamp', type: 'match' },
      ],
    },
    {
      date: '2026-06-14',
      title: 'Søndag',
      isConditional: true,
      notes: 'Program for søndag avhenger av plassering etter lørdagens kamper.',
      tankestromHighlights: [],
    },
  ]
}

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export function applyVaacupMutation(seed: number, base: EmbeddedScheduleSegment[]): VaacupMutation {
  const rng = mulberry32(seed)
  const r = rng()
  const segments = clone(base)
  if (r < 0.1) return { kind: 'noop', segments }
  if (r < 0.25) {
    const fre = segments.find((s) => s.date === '2026-06-12')
    if (fre?.tankestromHighlights) {
      fre.tankestromHighlights = fre.tankestromHighlights.filter((h) => h.time !== '17:45')
    }
    return { kind: 'fredag_drop_oppmote_highlight', segments }
  }
  if (r < 0.35) {
    const fre = segments.find((s) => s.date === '2026-06-12')
    if (fre) {
      fre.start = '18:40'
      if (fre.tankestromHighlights) fre.tankestromHighlights = []
    }
    return { kind: 'fredag_segment_start_18_40', segments }
  }
  if (r < 0.5) {
    const lor = segments.find((s) => s.date === '2026-06-13')
    if (lor?.tankestromHighlights) {
      lor.tankestromHighlights = [
        { time: '08:35', label: 'Oppmøte før første kamp', type: 'meeting' },
        { time: '09:20', label: 'Oppmøte', type: 'meeting' },
        { time: '14:25', label: 'Oppmøte', type: 'meeting' },
        { time: '15:10', label: 'Første kamp', type: 'match' },
      ]
    }
    return { kind: 'lordag_mislabel_kamp_as_oppmote', segments }
  }
  if (r < 0.6) {
    const lor = segments.find((s) => s.date === '2026-06-13')
    if (lor?.tankestromHighlights) {
      lor.tankestromHighlights = lor.tankestromHighlights.map((h) =>
        h.time === '15:10' ? { ...h, label: 'Første kamp', type: 'match' } : h
      )
    }
    return { kind: 'lordag_first_kamp_at_second_slot', segments }
  }
  if (r < 0.75) {
    const son = segments.find((s) => s.date === '2026-06-14')
    if (son) {
      son.start = '17:45'
      son.tankestromHighlights = [{ time: '17:45', label: 'Oppmøte', type: 'meeting' }]
    }
    return { kind: 'sondag_leak_1745_oppmote', segments }
  }
  if (r < 0.85) {
    const son = segments.find((s) => s.date === '2026-06-14')
    if (son) {
      son.notes = 'Oppmøte sannsynligvis sent på dagen.'
      son.tankestromHighlights = [{ time: '17:00', label: 'Oppmøte', type: 'meeting' }]
    }
    return { kind: 'sondag_synthetic_oppmote_label', segments }
  }
  const fre = segments.find((s) => s.date === '2026-06-12')
  if (fre) fre.tankestromHighlights = []
  return { kind: 'fredag_drop_all_highlights', segments }
}

export function buildMetadataFromVaacupSegments(segments: EmbeddedScheduleSegment[]): EventMetadata {
  return { isArrangementParent: true, embeddedSchedule: segments } as unknown as EventMetadata
}
