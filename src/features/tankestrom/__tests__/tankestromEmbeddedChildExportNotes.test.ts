import { describe, expect, it } from 'vitest'
import type { EmbeddedScheduleSegment, Person } from '../../../types'
import { parseEmbeddedScheduleFromMetadata } from '../../../lib/embeddedSchedule'
import { buildEventDraftFromProposal, composeEmbeddedChildCalendarNotesForExport } from '../useTankestromImport'
import type { PortalEventProposal } from '../types'

const peopleChild: Person[] = [
  { id: 'p1', name: 'Test', colorTint: 'bg-slate-200', colorAccent: 'border-slate-400', memberKind: 'child' },
]

describe('composeEmbeddedChildCalendarNotesForExport (delprogram)', () => {
  const parentTitle = 'Vårcup 2026'
  const parentNotes = [
    'Generelt: alle spillere møter i full drakt.',
    'PAKKELISTE FOR ALLE DAGER: flaske, ball, underskjorte.',
    'Lørdag: kl. 09:00 seriestart og kl. 15:00 kamp to.',
    'Søndag: kl. 10:00 finale og premieutdeling.',
  ].join('\n')

  const fridaySeg: EmbeddedScheduleSegment = {
    date: '2026-06-12',
    title: 'Vårcup – fredag',
    start: '17:45',
    end: '18:40',
    tankestromNotes: ['Oppmøte ved banen 17:45', 'Første kamp 18:40'],
    tankestromHighlights: [{ time: '18:40', label: 'Kamp G12', type: 'match' }],
  }

  const saturdaySeg: EmbeddedScheduleSegment = {
    date: '2026-06-13',
    title: 'Vårcup – lørdag',
    start: '09:00',
    end: '15:00',
    tankestromNotes: ['Seriestart 09:00', 'Andre kamp 15:00'],
    tankestromHighlights: [
      { time: '09:00', label: 'Seriestart', type: 'match' },
      { time: '15:00', label: 'Kamp to', type: 'match' },
    ],
  }

  const sundaySeg: EmbeddedScheduleSegment = {
    date: '2026-06-14',
    title: 'Vårcup – søndag',
    start: '10:00',
    end: '12:00',
    tankestromNotes: ['Finale 10:00', 'Premieutdeling etter siste kamp'],
    tankestromHighlights: [{ time: '10:00', label: 'Finale', type: 'match' }],
  }

  it('fredag: inneholder dagsprogram, ikke lørdag/søndag eller hel pakkeliste', () => {
    const notes = composeEmbeddedChildCalendarNotesForExport(parentTitle, parentNotes, fridaySeg, {
      childProposalId: 'child-fri',
    })
    expect(notes).toMatch(/(?:Oppmøte ved banen.*17:45|17:45.*Oppmøte ved banen)/i)
    expect(notes).toMatch(/18:40.*Kamp G12|Kamp G12/i)
    expect(notes).not.toMatch(/seriestart/i)
    expect(notes).not.toMatch(/15:00 kamp to/i)
    expect(notes).not.toMatch(/finale/i)
    expect(notes).not.toMatch(/premieutdeling/i)
    expect(notes).not.toMatch(/PAKKELISTE FOR ALLE DAGER/i)
  })

  it('lørdag: inneholder ikke fredag eller søndag program', () => {
    const notes = composeEmbeddedChildCalendarNotesForExport(parentTitle, parentNotes, saturdaySeg)
    expect(notes).toMatch(/Seriestart|09:00/i)
    expect(notes).toMatch(/15:00|Kamp to/i)
    expect(notes).not.toMatch(/Oppmøte ved banen 17:45/i)
    expect(notes).not.toMatch(/finale/i)
    expect(notes).not.toMatch(/premieutdeling/i)
  })

  it('søndag: inneholder finale, ikke fredags oppmøte', () => {
    const notes = composeEmbeddedChildCalendarNotesForExport(parentTitle, parentNotes, sundaySeg)
    expect(notes).toMatch(/finale/i)
    expect(notes).not.toMatch(/Oppmøte ved banen 17:45/i)
    expect(notes).not.toMatch(/seriestart/i)
  })

  it('uten dagsinnhold: faller tilbake til merket fellesinfo (ikke stille ukritisk kopiering)', () => {
    const emptyChild: EmbeddedScheduleSegment = {
      date: '2026-06-12',
      title: 'Vårcup – fredag',
      start: '17:45',
      end: '18:40',
    }
    const notes = composeEmbeddedChildCalendarNotesForExport(parentTitle, parentNotes, emptyChild)
    expect(notes).toMatch(/Felles info fra arrangementet/)
    expect(notes).toMatch(/PAKKELISTE FOR ALLE DAGER/i)
  })

  it('metadata dayContent → parse → export-notater er dagsbegrenset', () => {
    const segments = parseEmbeddedScheduleFromMetadata({
      embeddedSchedule: [
        {
          date: '2026-06-12',
          title: 'Fredag',
          start: '17:45',
          end: '18:40',
          dayContent: {
            generalNotes: ['Fredag: møt opp 17:45 ved felt B'],
            highlights: ['18:40 Første kamp'],
          },
        },
        {
          date: '2026-06-13',
          title: 'Lørdag',
          start: '09:00',
          end: '16:00',
          dayContent: {
            generalNotes: ['Lørdag: turnering 09:00–16:00'],
            highlights: ['09:00 Oppstart'],
          },
        },
      ] as unknown as EmbeddedScheduleSegment[],
    })
    const fri = segments.find((s) => s.date === '2026-06-12')
    const sat = segments.find((s) => s.date === '2026-06-13')
    expect(fri).toBeDefined()
    expect(sat).toBeDefined()
    const friNotes = composeEmbeddedChildCalendarNotesForExport(parentTitle, parentNotes, fri!)
    const satNotes = composeEmbeddedChildCalendarNotesForExport(parentTitle, parentNotes, sat!)
    expect(friNotes).toMatch(/17:45|felt B/i)
    expect(friNotes).not.toMatch(/Lørdag: turnering/i)
    expect(friNotes).not.toMatch(/09:00–16:00/i)
    expect(satNotes).toMatch(/Lørdag: turnering|09:00/i)
    expect(satNotes).not.toMatch(/felt B/i)
  })
})

describe('buildEventDraftFromProposal (enkelt hendelse uten embeddedSchedule)', () => {
  it('bevarer notes som før', () => {
    const p: PortalEventProposal = {
      proposalId: 'e1',
      kind: 'event',
      confidence: 1,
      originalSourceType: 'test',
      sourceId: 's',
      externalRef: undefined,
      event: {
        date: '2026-06-12',
        start: '10:00',
        end: '11:00',
        title: 'Skoledag',
        notes: 'Husk gymklær.',
        personId: 'p1',
        location: '',
        metadata: {},
      },
    }
    const draft = buildEventDraftFromProposal(p, new Set(['p1']), peopleChild, 'p1')
    expect(draft.notes).toBe('Husk gymklær.')
  })
})
