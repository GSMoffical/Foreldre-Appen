// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parsePortalImportProposalBundle } from '../../../lib/tankestromApi'
import { TankestrømPage } from '../TankestrømPage'

/**
 * Kjørbar smoke for dagens primærflyt (Mer → Tankestrøm → TankestrømPage).
 * Speiler det browser-E2E-en gjør, men kan kjøres lokalt uten login/Supabase,
 * og verifiserer de samme selektorene/CTA-ene E2E-en bruker.
 */
const __dirname = dirname(fileURLToPath(import.meta.url))
const HOSTCUP_ANALYZE_JSON_PATH = join(__dirname, '../../../../e2e/fixtures/hostcup-analyze-response.json')

const hostcupBundle = parsePortalImportProposalBundle(
  JSON.parse(readFileSync(HOSTCUP_ANALYZE_JSON_PATH, 'utf8'))
)

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

import { analyzeTextWithTankestrom, analyzeDocumentWithTankestrom } from '../../../lib/tankestromApi'

/** Enkelthendelse-bundle (ikke cup/embedded) for rich-single-event-tester. */
function makeSingleEventBundle(event: Record<string, unknown>) {
  return parsePortalImportProposalBundle({
    schemaVersion: '1.0.0',
    provenance: {
      sourceSystem: 'tankestrom',
      sourceType: 'e2e_fixture',
      generatorVersion: 'test',
      generatedAt: '2026-05-08T20:00:00.000Z',
      importRunId: 'single-1',
    },
    items: [
      {
        proposalId: 'a1b2c3d4-1111-4abc-9def-000000000001',
        kind: 'event',
        sourceId: 'e2e',
        originalSourceType: 'pasted_text',
        confidence: 0.95,
        event: {
          date: '2026-09-10',
          personId: '',
          title: 'Samling ved Sognsvann i morgen',
          start: '18:00',
          end: '',
          metadata: {},
          ...event,
        },
      },
    ],
  })
}

function renderPage() {
  return render(
    <TankestrømPage
      onBack={() => undefined}
      people={people}
      createEvent={vi.fn()}
      createTask={vi.fn()}
    />
  )
}

describe('TankestrømPage primærflyt-smoke', () => {
  beforeEach(() => {
    vi.mocked(analyzeTextWithTankestrom).mockResolvedValue(hostcupBundle)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('lim inn tekst → Analyser tekst → viser forslag og import-CTA', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    await waitFor(() => {
      expect(analyzeTextWithTankestrom).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText('Foreslåtte hendelser')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Legg til \d+ hendelse/i })).toBeTruthy()
  })

  it('viser rik forhåndsvisning: hovedarrangement + dagsblokker med høydepunkter og foreløpig-markering', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    // Fredag: dagsblokk med tittel, høydepunkter og «husk / ta med».
    const friday = await screen.findByTestId('tankestrom-day-2026-09-18')
    expect(friday.textContent).toContain('Høstcupen – fredag')
    expect(friday.textContent).toContain('17:30')
    expect(friday.textContent).toContain('Oppmøte')
    expect(friday.textContent).toMatch(/drikkeflaske/i)

    expect(screen.getByTestId('tankestrom-day-2026-09-19').textContent).toContain('Høstcupen – lørdag')

    // Søndag er tentativ → tydelig «Foreløpig»-markering.
    const sunday = screen.getByTestId('tankestrom-day-2026-09-20')
    expect(sunday.textContent).toContain('Høstcupen – søndag')
    expect(sunday.textContent).toContain('Foreløpig')

    // Import-knappen teller faktiske dagshendelser (fre + lør), ikke parent-kortet.
    const importBtn = screen.getByRole('button', { name: /Legg til \d+ hendelse/i })
    expect(importBtn.textContent).toContain('Legg til 2 hendelser')
    expect(importBtn.textContent).not.toContain('Legg til 1 hendelse')
  })

  it('viser tydelig feilmelding når importen ikke lagrer (ingen stille feil)', async () => {
    const user = userEvent.setup()
    const createEvent = vi.fn().mockRejectedValue(new Error('persist boom'))
    render(
      <TankestrømPage
        onBack={() => undefined}
        people={people}
        createEvent={createEvent}
        createTask={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    const importBtn = await screen.findByRole('button', { name: /Legg til \d+ hendelse/i })
    await user.click(importBtn)

    // Persist ble forsøkt, og brukeren får en synlig feilmelding (ikke bare «laster»).
    await waitFor(() => expect(createEvent).toHaveBeenCalled())
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts.some((a) => (a.textContent ?? '').trim().length > 0)).toBe(true)
  })

  it('viser gjøremål-forslag i preview når analysen returnerer en (primær) task', async () => {
    const taskBundle = parsePortalImportProposalBundle({
      schemaVersion: '1.0.0',
      provenance: {
        sourceSystem: 'tankestrom',
        sourceType: 'e2e_fixture',
        generatorVersion: 'test',
        generatedAt: '2026-05-08T20:00:00.000Z',
        importRunId: 'task-1',
      },
      items: [
        {
          proposalId: 'b1e2c3d4-5678-4abc-9def-0123456789ab',
          kind: 'task',
          sourceId: 'e2e',
          originalSourceType: 'pasted_text',
          confidence: 0.95,
          task: { title: 'Betal turneringsavgift', date: '2026-09-10' },
        },
      ],
    })
    vi.mocked(analyzeTextWithTankestrom).mockResolvedValueOnce(taskBundle)

    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Betal avgift innen fredag')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    // Gjøremål vises i egen «Foreslåtte gjøremål»-seksjon, ikke blandet med hendelser/dagsblokker.
    expect(await screen.findByText('Foreslåtte gjøremål')).toBeTruthy()
    expect(screen.getByText('Betal turneringsavgift')).toBeTruthy()
  })

  it('gir embedded cup-dager gyldig person_id ved import (eneste barn som default)', async () => {
    const user = userEvent.setup()
    const createEvent = vi.fn().mockResolvedValue(undefined)
    render(
      <TankestrømPage
        onBack={() => undefined}
        people={people}
        createEvent={createEvent}
        createTask={vi.fn()}
        onImportFinished={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    const importBtn = await screen.findByRole('button', { name: /Legg til \d+ hendelse/i })
    await user.click(importBtn)

    await waitFor(() => expect(createEvent).toHaveBeenCalled())
    // Hver dags-hendelse settes inn med barnets person_id – aldri null.
    for (const call of createEvent.mock.calls) {
      const input = call[1] as { personId?: string | null }
      expect(input.personId).toBe('person-a')
    }
  })

  it('blokkerer import med forståelig melding (ikke rå DB-feil) når flere barn finnes og ingen er valgt', async () => {
    const user = userEvent.setup()
    const createEvent = vi.fn().mockResolvedValue(undefined)
    const twoChildren = [
      { id: 'child-a', name: 'Ada', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
      { id: 'child-b', name: 'Bo', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
    ]
    render(
      <TankestrømPage
        onBack={() => undefined}
        people={twoChildren}
        createEvent={createEvent}
        createTask={vi.fn()}
        onImportFinished={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    const importBtn = await screen.findByRole('button', { name: /Legg til \d+ hendelse/i })
    await user.click(importBtn)

    expect(await screen.findByText(/Vi vet ikke hvem hendelsene gjelder/i)).toBeTruthy()
    expect(createEvent).not.toHaveBeenCalled()
  })

  it('viser personvelger i TankestrømPage når familien har flere barn', async () => {
    const user = userEvent.setup()
    const twoChildren = [
      { id: 'child-a', name: 'Ada', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
      { id: 'child-b', name: 'Bo', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
    ]
    render(
      <TankestrømPage onBack={() => undefined} people={twoChildren} createEvent={vi.fn()} createTask={vi.fn()} />
    )

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    expect(await screen.findByText('Hvem gjelder dette?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ada' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bo' })).toBeTruthy()
  })

  it('etter valg av barn importeres embedded cup-dager med valgt person_id', async () => {
    const user = userEvent.setup()
    const createEvent = vi.fn().mockResolvedValue(undefined)
    const twoChildren = [
      { id: 'child-a', name: 'Ada', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
      { id: 'child-b', name: 'Bo', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
    ]
    render(
      <TankestrømPage
        onBack={() => undefined}
        people={twoChildren}
        createEvent={createEvent}
        createTask={vi.fn()}
        onImportFinished={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    // Velg Bo, så importer.
    await user.click(await screen.findByRole('button', { name: 'Bo' }))
    await user.click(await screen.findByRole('button', { name: /Legg til \d+ hendelse/i }))

    await waitFor(() => expect(createEvent).toHaveBeenCalled())
    for (const call of createEvent.mock.calls) {
      const input = call[1] as { personId?: string | null }
      expect(input.personId).toBe('child-b')
    }
  })

  it('viser ikke personvelger for familie med ett barn (auto-default)', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    await screen.findByRole('button', { name: /Legg til \d+ hendelse/i })
    expect(screen.queryByText('Hvem gjelder dette?')).toBeNull()
  })

  it('personvelger viser både barn og voksne/familiemedlemmer', async () => {
    const user = userEvent.setup()
    const family = [
      { id: 'child-a', name: 'Ada', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
      { id: 'parent-a', name: 'Mor', memberKind: 'parent' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
    ]
    render(
      <TankestrømPage onBack={() => undefined} people={family} createEvent={vi.fn()} createTask={vi.fn()} />
    )

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    expect(await screen.findByText('Hvem gjelder dette?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ada' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mor' })).toBeTruthy()
  })

  it('multi-valg: hver cup-dag lagres som én hendelse med begge valgte personer som deltakere', async () => {
    const user = userEvent.setup()
    const createEvent = vi.fn().mockResolvedValue(undefined)
    const twoChildren = [
      { id: 'child-a', name: 'Ada', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
      { id: 'child-b', name: 'Bo', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
    ]
    render(
      <TankestrømPage
        onBack={() => undefined}
        people={twoChildren}
        createEvent={createEvent}
        createTask={vi.fn()}
        onImportFinished={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    await user.click(await screen.findByRole('button', { name: 'Ada' }))
    await user.click(screen.getByRole('button', { name: 'Bo' }))
    await user.click(await screen.findByRole('button', { name: /Legg til \d+ hendelse/i }))

    await waitFor(() => expect(createEvent).toHaveBeenCalled())
    // Deltakerliste-modell: 2 valgte dager = 2 inserts (ikke 4), hver med begge som deltakere.
    expect(createEvent.mock.calls.length).toBe(2)
    for (const call of createEvent.mock.calls) {
      const input = call[1] as { personId?: string | null; metadata?: { participants?: string[] } }
      expect(input.personId).toBeTruthy()
      expect(input.metadata?.participants).toEqual(expect.arrayContaining(['child-a', 'child-b']))
    }
  })

  it('CTA teller faktiske hendelser (dager), ikke antall × personer', async () => {
    const user = userEvent.setup()
    const twoChildren = [
      { id: 'child-a', name: 'Ada', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
      { id: 'child-b', name: 'Bo', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
    ]
    render(
      <TankestrømPage onBack={() => undefined} people={twoChildren} createEvent={vi.fn()} createTask={vi.fn()} />
    )

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    await user.click(await screen.findByRole('button', { name: 'Ada' }))
    await user.click(screen.getByRole('button', { name: 'Bo' }))

    const importBtn = screen.getByRole('button', { name: /Legg til \d+ hendelse/i })
    expect(importBtn.textContent).toContain('Legg til 2 hendelser')
  })

  it('bruker kan avvelge en person igjen', async () => {
    const user = userEvent.setup()
    const createEvent = vi.fn().mockResolvedValue(undefined)
    const twoChildren = [
      { id: 'child-a', name: 'Ada', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
      { id: 'child-b', name: 'Bo', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
    ]
    render(
      <TankestrømPage
        onBack={() => undefined}
        people={twoChildren}
        createEvent={createEvent}
        createTask={vi.fn()}
        onImportFinished={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    await user.click(await screen.findByRole('button', { name: 'Ada' }))
    await user.click(screen.getByRole('button', { name: 'Bo' }))
    await user.click(screen.getByRole('button', { name: 'Bo' })) // avvelg Bo igjen

    await user.click(await screen.findByRole('button', { name: /Legg til \d+ hendelse/i }))
    await waitFor(() => expect(createEvent).toHaveBeenCalled())
    // Kun Ada gjelder nå – ingen deltakerliste.
    for (const call of createEvent.mock.calls) {
      const input = call[1] as { personId?: string | null; metadata?: { participants?: string[] } }
      expect(input.personId).toBe('child-a')
      expect(input.metadata?.participants).toBeUndefined()
    }
  })

  it('avvelg alle: import blokkeres med rolig melding og createEvent kalles ikke (ikke forrige valg)', async () => {
    const user = userEvent.setup()
    const createEvent = vi.fn().mockResolvedValue(undefined)
    const twoChildren = [
      { id: 'child-a', name: 'Ada', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
      { id: 'child-b', name: 'Bo', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
    ]
    render(
      <TankestrømPage
        onBack={() => undefined}
        people={twoChildren}
        createEvent={createEvent}
        createTask={vi.fn()}
        onImportFinished={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    await user.click(await screen.findByRole('button', { name: 'Ada' }))
    await user.click(screen.getByRole('button', { name: 'Bo' }))
    await user.click(screen.getByRole('button', { name: 'Ada' })) // avvelg
    await user.click(screen.getByRole('button', { name: 'Bo' })) // avvelg → ingen valgt

    await user.click(await screen.findByRole('button', { name: /Legg til \d+ hendelse/i }))

    expect(await screen.findByText(/Vi vet ikke hvem hendelsene gjelder/i)).toBeTruthy()
    expect(createEvent).not.toHaveBeenCalled()
  })

  it('velg én → avvelg → velg en annen → import bruker den nye personen, ikke den gamle', async () => {
    const user = userEvent.setup()
    const createEvent = vi.fn().mockResolvedValue(undefined)
    const twoChildren = [
      { id: 'child-a', name: 'Ada', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
      { id: 'child-b', name: 'Bo', memberKind: 'child' as const, colorTint: 'bg-slate-200', colorAccent: 'border-slate-400' },
    ]
    render(
      <TankestrømPage
        onBack={() => undefined}
        people={twoChildren}
        createEvent={createEvent}
        createTask={vi.fn()}
        onImportFinished={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Høstcupen 2026 test')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))

    await user.click(await screen.findByRole('button', { name: 'Ada' })) // velg Ada
    await user.click(screen.getByRole('button', { name: 'Ada' })) // avvelg Ada
    await user.click(screen.getByRole('button', { name: 'Bo' })) // velg Bo

    await user.click(await screen.findByRole('button', { name: /Legg til \d+ hendelse/i }))
    await waitFor(() => expect(createEvent).toHaveBeenCalled())
    for (const call of createEvent.mock.calls) {
      const input = call[1] as { personId?: string | null }
      expect(input.personId).toBe('child-b')
    }
  })

  it('viser både opplasting og lim-inn-tekst', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Last opp fil' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Eller lim inn tekst/i })).toBeTruthy()
  })

  it('filopplasting kaller dokument-analyse (ikke tekst) og ender i rich preview + viser filnavn', async () => {
    const user = userEvent.setup()
    vi.mocked(analyzeDocumentWithTankestrom).mockResolvedValueOnce(hostcupBundle)
    renderPage()

    const file = new File(['dummy'], 'cup.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Velg filer til analyse'), file)

    // Riktig analyse-handler kalles for fil — ikke tekst-grenen.
    await waitFor(() => expect(analyzeDocumentWithTankestrom).toHaveBeenCalledTimes(1))
    expect(analyzeTextWithTankestrom).not.toHaveBeenCalled()

    // Valgt fil vises med navn, og rich preview kommer opp.
    expect(screen.getByText('cup.pdf')).toBeTruthy()
    expect(await screen.findByText('Foreslåtte hendelser')).toBeTruthy()
  })

  it('viser forståelig feilmelding når filanalyse feiler (ikke rå feil)', async () => {
    const user = userEvent.setup()
    vi.mocked(analyzeDocumentWithTankestrom).mockRejectedValueOnce(new Error('Filtypen støttes ikke'))
    renderPage()

    // Støttet filtype (passerer input-accept), men selve analysen feiler.
    const file = new File(['dummy'], 'cup.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Velg filer til analyse'), file)

    await waitFor(() => expect(analyzeDocumentWithTankestrom).toHaveBeenCalled())
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((a) => (a.textContent ?? '').trim().length > 0)).toBe(true)
  })

  async function analyzeSingleEvent(
    user: ReturnType<typeof userEvent.setup>,
    event: Record<string, unknown>
  ) {
    vi.mocked(analyzeTextWithTankestrom).mockResolvedValueOnce(makeSingleEventBundle(event))
    await user.click(screen.getByRole('button', { name: /Eller lim inn tekst/i }))
    await user.type(screen.getByPlaceholderText(/Lim inn ukeplan/i), 'Samling i morgen 18:00')
    await user.click(screen.getByRole('button', { name: 'Analyser tekst' }))
    await screen.findByText('Foreslåtte hendelser')
  }

  it('enkelthendelse: viser tidspunkt, notat/beskrivelse og sted når data finnes', async () => {
    const user = userEvent.setup()
    renderPage()
    await analyzeSingleEvent(user, {
      location: 'Sognsvann',
      notes: 'Ta med drikke. Vi møtes ved bommen.',
    })

    // Tidspunkt vises i kort-sublabelen selv uten sluttid (ikke forveksle med tekstfeltet).
    expect(screen.getByText(/· 18:00/)).toBeTruthy()
    // Notat/beskrivelse vises.
    expect(screen.getByText(/Ta med drikke\. Vi møtes ved bommen\./)).toBeTruthy()
    // Sted vises.
    const stedLabel = screen.getByText('Sted:')
    expect(stedLabel.closest('p')?.textContent).toContain('Sognsvann')
  })

  it('enkelthendelse: viser ta-med-info fra metadata (bringItems)', async () => {
    const user = userEvent.setup()
    renderPage()
    await analyzeSingleEvent(user, {
      notes: '',
      metadata: { bringItems: ['drikkeflaske', 'matpakke'] },
    })

    expect(screen.getByText('Husk / ta med')).toBeTruthy()
    expect(screen.getByText(/drikkeflaske/)).toBeTruthy()
  })

  it('enkelthendelse uten ekstra detaljer: ren visning, ingen tomme seksjoner', async () => {
    const user = userEvent.setup()
    renderPage()
    await analyzeSingleEvent(user, { notes: '', location: '', end: '19:00', metadata: {} })

    expect(screen.getByText('Samling ved Sognsvann i morgen')).toBeTruthy()
    expect(screen.queryByText('Sted:')).toBeNull()
    expect(screen.queryByText('Notater')).toBeNull()
    expect(screen.queryByText('Husk / ta med')).toBeNull()
  })

  it('enkelthendelse: import beholder notat/beskrivelse i createEvent-payload', async () => {
    const user = userEvent.setup()
    const createEvent = vi.fn().mockResolvedValue(undefined)
    render(
      <TankestrømPage
        onBack={() => undefined}
        people={people}
        createEvent={createEvent}
        createTask={vi.fn()}
        onImportFinished={() => undefined}
      />
    )
    // Komplett tidsrom her — manglende sluttid er ortogonalt og utenfor denne PR-en.
    await analyzeSingleEvent(user, {
      end: '19:00',
      location: 'Sognsvann',
      notes: 'Ta med drikke. Vi møtes ved bommen.',
    })

    await user.click(await screen.findByRole('button', { name: /Legg til \d+ hendelse/i }))
    await waitFor(() => expect(createEvent).toHaveBeenCalled())
    const input = createEvent.mock.calls[0]![1] as { notes?: string; location?: string }
    expect(input.notes ?? '').toContain('Ta med drikke')
    expect(input.location).toBe('Sognsvann')
  })
})
