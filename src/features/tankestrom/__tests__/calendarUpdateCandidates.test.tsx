// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarUpdateCandidates } from '../CalendarUpdateCandidates'
import type { CalendarUpdateCandidate } from '../../../lib/tankestromCalendarUpdateCandidates'
import type { CalendarUpdateDiff } from '../../../lib/tankestromCalendarUpdateDiff'

afterEach(() => cleanup())

const candidate: CalendarUpdateCandidate = {
  id: 'e-cup',
  title: 'Vårcuppen',
  date: '2026-04-12',
  endDate: '2026-04-13',
  dateLabel: '12.–13. april',
  score: 0.85,
  confidence: 'high',
  signals: ['tittel', 'dato'],
  explanation: 'Matchet på tittel og dato',
}

describe('CalendarUpdateCandidates', () => {
  it('viser «Kan være oppdatering til eksisterende» når kandidat finnes', () => {
    render(<CalendarUpdateCandidates candidates={[candidate]} />)
    expect(screen.getByText('Kan være oppdatering til eksisterende:')).toBeTruthy()
    expect(screen.getByText('Vårcuppen')).toBeTruthy()
    expect(screen.getByText(/12\.–13\. april/)).toBeTruthy()
    expect(screen.getByText('Matchet på tittel og dato')).toBeTruthy()
  })

  it('viser ingen seksjon når det ikke finnes kandidater', () => {
    const { container } = render(<CalendarUpdateCandidates candidates={[]} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('Kan være oppdatering til eksisterende:')).toBeNull()
  })

  it('uten update-modus heter knappen «Skjul hint» og skjuler hintet (oppdaterer ingenting)', async () => {
    const user = userEvent.setup()
    render(<CalendarUpdateCandidates candidates={[candidate]} />)
    expect(screen.queryByRole('button', { name: /Importer som ny/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Skjul hint' }))
    expect(screen.queryByText('Kan være oppdatering til eksisterende:')).toBeNull()
  })

  it('update-modus: viser «Dette ser ut som en oppdatering til:» og «Importer som ny likevel»', async () => {
    const user = userEvent.setup()
    const onImportAsNew = vi.fn()
    render(
      <CalendarUpdateCandidates
        candidates={[candidate]}
        proposalId="p-1"
        isUpdateMode
        isImportingAsNew={false}
        onImportAsNew={onImportAsNew}
      />
    )
    expect(screen.getByText('Dette ser ut som en oppdatering til:')).toBeTruthy()
    expect(screen.getByText('Vårcuppen')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Importer som ny likevel' }))
    expect(onImportAsNew).toHaveBeenCalledWith('p-1')
  })

  it('update-modus etter valg: viser «Angre – ikke importer som ny» og note', async () => {
    const user = userEvent.setup()
    const onImportAsNew = vi.fn()
    render(
      <CalendarUpdateCandidates
        candidates={[candidate]}
        proposalId="p-1"
        isUpdateMode
        isImportingAsNew
        onImportAsNew={onImportAsNew}
      />
    )
    expect(screen.getByText(/Importeres som ny hendelse/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Importer som ny likevel' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Angre – ikke importer som ny' }))
    expect(onImportAsNew).toHaveBeenCalledWith('p-1')
  })

  it('viser «Vis eksisterende» og kaller onOpenExisting med riktig event-id', async () => {
    const user = userEvent.setup()
    const onOpenExisting = vi.fn()
    render(<CalendarUpdateCandidates candidates={[candidate]} onOpenExisting={onOpenExisting} />)
    await user.click(screen.getByRole('button', { name: 'Vis eksisterende' }))
    expect(onOpenExisting).toHaveBeenCalledTimes(1)
    expect(onOpenExisting).toHaveBeenCalledWith('e-cup')
  })

  it('ved flere kandidater kaller «Vis eksisterende» riktig kandidat', async () => {
    const user = userEvent.setup()
    const onOpenExisting = vi.fn()
    const second: CalendarUpdateCandidate = { ...candidate, id: 'e-other', title: 'Sommerturnering' }
    render(
      <CalendarUpdateCandidates candidates={[candidate, second]} onOpenExisting={onOpenExisting} />
    )
    const buttons = screen.getAllByRole('button', { name: 'Vis eksisterende' })
    expect(buttons).toHaveLength(2)
    await user.click(buttons[1]!)
    expect(onOpenExisting).toHaveBeenCalledWith('e-other')
  })

  it('uten onOpenExisting vises ingen «Vis eksisterende»-knapp, men hintet rendres', () => {
    render(<CalendarUpdateCandidates candidates={[candidate]} />)
    expect(screen.getByText('Kan være oppdatering til eksisterende:')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Vis eksisterende' })).toBeNull()
    // «Skjul hint» finnes fortsatt (ikke-update-modus).
    expect(screen.getByRole('button', { name: 'Skjul hint' })).toBeTruthy()
  })

  const diff: CalendarUpdateDiff = {
    changed: [{ label: 'Start', oldValue: '09:00', newValue: '08:00' }],
    added: [{ label: 'Notat', value: 'Husk rød drakt' }],
    kept: [{ label: 'Sted', value: 'Lørenskoghallen' }],
    uncertain: [],
  }

  it('viser diff bak «Se mulige endringer»-toggle for riktig kandidat', async () => {
    const user = userEvent.setup()
    render(
      <CalendarUpdateCandidates candidates={[candidate]} diffByCandidateId={{ 'e-cup': diff }} />
    )
    // Skjult til man trykker.
    expect(screen.queryByText('Mulige endringer')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Se mulige endringer' }))
    expect(screen.getByText('Mulige endringer')).toBeTruthy()
    expect(screen.getByText('Start: 09:00 → 08:00')).toBeTruthy()
    expect(screen.getByText('Notat: Husk rød drakt')).toBeTruthy()
    expect(screen.getByText('Sted: Lørenskoghallen')).toBeTruthy()
    // Toggle skjuler igjen.
    await user.click(screen.getByRole('button', { name: 'Skjul endringer' }))
    expect(screen.queryByText('Mulige endringer')).toBeNull()
  })

  it('viser ingen diff-toggle når diff mangler eller er tom', () => {
    const emptyDiff: CalendarUpdateDiff = { changed: [], added: [], kept: [], uncertain: [] }
    render(
      <CalendarUpdateCandidates candidates={[candidate]} diffByCandidateId={{ 'e-cup': emptyDiff }} />
    )
    expect(screen.queryByRole('button', { name: 'Se mulige endringer' })).toBeNull()
    expect(screen.getByText('Kan være oppdatering til eksisterende:')).toBeTruthy()
  })

  it('beholder «Vis eksisterende» og «Se mulige endringer» i update-modus', async () => {
    const user = userEvent.setup()
    const onOpenExisting = vi.fn()
    render(
      <CalendarUpdateCandidates
        candidates={[candidate]}
        onOpenExisting={onOpenExisting}
        diffByCandidateId={{ 'e-cup': diff }}
        proposalId="p-1"
        isUpdateMode
        onImportAsNew={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Vis eksisterende' }))
    expect(onOpenExisting).toHaveBeenCalledWith('e-cup')
    await user.click(screen.getByRole('button', { name: 'Se mulige endringer' }))
    expect(screen.getByText('Mulige endringer')).toBeTruthy()
    // Update-modus → «Importer som ny likevel», ikke «Skjul hint».
    expect(screen.getByRole('button', { name: 'Importer som ny likevel' })).toBeTruthy()
  })
})
