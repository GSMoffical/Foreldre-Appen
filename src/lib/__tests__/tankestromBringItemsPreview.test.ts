import { describe, expect, it } from 'vitest'
import {
  normalizeTankestromScheduleDetails,
  partitionTankestromBringItemsForPreview,
  readTankestromScheduleDetailsFromMetadata,
} from '../tankestromScheduleDetails'
import type { EventMetadata } from '../../types'
import { buildEventDraftFromProposal } from '../../features/tankestrom/useTankestromImport'
import type { PortalEventProposal } from '../../features/tankestrom/types'
import type { Person } from '../../types'

describe('partitionTankestromBringItemsForPreview', () => {
  it('skjuler «utstyr» alene', () => {
    const { concreteBring, divertToNotes } = partitionTankestromBringItemsForPreview(['utstyr', 'regnjakke'])
    expect(concreteBring).toEqual(['regnjakke'])
    expect(divertToNotes).toEqual([])
  })

  it('sender foreldrelogistikk til notater, ikke ta med', () => {
    const { concreteBring, divertToNotes } = partitionTankestromBringItemsForPreview([
      'foreldre kan bidra med samlingspunkt',
      'matpakke',
    ])
    expect(concreteBring).toEqual(['matpakke'])
    expect(divertToNotes.some((l) => /samlingspunkt|foreldre/i.test(l))).toBe(true)
  })

  it('beholder konkrete klær, mat, sko og utstyr (cup-lignende liste)', () => {
    const cupLike = [
      'mat og drikke',
      'regnjakke',
      'ekstra sokker',
      'overtrekksbukse',
      'leggskyttere',
      'drikkeflaske',
      'matpakke',
      'ekstra energi',
      'rød klubbgenser',
      'sort shorts',
      'røde strømper',
      'begge typer sko',
    ]
    const { concreteBring, divertToNotes } = partitionTankestromBringItemsForPreview(cupLike)
    expect(divertToNotes).toEqual([])
    for (const line of cupLike) {
      expect(concreteBring).toContain(line)
    }
  })

  it('beholder valgfri men konkret formulering', () => {
    const { concreteBring } = partitionTankestromBringItemsForPreview([
      'arbeidshansker om du har',
    ])
    expect(concreteBring).toEqual(['arbeidshansker om du har'])
  })
})

describe('normalizeTankestromScheduleDetails (Husk/ta med)', () => {
  it('tom Husk/ta med når kun generisk og logistikk — seksjonen forsvinner i UI', () => {
    const out = normalizeTankestromScheduleDetails({
      highlights: [{ time: '17:45', label: 'Oppmøte', type: 'meeting' }],
      notes: [],
      bringItems: ['utstyr', 'foreldre kan bidra med samlingspunkt'],
      titleContext: ['Cup – fredag'],
    })
    expect(out.bringItems).toEqual([])
    expect(out.notes.some((n) => /foreldre kan bidra|samlingspunkt/i.test(n))).toBe(true)
    expect(out.highlights.length).toBeGreaterThan(0)
  })

  it('enkelt import-lignende metadata: konkrete ting beholdes', () => {
    const metadata: EventMetadata = {
      tankestromHighlights: [{ time: '10:00', label: 'Aktivitet', type: 'other' }],
      tankestromNotes: ['Husk drikkeflaske.'],
      bringItems: ['matpakke', 'ekstra genser'],
    }
    const out = readTankestromScheduleDetailsFromMetadata(metadata, ['Skoledag'])
    expect(out.bringItems).toContain('matpakke')
    expect(out.bringItems).toContain('ekstra genser')
    expect(out.bringItems).not.toContain('utstyr')
  })
})

describe('buildEventDraftFromProposal (enkelt event, ikke delprogram)', () => {
  const people: Person[] = [
    { id: 'p1', name: 'Test', colorTint: 'bg-slate-200', colorAccent: 'border-slate-400', memberKind: 'child' },
  ]

  it('metadata bringItems påvirkes ikke negativt av filter når punktene er konkrete', () => {
    const p: PortalEventProposal = {
      proposalId: 'e1',
      kind: 'event',
      sourceId: 's',
      originalSourceType: 'test',
      confidence: 1,
      event: {
        date: '2026-06-12',
        start: '10:00',
        end: '11:00',
        title: 'Turnering',
        personId: 'p1',
        notes: 'Se e-post.',
        metadata: {
          bringItems: ['drikkeflaske', 'matpakke'],
        },
      },
    }
    const draft = buildEventDraftFromProposal(p, new Set(['p1']), people, 'p1')
    expect(draft.notes).toBe('Se e-post.')
    const out = readTankestromScheduleDetailsFromMetadata(
      { ...(p.event.metadata as EventMetadata), tankestromNotes: [], tankestromHighlights: [] },
      [draft.title]
    )
    expect(out.bringItems).toEqual(['drikkeflaske', 'matpakke'])
  })
})
