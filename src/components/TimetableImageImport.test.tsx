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

function schoolBundle(weekdays: Record<number, { schoolStart: string; schoolEnd: string }>, gradeBand = '5-7') {
  const wd: Record<number, unknown> = {}
  for (const [k, v] of Object.entries(weekdays)) wd[Number(k)] = { useSimpleDay: true, ...v }
  return {
    items: [
      {
        proposalId: 'p1',
        kind: 'school_profile',
        sourceId: 's',
        originalSourceType: 'uploaded_file',
        confidence: 0.9,
        schoolProfile: { gradeBand, weekdays: wd },
      },
    ],
  }
}

function img(name: string) {
  return new File(['img'], name, { type: 'image/png' })
}

function input() {
  return screen.getByLabelText('Timeplanfiler') as HTMLInputElement
}

describe('TimetableImageImport', () => {
  it('nevner Tankestrøm og bilder/dokumenter, og har «Velg filer»-knapp', () => {
    render(<TimetableImageImport onApply={() => undefined} />)
    expect(screen.getByText('Les timeplan med Tankestrøm')).toBeTruthy()
    expect(screen.getByText(/bilder, PDF-er eller dokumenter/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Velg filer' })).toBeTruthy()
  })

  it('tillater flere filer (multiple) og godtar pdf/word i accept', () => {
    render(<TimetableImageImport onApply={() => undefined} />)
    expect(input().multiple).toBe(true)
    const accept = input().getAttribute('accept') ?? ''
    expect(accept).toMatch(/image\/\*/)
    expect(accept).toMatch(/pdf/)
    expect(accept).toMatch(/wordprocessingml|\.docx/)
  })

  it('analyserer flere filer og viser sammenslått forslag med antall filer', async () => {
    analyzeMock
      .mockResolvedValueOnce(schoolBundle({ 0: { schoolStart: '08:15', schoolEnd: '14:00' } }))
      .mockResolvedValueOnce(schoolBundle({ 2: { schoolStart: '09:00', schoolEnd: '13:00' } }))
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={() => undefined} />)

    await user.upload(input(), [img('man.png'), img('ons.png')])

    expect(await screen.findByText('Forslag fra Tankestrøm')).toBeTruthy()
    expect(screen.getByText('Analyserte 2 filer')).toBeTruthy()
    expect(screen.getByText('Mandag')).toBeTruthy()
    expect(screen.getByText('Onsdag')).toBeTruthy()
    expect(analyzeMock).toHaveBeenCalledTimes(2)
  })

  it('viser konfliktadvarsel når to filer foreslår samme dag med ulik tid', async () => {
    analyzeMock
      .mockResolvedValueOnce(schoolBundle({ 0: { schoolStart: '08:15', schoolEnd: '14:00' } }))
      .mockResolvedValueOnce(schoolBundle({ 0: { schoolStart: '09:00', schoolEnd: '13:00' } }))
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={() => undefined} />)

    await user.upload(input(), [img('a.png'), img('b.png')])

    expect(await screen.findByText(/Ulike tider for Mandag/)).toBeTruthy()
    // Beholder første tid.
    expect(screen.getByText('08:15–14:00')).toBeTruthy()
  })

  it('én fil feiler, men forslag fra andre filer kan fortsatt brukes (med advarsel)', async () => {
    analyzeMock
      .mockRejectedValueOnce(new Error('Tidsavbrudd'))
      .mockResolvedValueOnce(schoolBundle({ 1: { schoolStart: '08:15', schoolEnd: '14:00' } }))
    const onApply = vi.fn()
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={onApply} />)

    await user.upload(input(), [img('feil.png'), img('ok.png')])

    expect(await screen.findByText('Forslag fra Tankestrøm')).toBeTruthy()
    expect(screen.getByText(/Kunne ikke lese «feil\.png»/)).toBeTruthy()
    expect(screen.getByText('Tirsdag')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Bruk forslag' }))
    expect(onApply).toHaveBeenCalledTimes(1)
    const profile = onApply.mock.calls[0]![0] as ChildSchoolProfile
    expect(profile.weekdays[1]).toEqual({ useSimpleDay: true, schoolStart: '08:15', schoolEnd: '14:00' })
  })

  it('«Bruk forslag» oppdaterer state kun etter eksplisitt klikk', async () => {
    analyzeMock.mockResolvedValueOnce(schoolBundle({ 0: { schoolStart: '08:15', schoolEnd: '14:00' } }))
    const onApply = vi.fn()
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={onApply} />)

    await user.upload(input(), [img('man.png')])
    await screen.findByText('Forslag fra Tankestrøm')
    // Ikke kalt før klikk.
    expect(onApply).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Bruk forslag' }))
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Forslag fra Tankestrøm')).toBeNull()
    expect(screen.getByRole('button', { name: 'Velg filer' })).toBeTruthy()
  })

  it('viser feilmelding når ingen fil ga timeplan, og beholder knappen (manuell fallback)', async () => {
    analyzeMock.mockResolvedValueOnce({ items: [] })
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={() => undefined} />)

    await user.upload(input(), [img('blank.png')])

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Forslag fra Tankestrøm')).toBeNull()
    expect(screen.getByRole('button', { name: 'Velg filer' })).toBeTruthy()
  })
})
