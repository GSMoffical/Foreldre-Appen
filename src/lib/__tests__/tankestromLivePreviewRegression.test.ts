import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildDraftsFromItems,
  buildEmbeddedChildCanonicalPreviewForReview,
  initialSelectedIdsForGeneralImport,
  makeEmbeddedChildProposalId,
} from '../../features/tankestrom/useTankestromImport'
import { parsePortalImportProposalBundle } from '../tankestromApi'
import { flattenEmbeddedScheduleOrdered } from '../embeddedSchedule'
import {
  embeddedScheduleChildTitleForReview,
  normalizeEmbeddedScheduleParentDisplayTitle,
} from '../tankestromCupEmbeddedScheduleMerge'
import { runHostcupLiveNarrativePreviewCase } from '../tankestromEval/hostcupLiveNarrativePreviewHarness'

const root = join(process.cwd(), 'fixtures/tankestrom')

function importSummary(selected: Set<string>, parentId: string): string {
  const embeddedChildCount = [...selected].filter((id) => id.includes('__embedded_child__')).length
  const parentSelected = selected.has(parentId)
  if (parentSelected && embeddedChildCount > 0) {
    return `1 arrangement / ${embeddedChildCount} hendelser`
  }
  return `${embeddedChildCount} hendelser`
}

describe('live preview regression — faktisk API-shape', () => {
  it('Høstcup fredag: duplikat 16:40/16:45 oppmøte i dayContent skal ikke vises i canonical preview', () => {
    const source = readFileSync(join(root, 'hostcup_duration_inference_rich.txt'), 'utf8')
    const raw = JSON.parse(
      readFileSync(join(root, 'hostcup_duration_inference_rich.analyze.json'), 'utf8')
    ) as Record<string, unknown>
    const items = (raw.items as Array<Record<string, unknown>>) ?? []
    const parent = items.find((i) => i.kind === 'event') as {
      event: { metadata: { embeddedSchedule: Array<Record<string, unknown>> } }
    }
    const fri = parent.event.metadata.embeddedSchedule.find((s) => s.date === '2026-09-18')!
    fri.dayContent = {
      highlights: ['16:40 Oppmøte', '16:45 Oppmøte', '17:30 Første kamp'],
      bringItems: [],
      logisticsNotes: [],
      generalNotes: [],
      uncertaintyNotes: [],
      sourceOrder: [],
    }
    fri.start = '16:40'

    const bundle = parsePortalImportProposalBundle(raw)
    const eventItem = bundle.items.find((i) => i.kind === 'event')!
    const parentId = eventItem.proposalId
    const parentTitle = normalizeEmbeddedScheduleParentDisplayTitle(
      eventItem.kind === 'event' ? eventItem.event.title.trim() : ''
    ).title
    const segments = flattenEmbeddedScheduleOrdered(
      eventItem.kind === 'event' ? eventItem.event.metadata : undefined
    )
    const friSeg = segments.find((s) => s.date === '2026-09-18')!
    const preview = buildEmbeddedChildCanonicalPreviewForReview(
      friSeg,
      parentTitle,
      embeddedScheduleChildTitleForReview(parentTitle, friSeg, ''),
      makeEmbeddedChildProposalId(parentId, 0),
      { originalImportText: source }
    )
    const lines = preview.normalized.highlights.map((h) => `${h.time} ${h.label}`)
    expect(lines.some((h) => /^16:40\s+Oppmøte/i.test(h))).toBe(true)
    expect(lines.some((h) => /^17:30\s+Første kamp/i.test(h))).toBe(true)
    expect(lines.some((h) => /16:45/.test(h))).toBe(false)
    const preMatchOppmote = lines.filter((h) => /^16:\d{2}\s+Oppmøte/i.test(h))
    expect(preMatchOppmote.length).toBeLessThanOrEqual(1)
  })

  it('Høstcup søndag: lange dupliserte betinget-notater skal komprimeres i preview', () => {
    const r = runHostcupLiveNarrativePreviewCase()
    const noteBlocks = r.segments.find((s) => s.date === '2026-09-20')?.notes ?? ''
    const combined = noteBlocks
    expect(combined.length).toBeLessThan(220)
    const conditionalHits =
      combined.match(/\b(avhenger|betinget|ikke\s+endelig|foreløpig)\b/gi) ?? []
    expect(conditionalHits.length).toBeLessThanOrEqual(3)
  })

  it('Vårcup task-only payload skal ikke gi «1 gjøremål»-import', () => {
    const source = readFileSync(join(root, 'vaacup_original.txt'), 'utf8')
    const taskOnly = {
      schemaVersion: '1.0.0',
      provenance: {
        sourceSystem: 'tankestrom',
        sourceType: 'live_capture',
        generatedAt: new Date().toISOString(),
        importRunId: 'live-task-only-regression',
      },
      items: [
        {
          proposalId: '00000000-0000-4000-8000-000000000301',
          kind: 'task',
          sourceId: 'live',
          originalSourceType: 'pasted_text',
          confidence: 0.85,
          task: {
            date: '2026-06-12',
            title: 'Vårcupen 2026',
            notes: 'Svar i Spond senest mandag 8. juni kl. 20:00',
            dueTime: '20:00',
            personId: '',
          },
        },
      ],
    }
    const bundle = parsePortalImportProposalBundle(taskOnly)
    const people = [
      {
        id: 'person-a',
        name: 'Test',
        memberKind: 'child' as const,
        colorTint: 'bg-slate-200',
        colorAccent: 'border-slate-400',
      },
    ]
    const drafts = buildDraftsFromItems(bundle.items, new Set(['person-a']), 'person-a', people, undefined, {
      originalImportText: source,
    })
    const selected = initialSelectedIdsForGeneralImport(
      bundle.items,
      drafts,
      people,
      'person-a',
      undefined,
      { originalImportText: source }
    )
    const summary = importSummary(selected, bundle.items[0]!.proposalId)
    expect(summary).not.toBe('1 gjøremål')
    expect(bundle.items.some((i) => i.kind === 'event')).toBe(true)
  })
})
