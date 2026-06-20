// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parsePortalImportProposalBundle } from '../../../lib/tankestromApi'
import { TankestromImportDialog } from '../TankestromImportDialog'

/**
 * Rik preview-dekning flyttet fra browser-E2E hit. TankestromImportDialog rendrer
 * fortsatt delprogram/høydepunkter/husk-ta-med/foreløpig — men er ikke lenger
 * primær brukerinngang. Disse assertions er deterministiske gitt analyse-fixturen
 * og trenger derfor ikke nettleser/login: de kjøres her i `npm test`.
 */
const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) =>
  parsePortalImportProposalBundle(
    JSON.parse(readFileSync(join(__dirname, `../../../../e2e/fixtures/${name}`), 'utf8'))
  )

const hostcupBundle = fixture('hostcup-analyze-response.json')
const vaacupBundle = fixture('vaacup-analyze-response.json')

const people = [
  {
    id: 'person-a',
    name: 'Test',
    memberKind: 'child' as const,
    colorTint: 'bg-slate-200',
    colorAccent: 'border-slate-400',
  },
]

vi.mock('../../../lib/tankestromApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/tankestromApi')>()
  return {
    ...actual,
    analyzeTextWithTankestrom: vi.fn(),
    analyzeDocumentWithTankestrom: vi.fn(),
  }
})

import { analyzeTextWithTankestrom } from '../../../lib/tankestromApi'

async function renderReview(user: ReturnType<typeof userEvent.setup>) {
  render(
    <TankestromImportDialog
      open
      onClose={() => undefined}
      people={people}
      createEvent={vi.fn()}
      createTask={vi.fn()}
    />
  )
  // På denne branchen er standard inputmodus «Fil»; bytt til «Tekst» før vi limer inn.
  await user.click(screen.getByRole('button', { name: 'Tekst' }))
  await user.type(screen.getByTestId('tankestrom-import-text'), 'Cup-program (mock)')
  await user.click(screen.getByTestId('tankestrom-analyze'))
  await waitFor(() => expect(analyzeTextWithTankestrom).toHaveBeenCalledTimes(1))
  await screen.findByText('Limt inn tekst')
}

/** Klikk dag-kortets trigger for å vise detaljer (høydepunkter/notater). */
async function expandDay(
  user: ReturnType<typeof userEvent.setup>,
  dayCard: HTMLElement,
  titleRe: RegExp
) {
  await user.click(within(dayCard).getByRole('button', { name: titleRe }))
}

describe('TankestromImportDialog preview (Høstcupen)', () => {
  beforeEach(() => {
    vi.mocked(analyzeTextWithTankestrom).mockResolvedValue(hostcupBundle)
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('grupperer delprogram per dag med riktige titler og «1 arrangement / 2 hendelser»', async () => {
    const user = userEvent.setup()
    await renderReview(user)

    const confirm = screen.getByTestId('tankestrom-import-confirm')
    expect(confirm.textContent).toContain('Importer valgte (1 arrangement / 2 hendelser)')

    expect(screen.getAllByTestId(/^tankestrom-delprogram-day-/)).toHaveLength(3)
    const friday = screen.getByTestId('tankestrom-delprogram-day-2026-09-18')
    const saturday = screen.getByTestId('tankestrom-delprogram-day-2026-09-19')
    const sunday = screen.getByTestId('tankestrom-delprogram-day-2026-09-20')
    expect(friday.textContent).toContain('Høstcupen – fredag')
    expect(saturday.textContent).toContain('Høstcupen – lørdag')
    expect(sunday.textContent).toContain('Høstcupen – søndag')

    for (const bad of ['Høstcupen – 18', 'Friday', 'Saturday', 'Sunday', 'Høstcupen , J2013']) {
      expect(screen.queryByText(bad, { exact: false })).toBeNull()
    }
  })

  it('viser riktige høydepunkter per dag uten tittel-støy eller duplikat', async () => {
    const user = userEvent.setup()
    await renderReview(user)

    const friday = screen.getByTestId('tankestrom-delprogram-day-2026-09-18')
    await expandDay(user, friday, /Høstcupen.*– fredag/)
    const friHi = await within(friday).findByTestId('tankestrom-schedule-highlights-2026-09-18')
    expect(friHi.textContent).toContain('17:30')
    expect(friHi.textContent).toContain('Oppmøte')
    expect(friHi.textContent).toContain('18:15')
    expect(friHi.textContent).toContain('Første kamp')
    expect(friHi.textContent).not.toContain('Høstcupen')

    const saturday = screen.getByTestId('tankestrom-delprogram-day-2026-09-19')
    await expandDay(user, saturday, /Høstcupen.*– lørdag/)
    const lorHi = await within(saturday).findByTestId('tankestrom-schedule-highlights-2026-09-19')
    for (const t of ['08:20', 'Oppmøte før første kamp', '09:00', 'Første kamp', '13:55', 'Oppmøte før andre kamp', '14:40', 'Andre kamp']) {
      expect(lorHi.textContent).toContain(t)
    }
    const liWith1440 = Array.from(lorHi.querySelectorAll('li')).filter((li) =>
      li.textContent?.includes('14:40')
    )
    expect(liWith1440).toHaveLength(1)
    expect(lorHi.textContent).not.toContain('Høstcupen')
  })

  it('markerer søndag som foreløpig uten høydepunkter eller «Fast kampstart»', async () => {
    const user = userEvent.setup()
    await renderReview(user)

    const sunday = screen.getByTestId('tankestrom-delprogram-day-2026-09-20')
    expect(within(sunday).getByText('Foreløpig')).toBeTruthy()
    await expandDay(user, sunday, /Høstcupen.*– søndag/)
    expect(await within(sunday).findByText('Ikke endelig avklart')).toBeTruthy()
    expect(sunday.textContent).not.toContain('Fast kampstart')
    expect(within(sunday).queryByTestId('tankestrom-schedule-highlights-2026-09-20')).toBeNull()
  })

  it('viser «Husk / ta med» med hele varelinjer (ingen «t»/«skjorte»-splitt) og dedupliker notater', async () => {
    const user = userEvent.setup()
    await renderReview(user)

    const days: Array<[string, RegExp]> = [
      ['2026-09-18', /Høstcupen.*– fredag/],
      ['2026-09-19', /Høstcupen.*– lørdag/],
      ['2026-09-20', /Høstcupen.*– søndag/],
    ]
    for (const [date, titleRe] of days) {
      const day = screen.getByTestId(`tankestrom-delprogram-day-${date}`)
      await expandDay(user, day, titleRe)

      expect(day.textContent).toContain('Husk / ta med')
      expect(day.textContent).toMatch(/drikkeflaske/i)
      expect(day.textContent).toMatch(/matpakke/i)
      expect(day.textContent).toMatch(/ekstra (t-skjorte|klær)/i)
      expect(within(day).queryByText('t', { exact: true })).toBeNull()
      expect(within(day).queryByText('skjorte', { exact: true })).toBeNull()

      const notesBlocks = within(day).queryAllByTestId(`tankestrom-schedule-notes-${date}`)
      expect(notesBlocks.length).toBeLessThanOrEqual(1)
      if (notesBlocks.length === 1) {
        const text = notesBlocks[0]!.textContent ?? ''
        const repeated = text.split('Foreldre hjelper med rydding etter siste kamp.').length - 1
        expect(repeated).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('TankestromImportDialog preview (Vårcupen)', () => {
  beforeEach(() => {
    vi.mocked(analyzeTextWithTankestrom).mockResolvedValue(vaacupBundle)
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const forbiddenSnippets = ['16:50', '19:15', '20:00', '18:40 Oppmøte'] as const

  it('viser riktige høydepunkter for fredag og lørdag uten uønskede snutter', async () => {
    const user = userEvent.setup()
    await renderReview(user)

    expect(screen.getByTestId('tankestrom-import-confirm').textContent).toContain(
      'Importer valgte (1 arrangement / 2 hendelser)'
    )

    const friday = screen.getByTestId('tankestrom-delprogram-day-2026-06-12')
    expect(friday.textContent).toContain('Vårcupen – fredag')
    await expandDay(user, friday, /Vårcupen.*– fredag/)
    const friHi = await within(friday).findByTestId('tankestrom-schedule-highlights-2026-06-12')
    expect(friHi.textContent).toContain('17:45')
    expect(friHi.textContent).toContain('Oppmøte')
    expect(friHi.textContent).toContain('18:40')
    expect(friHi.textContent).toContain('Første kamp')
    for (const bad of forbiddenSnippets) expect(friHi.textContent).not.toContain(bad)

    const saturday = screen.getByTestId('tankestrom-delprogram-day-2026-06-13')
    await expandDay(user, saturday, /Vårcupen.*– lørdag/)
    const lorHi = await within(saturday).findByTestId('tankestrom-schedule-highlights-2026-06-13')
    for (const t of ['08:35', 'Oppmøte før første kamp', '09:20', 'Første kamp', '14:25', 'Oppmøte før andre kamp', '15:10', 'Andre kamp']) {
      expect(lorHi.textContent).toContain(t)
    }
    for (const bad of forbiddenSnippets) expect(lorHi.textContent).not.toContain(bad)
  })

  it('markerer søndag som foreløpig uten uønskede høydepunkt-snutter', async () => {
    const user = userEvent.setup()
    await renderReview(user)

    const sunday = screen.getByTestId('tankestrom-delprogram-day-2026-06-14')
    expect(sunday.textContent).toContain('Vårcupen – søndag')
    expect(within(sunday).getByText('Foreløpig')).toBeTruthy()
    await expandDay(user, sunday, /Vårcupen.*– søndag/)
    expect(await within(sunday).findByText('Ikke endelig avklart')).toBeTruthy()
    for (const bad of forbiddenSnippets) expect(sunday.textContent).not.toContain(bad)
  })
})
