import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const vaacupText = readFileSync(join(here, 'fixtures', 'vaacup-original.txt'), 'utf-8')
const vaacupAnalyzeJson = readFileSync(join(here, 'fixtures', 'vaacup-analyze-response.json'), 'utf-8')

const useMock = process.env.E2E_TANKESTROM_MOCK !== 'false'

/** Teller mock-treff (deles mellom beforeEach og test for diagnostikk). */
const mockStats = { options: 0, post: 0, lastPostUrl: '' as string }

function analyzeUrlMatches(url: URL): boolean {
  const p = url.pathname
  if (p.includes('/api/analyze')) return true
  if (/\/analyze(\/|\?|$)/i.test(p)) return true
  return url.href.includes('/api/analyze')
}

async function loginAndOpenCalendar(page: import('@playwright/test').Page) {
  const email = process.env.E2E_LOGIN_EMAIL?.trim()
  const password = process.env.E2E_LOGIN_PASSWORD?.trim()
  const hasE2EEmail = Boolean(email)
  const hasE2EPassword = Boolean(password)
  test.skip(!email || !password, 'Sett E2E_LOGIN_EMAIL og E2E_LOGIN_PASSWORD for innlogging.')

  const innstillinger = page.getByRole('button', { name: /Innstillinger/i }).first()
  const kalender = page.getByRole('button', { name: /Kalender/i }).first()
  const oppgaver = page.getByRole('button', { name: /Oppgaver/i }).first()
  const familyHeading = page.getByRole('heading', { name: 'Familie' }).first()
  const waitForAuthenticatedShell = async (timeoutMs: number) => {
    const candidates = [innstillinger, kalender, oppgaver, familyHeading]
    await Promise.any(candidates.map((locator) => locator.waitFor({ state: 'visible', timeout: timeoutMs })))
  }

  await page.goto('/')
  if (await innstillinger.isVisible().catch(() => false)) return

  await page.getByLabel('E-post').fill(email)
  await page.getByLabel('Passord').fill(password)
  await page.getByRole('button', { name: 'Logg inn' }).click()
  try {
    await waitForAuthenticatedShell(25_000)
  } catch {
    const hasSupabaseUrl = Boolean(process.env.VITE_SUPABASE_URL?.trim())
    const hasSupabaseAnonKey = Boolean(process.env.VITE_SUPABASE_ANON_KEY?.trim())
    const hasAnalyzeUrl = Boolean(process.env.VITE_TANKESTROM_ANALYZE_URL?.trim())
    const currentUrl = page.url()
    const loginErrorText = (
      (await page.locator('p.text-rose-600, [role="alert"]').first().textContent().catch(() => '')) ?? ''
    ).trim()
    const bodyText = (
      (await page.locator('body').innerText().catch(() => '')) ?? ''
    )
      .replace(/\s+/g, ' ')
      .slice(0, 500)
    const screenshotPath = `test-results/login-failure-vaacup-${Date.now()}.png`
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined)
    throw new Error(
      `Innlogging nådde ikke en stabil "innlogget"-tilstand innen 25s. currentURL=${currentUrl}. hasE2EEmail=${hasE2EEmail}, hasE2EPassword=${hasE2EPassword}, hasSupabaseUrl=${hasSupabaseUrl}, hasSupabaseAnonKey=${hasSupabaseAnonKey}, hasAnalyzeUrl=${hasAnalyzeUrl}. loginError="${loginErrorText || '—'}". bodySnippet="${bodyText || '—'}". screenshot="${screenshotPath}".`
    )
  }

  const skipFamily = page.getByRole('button', { name: 'Hopp over for nå' })
  if (await skipFamily.isVisible().catch(() => false)) {
    await skipFamily.click()
    await waitForAuthenticatedShell(15_000)
  }
}

test.describe('Tankestrom Vårcupen import-preview', () => {
  test.describe.configure({ timeout: 90_000 })

  test.beforeEach(async ({ page }) => {
    mockStats.options = 0
    mockStats.post = 0
    mockStats.lastPostUrl = ''

    if (!useMock) return

    await page.route(analyzeUrlMatches, async (route) => {
      const req = route.request()
      const method = req.method()
      const url = req.url()

      if (method === 'OPTIONS') {
        mockStats.options += 1
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          },
        })
        return
      }
      if (method !== 'POST') {
        await route.continue()
        return
      }
      mockStats.post += 1
      mockStats.lastPostUrl = url
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: vaacupAnalyzeJson,
      })
    })
  })

  test('viser forventet delprogram og høydepunkter (Vårcupen)', async ({ page }) => {
    await loginAndOpenCalendar(page)

    await page.getByRole('button', { name: /Innstillinger/i }).click()
    await page.getByTestId('tankestrom-import-open').click()

    const dialog = page.getByTestId('tankestrom-import-dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Tekst' }).click()
    const textBox = dialog.getByTestId('tankestrom-import-text')
    await textBox.fill(vaacupText)
    await expect(textBox).toHaveValue(vaacupText)

    const analyzeBtn = dialog.getByTestId('tankestrom-analyze')
    await expect(analyzeBtn, 'Analyser-knappen må være aktiv (familie må være lastet).').toBeEnabled({
      timeout: 15_000,
    })
    await analyzeBtn.click()

    // Review-header for tekstmodus viser alltid «Limt inn tekst» (unik for review, ikke pick-skjerm).
    // Unngå getByRole('button', { name: 'Analyser på nytt' }): ved loading=true har Button kun spinner (aria-hidden), uten tekstnavn.
    const reviewHeaderMarker = dialog.getByText('Limt inn tekst', { exact: true })
    const dialogError = dialog.locator('p.text-rose-600').first()

    let outcome: 'review' | 'error' | 'timeout'
    try {
      outcome = await Promise.race([
        reviewHeaderMarker.waitFor({ state: 'visible', timeout: 65_000 }).then(() => 'review' as const),
        dialogError.waitFor({ state: 'visible', timeout: 65_000 }).then(() => 'error' as const),
      ])
    } catch {
      outcome = 'timeout'
    }

    if (outcome === 'error') {
      const msg = (await dialogError.textContent())?.trim() ?? '(tom feilmelding)'
      throw new Error(
        `Analyse feilet i UI: ${msg}. Mock POST-treff: ${mockStats.post}, OPTIONS: ${mockStats.options}, siste POST-URL: ${mockStats.lastPostUrl || '—'}`
      )
    }
    if (outcome === 'timeout') {
      throw new Error(
        `Verken review («Limt inn tekst») eller feilmelding innen 65s. Mock POST-treff: ${mockStats.post}, OPTIONS: ${mockStats.options}, siste POST-URL: ${mockStats.lastPostUrl || '—'}. Sjekk trace (Network + skjermbilde).`
      )
    }

    await expect(reviewHeaderMarker).toBeVisible()

    if (useMock) {
      expect(
        mockStats.post,
        `Mock traff ikke POST til analyse-URL (post=${mockStats.post}, options=${mockStats.options}). Sjekk VITE_TANKESTROM_ANALYZE_URL (f.eks. i .env.local) og trace under Network. Siste POST: ${mockStats.lastPostUrl || '—'}`
      ).toBeGreaterThan(0)
    }

    const confirm = page.getByTestId('tankestrom-import-confirm')
    await expect(confirm).toBeVisible({ timeout: 15_000 })
    await expect(confirm).toContainText('Importer valgte (1 arrangement / 3 hendelser)')

    const friday = dialog.getByTestId('tankestrom-delprogram-day-2026-06-12')
    const saturday = dialog.getByTestId('tankestrom-delprogram-day-2026-06-13')
    const sunday = dialog.getByTestId('tankestrom-delprogram-day-2026-06-14')

    await expect(friday).toBeVisible()
    await expect(saturday).toBeVisible()
    await expect(sunday).toBeVisible()

    await expect(friday).toContainText(/Vårcupen.*– fredag/)
    await expect(saturday).toContainText(/Vårcupen.*– lørdag/)
    await expect(sunday).toContainText(/Vårcupen.*– søndag/)

    /** Ikke ønskede «høydepunkt»-snutter i program (fredag/lørdag/søndag). */
    const forbiddenHighlightSnippets = ['16:50', '19:15', '20:00', '18:40 Oppmøte'] as const

    await friday.getByRole('button', { name: /Vårcupen.*– fredag/ }).click()
    const friHi = friday.getByTestId('tankestrom-schedule-highlights-2026-06-12')
    await expect(friHi).toBeVisible()
    await expect(friHi).toContainText('17:45')
    await expect(friHi).toContainText('Oppmøte')
    await expect(friHi).toContainText('18:40')
    await expect(friHi).toContainText('Første kamp')
    for (const bad of forbiddenHighlightSnippets) {
      await expect(friHi).not.toContainText(bad)
    }

    await saturday.getByRole('button', { name: /Vårcupen.*– lørdag/ }).click()
    const lorHi = saturday.getByTestId('tankestrom-schedule-highlights-2026-06-13')
    await expect(lorHi).toBeVisible()
    await expect(lorHi).toContainText('08:35')
    await expect(lorHi).toContainText('Oppmøte før første kamp')
    await expect(lorHi).toContainText('09:20')
    await expect(lorHi).toContainText('Første kamp')
    await expect(lorHi).toContainText('14:25')
    await expect(lorHi).toContainText('Oppmøte før andre kamp')
    await expect(lorHi).toContainText('15:10')
    await expect(lorHi).toContainText('Andre kamp')
    for (const bad of forbiddenHighlightSnippets) {
      await expect(lorHi).not.toContainText(bad)
    }

    await expect(sunday.getByText('Foreløpig')).toBeVisible()
    await sunday.getByRole('button', { name: /Vårcupen.*– søndag/ }).click()
    await expect(sunday.getByText('Ikke endelig avklart')).toBeVisible()

    // Read-only UI rendrer ikke nødvendigvis notes-testid for søndag; krev maks én notes-boks (ingen dobbel notes).
    const sunNotesBlocks = sunday.locator('[data-testid="tankestrom-schedule-notes-2026-06-14"]')
    const sunNotesBlockCount = await sunNotesBlocks.count()
    expect(
      sunNotesBlockCount,
      'Søndag skal ha 0 eller 1 strukturert notes-blokk (ikke dobbel notes-rendering).'
    ).toBeLessThanOrEqual(1)
    if (sunNotesBlockCount === 1) {
      const noteItems = sunNotesBlocks.first().locator('ul li')
      expect(await noteItems.count(), 'Når notes vises: én rad, ikke duplikatliste').toBeLessThanOrEqual(1)
    }

    const sunHi = sunday.getByTestId('tankestrom-schedule-highlights-2026-06-14')
    if ((await sunHi.count()) > 0) {
      await expect(sunHi).toBeVisible()
      for (const bad of forbiddenHighlightSnippets) {
        await expect(sunHi).not.toContainText(bad)
      }
    }

    for (const bad of forbiddenHighlightSnippets) {
      await expect(sunday).not.toContainText(bad)
    }
  })
})
