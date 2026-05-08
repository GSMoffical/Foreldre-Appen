import { describe, expect, it } from 'vitest'
import type { PortalImportProposalBundle, PortalProposalItem } from '../types'
import {
  buildFullImportDebugSnapshot,
  captureImportPipelineAnalyzeSnapshot,
  sanitizeForDebugClipboard,
  truncateDebugString,
} from '../tankestromImportDebug'

const minimalProvenance: PortalImportProposalBundle['provenance'] = {
  sourceSystem: 'tankestrom',
  sourceType: 'text_paste',
  generatedAt: '2026-01-01T00:00:00.000Z',
  importRunId: 'run-test',
}

function eventWithEmbedded(
  proposalId: string,
  title: string,
  embedded: Array<Record<string, unknown>>
): PortalProposalItem {
  return {
    kind: 'event',
    proposalId,
    sourceId: 'test',
    originalSourceType: 'test',
    confidence: 1,
    event: {
      title,
      date: '2026-05-01',
      start: '09:00',
      end: '10:00',
      personId: 'p1',
      metadata: {
        isArrangementParent: true,
        embeddedSchedule: embedded,
      },
    },
  }
}

describe('tankestromImportDebug', () => {
  it('truncateDebugString kutter lange felt', () => {
    const s = 'x'.repeat(500)
    const out = truncateDebugString(s, 80)
    expect(out.length).toBeLessThan(s.length)
    expect(out).toContain('truncated')
  })

  it('sanitizeForDebugClipboard fjerner sensitive nøkler og base64-lignende strenger', () => {
    const input = {
      safe: 'hello',
      VITE_SUPABASE_ANON_KEY: 'should-drop-key',
      nested: { api_key: 'secret', ok: true },
      blob: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=='.repeat(5),
    }
    const out = sanitizeForDebugClipboard(input) as Record<string, unknown>
    expect(out.safe).toBe('hello')
    expect(out.VITE_SUPABASE_ANON_KEY).toBeUndefined()
    expect((out.nested as Record<string, unknown>).api_key).toBeUndefined()
    expect(out.blob).toBe('[base64-like omitted]')
  })

  it('captureImportPipelineAnalyzeSnapshot inkluderer raw, fold og defensive', () => {
    const rawItems: PortalProposalItem[] = [
      eventWithEmbedded('parent-1', 'Cup', [
        {
          date: '2026-05-01',
          title: 'Dag 1',
          start: '10:00',
          dayContent: { highlights: ['10:00 Kamp'] },
        },
      ]),
    ]
    const snap = captureImportPipelineAnalyzeSnapshot({
      rawItems,
      afterLegacyFoldItems: rawItems,
      afterDefensiveItems: rawItems,
      provenance: minimalProvenance,
      fileErrorsCount: 0,
    })
    expect(snap.raw.importRunId).toBe('run-test')
    expect(snap.raw.items.length).toBeGreaterThan(0)
    expect(snap.afterLegacyFold.segments.length).toBe(1)
    expect(snap.afterDefensive.segments.length).toBe(1)
    expect(snap.rawEmbeddedSegments.length).toBe(1)
    const defSeg = snap.afterDefensive.segments[0]!
    expect(Array.isArray(defSeg.normalizedHighlights)).toBe(true)
  })

  it('computeTankestromImportWarnings flagger duplikat dato i defensive', () => {
    const rawItems: PortalProposalItem[] = [
      eventWithEmbedded('parent-1', 'Cup', [
        { date: '2026-05-01', title: 'A', start: '09:00' },
        { date: '2026-05-01', title: 'B', start: '10:00' },
      ]),
    ]
    const snap = captureImportPipelineAnalyzeSnapshot({
      rawItems,
      afterLegacyFoldItems: rawItems,
      afterDefensiveItems: rawItems,
      provenance: minimalProvenance,
      fileErrorsCount: 0,
    })
    const full = buildFullImportDebugSnapshot({
      analyze: snap,
      renderInput: [],
      persistPlan: [],
      analyzeWarning: null,
    })
    expect(full.warnings.some((w) => w.includes('[dedupe]'))).toBe(true)
  })

  it('buildFullImportDebugSnapshot inkluderer render og persist i objektet', () => {
    const snap = captureImportPipelineAnalyzeSnapshot({
      rawItems: [],
      afterLegacyFoldItems: [],
      afterDefensiveItems: [],
      provenance: { ...minimalProvenance, importRunId: 'empty' },
      fileErrorsCount: 2,
    })
    const full = buildFullImportDebugSnapshot({
      analyze: snap,
      renderInput: [{ parentProposalId: 'p', childProposalId: 'c', title: 't', date: '2026-01-01', displayedTime: '–', status: 'normal', highlightsForScheduleDetails: [], notesForScheduleDetails: [], bringItems: [], timeWindowSummaries: [] }],
      persistPlan: [],
      lastImportAttemptStatus: 'success',
      analyzeWarning: null,
    })
    expect(full.renderInput.length).toBe(1)
    expect(full.lastImportAttemptStatus).toBe('success')
  })
})
