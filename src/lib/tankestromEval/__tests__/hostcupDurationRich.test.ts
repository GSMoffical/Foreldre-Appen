import { describe, expect, it } from 'vitest'
import { runHostcupDurationCase } from '../hostcupDurationInferenceHarness'
import { HOSTCUP_TEXT_VARIANTS } from '../hostcupTextVariants'
import { runHostcupLiveNarrativePreviewCase } from '../hostcupLiveNarrativePreviewHarness'

function dayLive(r: ReturnType<typeof runHostcupLiveNarrativePreviewCase>, date: string) {
  const d = r.days.find((x) => x.date === date)
  if (!d) throw new Error(`missing ${date}`)
  return d
}

describe('Høstcup rich duration fixture (live narrative payload)', () => {
  it('fredag: 16:40 oppmøte, 17:30 kamp, inferred slutt', () => {
    const r = runHostcupLiveNarrativePreviewCase()
    const fri = dayLive(r, '2026-09-18')
    expect(fri.canonicalDisplayTime).toBe('16:40')
    expect(fri.canonicalHighlights).toEqual(['16:40 Oppmøte', '17:30 Første kamp'])
    expect(fri.selected).toBe(true)
    expect(fri.editSeedStart).toBe('16:40')
    expect(fri.validationBlockers).not.toContain('missing_end_time')
  })

  it('lørdag: 08:30/09:15/13:55/14:40, ingen fredagstid', () => {
    const r = runHostcupLiveNarrativePreviewCase()
    const lor = dayLive(r, '2026-09-19')
    expect(lor.canonicalDisplayTime).toBe('08:30')
    expect(lor.canonicalHighlights).toEqual([
      '08:30 Oppmøte før første kamp',
      '09:15 Første kamp',
      '13:55 Oppmøte før andre kamp',
      '14:40 Andre kamp',
    ])
    expect(lor.canonicalHighlights.some((l) => l.startsWith('17:30') || l.startsWith('18:15'))).toBe(
      false
    )
    expect(lor.selected).toBe(true)
    expect(lor.validationBlockers).not.toContain('missing_end_time')
  })

  it('søndag: foreløpig, ikke selected confirmed', () => {
    const r = runHostcupLiveNarrativePreviewCase()
    const son = dayLive(r, '2026-09-20')
    expect(son.isPreliminaryDay).toBe(true)
    expect(son.isImportSelectable).toBe(false)
    expect(son.selected).toBe(false)
    expect(son.canonicalDisplayTime).toBeNull()
    expect(son.canonicalHighlights).toEqual([])
  })

  it('Spond-frist 8. sept 21:00 er task, ikke program-highlight', () => {
    const r = runHostcupLiveNarrativePreviewCase()
    expect(r.taskDueTime).toBe('21:00')
    for (const d of r.days) {
      expect(d.canonicalHighlights.some((l) => l.startsWith('21:00'))).toBe(false)
    }
  })
})

describe('son_leak_fri_1730 etter canonical-fix', () => {
  it('søndag lekkasje: ikke displayTime 17:30, ikke selected', () => {
    const tv = HOSTCUP_TEXT_VARIANTS.find((v) => v.id === 'baseline')!
    const r = runHostcupDurationCase(tv, 'son_leak_fri_1730')
    const son = r.days.find((d) => d.date === '2026-09-20')!
    expect(son.canonicalDisplayTime).toBeNull()
    expect(son.selected).toBe(false)
    expect(son.isPreliminaryDay).toBe(true)
    expect(son.canonicalHighlights).toEqual([])
  })
})
