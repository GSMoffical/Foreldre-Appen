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

import { analyzeTextWithTankestrom } from '../../../lib/tankestromApi'

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
})
