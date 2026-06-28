// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ChildSchoolProfile } from '../types'

const { analyzeMock } = vi.hoisted(() => ({ analyzeMock: vi.fn() }))
vi.mock('../lib/tankestromApi', () => ({ analyzeDocumentWithTankestrom: analyzeMock }))

import { TimetableImageImport } from './TimetableImageImport'

beforeEach(() => {
  // UploadFileList lager objectURL-miniatyrer for bilde-chips; gjør det deterministisk.
  ;(URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:mock')
  ;(URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn()
})

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

function lessonBundle(
  weekdayLessons: Record<number, Array<{ subjectKey: string; start: string; end: string }>>,
  gradeBand = '5-7'
) {
  const wd: Record<number, unknown> = {}
  for (const [k, lessons] of Object.entries(weekdayLessons)) {
    wd[Number(k)] = { useSimpleDay: false, lessons }
  }
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

/** Velg filer (staging) og trykk «Analyser» — analysen er ikke lenger automatisk. */
async function selectAndAnalyze(user: ReturnType<typeof userEvent.setup>, files: File[]) {
  await user.upload(input(), files)
  await user.click(screen.getByRole('button', { name: 'Analyser' }))
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

  it('å velge filer legger dem i lista UTEN å analysere (manuell «Analyser»)', async () => {
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={() => undefined} />)

    await user.upload(input(), [img('man.png')])

    expect(screen.getByText('man.png')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Analyser' })).toBeTruthy()
    expect(analyzeMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Forslag fra Tankestrøm')).toBeNull()
  })

  it('× fjerner en valgt fil før analyse (uten å analysere)', async () => {
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={() => undefined} />)

    await user.upload(input(), [img('man.png'), img('ons.png')])
    expect(screen.getByText('man.png')).toBeTruthy()
    expect(screen.getByText('ons.png')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Fjern man.png' }))

    expect(screen.queryByText('man.png')).toBeNull()
    expect(screen.getByText('ons.png')).toBeTruthy()
    expect(analyzeMock).not.toHaveBeenCalled()
  })

  it('analyserer flere filer og viser sammenslått forslag med antall filer', async () => {
    analyzeMock
      .mockResolvedValueOnce(schoolBundle({ 0: { schoolStart: '08:15', schoolEnd: '14:00' } }))
      .mockResolvedValueOnce(schoolBundle({ 2: { schoolStart: '09:00', schoolEnd: '13:00' } }))
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={() => undefined} />)

    await selectAndAnalyze(user, [img('man.png'), img('ons.png')])

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

    await selectAndAnalyze(user, [img('a.png'), img('b.png')])

    expect(await screen.findByText(/Ulike tider for Mandag/)).toBeTruthy()
    // Beholder første tid — les input-verdiene fra forslags-editoren.
    expect((screen.getByLabelText('Start Mandag') as HTMLInputElement).value).toBe('08:15')
    expect((screen.getByLabelText('Slutt Mandag') as HTMLInputElement).value).toBe('14:00')
  })

  it('én fil feiler, men forslag fra andre filer kan fortsatt brukes (med advarsel)', async () => {
    analyzeMock
      .mockRejectedValueOnce(new Error('Tidsavbrudd'))
      .mockResolvedValueOnce(schoolBundle({ 1: { schoolStart: '08:15', schoolEnd: '14:00' } }))
    const onApply = vi.fn()
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={onApply} />)

    await selectAndAnalyze(user, [img('feil.png'), img('ok.png')])

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

    await selectAndAnalyze(user, [img('man.png')])
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

    await selectAndAnalyze(user, [img('blank.png')])

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Forslag fra Tankestrøm')).toBeNull()
    expect(screen.getByRole('button', { name: 'Velg filer' })).toBeTruthy()
  })

  it('viser fagene i forslaget og lar dem redigeres før «Bruk forslag» (sender redigert profil)', async () => {
    analyzeMock.mockResolvedValueOnce(
      lessonBundle({
        0: [
          { subjectKey: 'matematikk', start: '08:15', end: '09:00' },
          { subjectKey: 'norsk', start: '09:15', end: '10:00' },
        ],
      })
    )
    const onApply = vi.fn()
    const user = userEvent.setup()
    render(<TimetableImageImport onApply={onApply} />)

    await selectAndAnalyze(user, [img('man.png')])
    await screen.findByText('Forslag fra Tankestrøm')

    // Fagene vises (ikke bare antall): fag-velgerne står på de funne fagene.
    const fag1 = screen.getByLabelText('Fag Mandag time 1') as HTMLSelectElement
    const fag2 = screen.getByLabelText('Fag Mandag time 2') as HTMLSelectElement
    expect(fag1.value).toBe('matematikk')
    expect(fag2.value).toBe('norsk')

    // Rett fag 1: Matematikk → Engelsk.
    await user.selectOptions(fag1, 'engelsk')

    await user.click(screen.getByRole('button', { name: 'Bruk forslag' }))

    expect(onApply).toHaveBeenCalledTimes(1)
    const profile = onApply.mock.calls[0]![0] as ChildSchoolProfile
    // Den REDIGERTE profilen sendes (ikke originalen): fag 1 = engelsk, fag 2 uendret, tider beholdt.
    expect(profile.weekdays[0]!.lessons![0]!.subjectKey).toBe('engelsk')
    expect(profile.weekdays[0]!.lessons![1]!.subjectKey).toBe('norsk')
    expect(profile.weekdays[0]!.lessons![0]!.start).toBe('08:15')
  })
})
