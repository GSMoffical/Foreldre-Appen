// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarUpdateCandidates } from '../CalendarUpdateCandidates'
import type { CalendarUpdateCandidate } from '../../../lib/tankestromCalendarUpdateCandidates'

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

  it('«Importer som ny» skjuler hintet (oppdaterer ingenting)', async () => {
    const user = userEvent.setup()
    render(<CalendarUpdateCandidates candidates={[candidate]} />)
    await user.click(screen.getByRole('button', { name: 'Importer som ny' }))
    expect(screen.queryByText('Kan være oppdatering til eksisterende:')).toBeNull()
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
    // «Importer som ny» finnes fortsatt.
    expect(screen.getByRole('button', { name: 'Importer som ny' })).toBeTruthy()
  })
})
