// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parsePortalImportProposalBundle } from '../../../lib/tankestromApi'
import { TankestromImportDialog } from '../TankestromImportDialog'
import { getTankestromAnalyzePickBlockedReason } from '../useTankestromImport'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HOSTCUP_ANALYZE_JSON_PATH = join(__dirname, '../../../../e2e/fixtures/hostcup-analyze-response.json')
const HOSTCUP_TEXT_PATH = join(__dirname, '../../../../e2e/fixtures/hostcup-original.txt')

const hostcupBundle = parsePortalImportProposalBundle(
  JSON.parse(readFileSync(HOSTCUP_ANALYZE_JSON_PATH, 'utf8'))
)
const hostcupText = readFileSync(HOSTCUP_TEXT_PATH, 'utf8')

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

function renderImportDialog(open = true) {
  return render(
    <TankestromImportDialog
      open={open}
      onClose={() => undefined}
      people={people}
      createEvent={vi.fn()}
      createTask={vi.fn()}
    />
  )
}

describe('getTankestromAnalyzePickBlockedReason', () => {
  it('blokkerer fil-modus uten filer', () => {
    expect(
      getTankestromAnalyzePickBlockedReason({
        hasPeople: true,
        inputMode: 'file',
        pendingFileCount: 0,
        textInput: 'noe tekst',
      })
    ).toBe('file_mode_no_files')
  })

  it('blokkerer tekst-modus uten innhold', () => {
    expect(
      getTankestromAnalyzePickBlockedReason({
        hasPeople: true,
        inputMode: 'text',
        pendingFileCount: 0,
        textInput: '   ',
      })
    ).toBe('text_mode_empty')
  })
})

describe('TankestromImportDialog analyze → preview', () => {
  beforeEach(() => {
    vi.mocked(analyzeTextWithTankestrom).mockResolvedValue(hostcupBundle)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('åpner tekstfelt som standard (ingen Fil→Tekst-klikk)', () => {
    renderImportDialog()
    expect(screen.getByTestId('tankestrom-import-text')).toBeTruthy()
  })

  it('Analyser-knappen er enabled etter utfylt tekst uten Tekst-modusklikk', async () => {
    const user = userEvent.setup()
    renderImportDialog()

    await user.type(screen.getByTestId('tankestrom-import-text'), hostcupText.slice(0, 120))
    const analyzeBtn = screen.getByTestId('tankestrom-analyze') as HTMLButtonElement
    expect(analyzeBtn.disabled).toBe(false)
  })

  it('Analyser-knappen kaller API uten Tekst-modusklikk (default tekst-modus)', async () => {
    const user = userEvent.setup()
    renderImportDialog()

    await user.type(screen.getByTestId('tankestrom-import-text'), hostcupText.slice(0, 200))
    await user.click(screen.getByTestId('tankestrom-analyze'))

    await waitFor(() => {
      expect(analyzeTextWithTankestrom).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByText('Limt inn tekst', { exact: true })).toBeTruthy()
    })
  })

  it('fil-modus uten filer: Analyser disabled og kaller ikke API', async () => {
    const user = userEvent.setup()
    renderImportDialog()

    await user.click(screen.getByRole('button', { name: 'Fil' }))
    const analyzeBtn = screen.getByTestId('tankestrom-analyze') as HTMLButtonElement
    expect(analyzeBtn.disabled).toBe(true)
    expect(screen.getByTestId('tankestrom-analyze-blocked-hint').textContent).toMatch(/Velg minst én fil/i)

    await user.click(analyzeBtn)
    expect(analyzeTextWithTankestrom).not.toHaveBeenCalled()
  })
})
