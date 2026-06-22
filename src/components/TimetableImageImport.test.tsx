// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ChildSchoolProfile } from '../types'

const { analyzeMock } = vi.hoisted(() => ({ analyzeMock: vi.fn() }))
vi.mock('../lib/tankestromApi', () => ({ analyzeDocumentWithTankestrom: analyzeMock }))

import { TimetableImageImport } from './TimetableImageImport'

afterEach(() => {
  cleanup()
  analyzeMock.mockReset()
})

const schoolBundle = {
  items: [
    {
      proposalId: 'p1',
      kind: 'school_profile',
      sourceId: 's',
      originalSourceType: 'uploaded_file',
      confidence: 0.9,
      schoolProfile: {
        gradeBand: '5-7',
        weekdays: {
          0: { useSimpleDay: true, schoolStart: '08:15', schoolEnd: '14:00' },
          2: { useSimpleDay: true, schoolStart: '08:15', schoolEnd: '13:00' },
        },
      },
    },
  ],
}

function uploadImage(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(['img'], 'timeplan.png', { type: 'image/png' })
  return user.upload(screen.getByLabelText('Bilde av timeplan'), file)
}

describe('TimetableImageImport', () => {
  it('viser «Importer fra bilde»-knapp', () => {
    render(<TimetableImageImport onApply={() => undefined} />)
    expect(screen.getByRole('button', { name: /Importer fra bilde/ })).toBeTruthy()
  })

  it('viser forslagspanel etter analyse av valgt bilde', async () => {
    analyzeMock.mockResolvedValueOnce(schoolBundle)
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={() => undefined} />)

    await uploadImage(user)

    expect(await screen.findByText('Forslag fra bilde')).toBeTruthy()
    expect(screen.getByText('Mandag')).toBeTruthy()
    expect(screen.getByText('08:15–14:00')).toBeTruthy()
    expect(screen.getByText('Onsdag')).toBeTruthy()
    expect(analyzeMock).toHaveBeenCalledTimes(1)
  })

  it('«Bruk forslag» kaller onApply med timeplanprofilen (lagrer ikke selv)', async () => {
    analyzeMock.mockResolvedValueOnce(schoolBundle)
    const onApply = vi.fn()
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={onApply} />)

    await uploadImage(user)
    await screen.findByText('Forslag fra bilde')
    await user.click(screen.getByRole('button', { name: 'Bruk forslag' }))

    expect(onApply).toHaveBeenCalledTimes(1)
    const profile = onApply.mock.calls[0]![0] as ChildSchoolProfile
    expect(profile.gradeBand).toBe('5-7')
    expect(profile.weekdays[0]).toEqual({ useSimpleDay: true, schoolStart: '08:15', schoolEnd: '14:00' })
    // Panelet lukkes etter bruk; knappen for ny import er fortsatt der.
    expect(screen.queryByText('Forslag fra bilde')).toBeNull()
    expect(screen.getByRole('button', { name: /Importer fra bilde/ })).toBeTruthy()
  })

  it('viser feilmelding ved analysefeil og beholder manuell fallback (knappen)', async () => {
    analyzeMock.mockRejectedValueOnce(new Error('Serveren svarte ikke'))
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={() => undefined} />)

    await uploadImage(user)

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Serveren svarte ikke')
    expect(screen.queryByText('Forslag fra bilde')).toBeNull()
    expect(screen.getByRole('button', { name: /Importer fra bilde/ })).toBeTruthy()
  })

  it('viser hjelpsom feilmelding når bildet mangler timeplanstruktur', async () => {
    analyzeMock.mockResolvedValueOnce({ items: [] })
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={() => undefined} />)

    await uploadImage(user)

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Fant ikke nok struktur til en timeplan i bildet. Du kan fortsatt fylle ut manuelt.'
    )
  })
})
