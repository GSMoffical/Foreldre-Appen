// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarUpdateCandidates } from '../CalendarUpdateCandidates'
import type { CalendarUpdateCandidate } from '../../../lib/tankestromCalendarUpdateCandidates'
import type { CalendarUpdateDiff } from '../../../lib/tankestromCalendarUpdateDiff'

afterEach(() => cleanup())

function cand(partial: Partial<CalendarUpdateCandidate>): CalendarUpdateCandidate {
  return {
    id: 'e-cup',
    title: 'Vårcupen 2026',
    dateLabel: '12. juni',
    date: '2026-06-12',
    score: 0.85,
    confidence: 'high',
    signals: ['tittel', 'dato'],
    explanation: 'Matchet på tittel og dato',
    ...partial,
  }
}

const diff: CalendarUpdateDiff = {
  changed: [
    { label: 'Dato', oldValue: '13. juni', newValue: '12. juni' },
    { label: 'Start', oldValue: '09:00', newValue: '08:00' },
  ],
  added: [{ label: 'Sted', value: 'Lørenskoghallen' }],
  kept: [{ label: 'Notat', value: 'Husk rød drakt' }],
  uncertain: [],
}

describe('CalendarUpdateCandidates (v2)', () => {
  it('viser ingen seksjon når det ikke finnes kandidater', () => {
    const { container } = render(<CalendarUpdateCandidates candidates={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('ikke-update-modus: viser «Kan være oppdatering til eksisterende»', () => {
    render(<CalendarUpdateCandidates candidates={[cand({})]} />)
    expect(screen.getByText('Kan være oppdatering til eksisterende:')).toBeTruthy()
    expect(screen.getByText('Vårcupen 2026')).toBeTruthy()
  })

  it('grupperer flere kandidater for samme arrangement i ÉN samlet preview', () => {
    render(
      <CalendarUpdateCandidates
        isUpdateMode
        candidates={[
          cand({ id: 'fri', stableKey: 'arr-1', date: '2026-06-12', dateLabel: '12. juni' }),
          cand({ id: 'lor', stableKey: 'arr-1', date: '2026-06-13', dateLabel: '13. juni' }),
          cand({ id: 'son', stableKey: 'arr-1', date: '2026-06-14', dateLabel: '14. juni' }),
        ]}
      />
    )
    // ÉN samlet overskrift, ikke tre.
    expect(screen.getAllByText('Dette ser ut som en oppdatering til:')).toHaveLength(1)
    expect(screen.getByText(/12\.–14\. juni/)).toBeTruthy()
    // Dagvis: alle tre dagene vises.
    expect(screen.getByText('12. juni')).toBeTruthy()
    expect(screen.getByText('13. juni')).toBeTruthy()
    expect(screen.getByText('14. juni')).toBeTruthy()
  })

  it('viser forståelig «Eksisterende» vs «Ny/Endret» og skjuler cross-day Dato-endring', () => {
    render(<CalendarUpdateCandidates candidates={[cand({})]} diffByCandidateId={{ 'e-cup': diff }} />)
    // Eksisterende info (svart) — gammel starttid + beholdt notat.
    expect(screen.getByText('Eksisterende')).toBeTruthy()
    expect(screen.getByText('Starttid: 09:00')).toBeTruthy()
    expect(screen.getByText('Notat: Husk rød drakt')).toBeTruthy()
    // Ny/endret med tekst-labels.
    expect(screen.getByText('Ny / endret')).toBeTruthy()
    expect(screen.getByText('Endret')).toBeTruthy()
    expect(screen.getByText('Starttid: 08:00')).toBeTruthy()
    expect(screen.getByText('Ny')).toBeTruthy()
    expect(screen.getByText('Sted: Lørenskoghallen')).toBeTruthy()
    // Cross-day «Dato: 13. juni → 12. juni» vises IKKE som endring (ingen pil før teknisk).
    expect(screen.queryByText(/→/)).toBeNull()
  })

  it('teknisk diff ligger bak «Se tekniske detaljer» (ikke primærvisning)', async () => {
    const user = userEvent.setup()
    render(<CalendarUpdateCandidates candidates={[cand({})]} diffByCandidateId={{ 'e-cup': diff }} />)
    expect(screen.queryByText('Tekniske detaljer')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Se tekniske detaljer' }))
    expect(screen.getByText('Tekniske detaljer')).toBeTruthy()
    expect(screen.getByText('Start: 09:00 → 08:00')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Skjul tekniske detaljer' }))
    expect(screen.queryByText('Tekniske detaljer')).toBeNull()
  })

  it('«Vis eksisterende» kaller onOpenExisting med eksisterende event-id', async () => {
    const user = userEvent.setup()
    const onOpenExisting = vi.fn()
    render(<CalendarUpdateCandidates candidates={[cand({})]} onOpenExisting={onOpenExisting} />)
    await user.click(screen.getByRole('button', { name: 'Vis eksisterende' }))
    expect(onOpenExisting).toHaveBeenCalledWith('e-cup')
  })

  it('update-modus: «Importer som ny likevel» kaller onImportAsNew med proposalId', async () => {
    const user = userEvent.setup()
    const onImportAsNew = vi.fn()
    render(
      <CalendarUpdateCandidates
        candidates={[cand({})]}
        proposalId="p-1"
        isUpdateMode
        onImportAsNew={onImportAsNew}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Importer som ny likevel' }))
    expect(onImportAsNew).toHaveBeenCalledWith('p-1')
  })

  it('update-modus etter valg: viser «Angre – ikke importer som ny» + note', () => {
    render(
      <CalendarUpdateCandidates
        candidates={[cand({})]}
        proposalId="p-1"
        isUpdateMode
        isImportingAsNew
        onImportAsNew={vi.fn()}
      />
    )
    expect(screen.getByText(/Importeres som ny hendelse/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Angre – ikke importer som ny' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Importer som ny likevel' })).toBeNull()
  })

  it('ikke-update-modus: «Skjul hint» skjuler hintet', async () => {
    const user = userEvent.setup()
    render(<CalendarUpdateCandidates candidates={[cand({})]} />)
    await user.click(screen.getByRole('button', { name: 'Skjul hint' }))
    expect(screen.queryByText('Kan være oppdatering til eksisterende:')).toBeNull()
  })
})
