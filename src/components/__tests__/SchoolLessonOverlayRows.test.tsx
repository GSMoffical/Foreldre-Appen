// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SchoolLessonSlot, SchoolWeekOverlayDayAction } from '../../types'
import { LessonOverlayBoxReadOnly, OverlayUpdateReadOnly } from '../SchoolLessonOverlayRows'

afterEach(cleanup)

const naturfag: SchoolLessonSlot = { subjectKey: 'naturfag', start: '08:00', end: '09:00' }

function enrich(subjectUpdates: SchoolWeekOverlayDayAction['subjectUpdates']): SchoolWeekOverlayDayAction {
  return { action: 'enrich_existing_school_block', subjectUpdates }
}

describe('LessonOverlayBoxReadOnly (import-preview, Opsjon A)', () => {
  it('matcher RÅ overlay-subjectKey «Naturfag» mot NORMALISERT lesson «naturfag» og viser innhold', () => {
    render(
      <LessonOverlayBoxReadOnly
        lesson={naturfag}
        overlayDayAction={enrich([{ subjectKey: 'Naturfag', sections: { lekse: ['Les s.10'] } }])}
      />
    )
    expect(screen.getByText('Naturfag')).toBeTruthy()
    expect(screen.getByText('Lekse')).toBeTruthy()
    expect(screen.getByText('Les s.10')).toBeTruthy()
  })

  it('umatchet fag (Spansk) → INGEN boks i det hele tatt (Punkt 5: renere enn tom-tilstands-tekst)', () => {
    const { container } = render(
      <LessonOverlayBoxReadOnly
        lesson={naturfag}
        overlayDayAction={enrich([{ subjectKey: 'Spansk', sections: { lekse: ['Gloser'] } }])}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('replace-dag viser alle linjer flatt — uten «Uke-overlay»-header (Punkt 5)', () => {
    render(
      <LessonOverlayBoxReadOnly
        lesson={undefined}
        overlayDayAction={{ action: 'replace_school_block', subjectUpdates: [{ subjectKey: 'Heldagsprøve' }] }}
        isReplaceDay
      />
    )
    expect(screen.getByText('Heldagsprøve')).toBeTruthy()
    expect(screen.queryByText(/Uke-overlay/)).toBeNull()
  })

  it('matchet rad viser innhold uten header (Punkt 5)', () => {
    render(
      <LessonOverlayBoxReadOnly
        lesson={naturfag}
        overlayDayAction={enrich([{ subjectKey: 'Naturfag', sections: { lekse: ['Les s.10'] } }])}
      />
    )
    expect(screen.getByText('Les s.10')).toBeTruthy()
    expect(screen.queryByText(/Uke-overlay/)).toBeNull()
  })
})

describe('OverlayUpdateReadOnly (read-only linje)', () => {
  it('viser fag + seksjoner, men INGEN Rediger-knapp', () => {
    render(
      <ul>
        <OverlayUpdateReadOnly update={{ subjectKey: 'Norsk', sections: { iTimen: ['Kap 3'] } }} />
      </ul>
    )
    expect(screen.getByText('Norsk')).toBeTruthy()
    expect(screen.getByText('I timen')).toBeTruthy()
    expect(screen.getByText('Kap 3')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Rediger' })).toBeNull()
  })
})
