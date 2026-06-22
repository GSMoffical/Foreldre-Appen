// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
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
})
