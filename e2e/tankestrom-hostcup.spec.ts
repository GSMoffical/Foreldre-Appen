import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const hostcupText = readFileSync(join(here, 'fixtures', 'hostcup-original.txt'), 'utf-8')
const hostcupAnalyzeJson = readFileSync(join(here, 'fixtures', 'hostcup-analyze-response.json'), 'utf-8')

const useMock = process.env.E2E_TANKESTROM_MOCK !== 'false'

const mockStats = { options: 0, post: 0, lastPostUrl: '' as string }

function analyzeUrlMatches(url: URL): boolean {
  const p = url.pathname
  if (p.includes('/api/analyze')) return true
  if (/\/analyze(\/|\?|$)/i.test(p)) return true
  return url.href.includes('/api/analyze')
}

/** Nye brukere kan få onboarding-flyten rett etter login; skru trygt forbi den. */
async function dismissOnboardingIfPresent(page: import('@playwright/test').Page) {
  const onboarding = page.getByRole('dialog', { name: 'Onboarding' })
  const appeared = await onboarding
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false)
  if (!appeared) return
  // Klikk gjennom velkomst-/hopp-over-stegene til dialogen forsvinner (maks 6 forsøk).
  const advanceButtonNames = [/Kom i gang/i, /Hopp over for nå/i, /Hopp over/i, /Åpne kalenderen/i]
  for (let i = 0; i < 6; i++) {
    if (!(await onboarding.isVisible().catch(() => false))) return
    let advanced = false
    for (const name of advanceButtonNames) {
      const btn = onboarding.getByRole('button', { name }).first()
      if (await btn.isVisible().catch(() => false)) {
        await btn.click().catch(() => undefined)
        advanced = true
        break
      }
    }
    if (!advanced) return
    await page.waitForTimeout(350)
  }
}

async function loginAndOpenCalendar(page: import('@playwright/test').Page) {
  const email = process.env.E2E_LOGIN_EMAIL?.trim()
  const password = process.env.E2E_LOGIN_PASSWORD?.trim()
  const hasE2EEmail = Boolean(email)
  const hasE2EPassword = Boolean(password)
  test.skip(!email || !password, 'Sett E2E_LOGIN_EMAIL og E2E_LOGIN_PASSWORD for innlogging.')

  // Etter navigasjons-redesignet er den innloggede shellen bunnmenyen (BottomNav),
  // ikke lenger topp-knapper «Innstillinger/Kalender/Oppgaver» eller en «Familie»-heading.
  const navHome = page.getByRole('button', { name: 'I dag', exact: true }).first()
  const navMonth = page.getByRole('button', { name: 'Måned', exact: true }).first()
  const navTasks = page.getByRole('button', { name: 'Gjøremål', exact: true }).first()
  const navMer = page.getByRole('button', { name: 'Mer', exact: true }).first()
  const waitForAuthenticatedShell = async (timeoutMs: number) => {
    const candidates = [navHome, navMonth, navTasks, navMer]
    await Promise.any(candidates.map((locator) => locator.waitFor({ state: 'visible', timeout: timeoutMs })))
  }

  await page.goto('/')
  if (await navMer.isVisible().catch(() => false)) return

  await page.getByLabel('E-post').fill(email)
  await page.getByRole('textbox', { name: 'Passord' }).fill(password)
  await page.getByRole('button', { name: 'Logg inn' }).click()

  // Nye brukere kan møte onboarding-flyten rett etter login; skru trygt forbi den
  // FØR vi venter på shellen (onboarding erstatter shellen mens den vises).
  await dismissOnboardingIfPresent(page)

  try {
    await waitForAuthenticatedShell(25_000)
  } catch {
    const hasSupabaseUrl = Boolean(process.env.VITE_SUPABASE_URL?.trim())
    const hasSupabaseAnonKey = Boolean(process.env.VITE_SUPABASE_ANON_KEY?.trim())
    const hasAnalyzeUrl = Boolean(process.env.VITE_TANKESTROM_ANALYZE_URL?.trim())
    const currentUrl = page.url()
    const loginButtonVisible = await page
      .getByRole('button', { name: 'Logg inn' })
      .isVisible()
      .catch(() => false)
    const onboardingVisible = await page
      .getByRole('dialog', { name: 'Onboarding' })
      .isVisible()
      .catch(() => false)
    const shellVisible = await navMer.isVisible().catch(() => false)
    const loginErrorText = (
      (await page.locator('p.text-rose-600, [role="alert"]').first().textContent().catch(() => '')) ?? ''
    ).trim()
    const bodyText = (
      (await page.locator('body').innerText().catch(() => '')) ?? ''
    )
      .replace(/\s+/g, ' ')
      .slice(0, 500)
    const screenshotPath = `test-results/login-failure-hostcup-${Date.now()}.png`
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined)
    throw new Error(
      `Innlogging nådde ikke en stabil "innlogget"-tilstand innen 25s. currentURL=${currentUrl}. hasE2EEmail=${hasE2EEmail}, hasE2EPassword=${hasE2EPassword}, hasSupabaseUrl=${hasSupabaseUrl}, hasSupabaseAnonKey=${hasSupabaseAnonKey}, hasAnalyzeUrl=${hasAnalyzeUrl}. loginButtonVisible=${loginButtonVisible}, onboardingVisible=${onboardingVisible}, shellVisible=${shellVisible}. loginError="${loginErrorText || '—'}". bodySnippet="${bodyText || '—'}". screenshot="${screenshotPath}".`
    )
  }
}

test.describe('Tankestrom Høstcupen import-preview', () => {
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
        body: hostcupAnalyzeJson,
      })
    })
  })

  test('åpner Tankestrøm fra Mer og viser forslag etter analyse (Høstcupen, smoke)', async ({ page }) => {
    await loginAndOpenCalendar(page)

    // Dagens primærflyt: BottomNav → Mer → Tankestrøm (TankestrømPage).
    await page.getByRole('button', { name: 'Mer', exact: true }).click()
    await page.getByRole('button', { name: /Tankestrøm/i }).first().click()

    // TankestrømPage: åpne tekst-seksjonen og lim inn fixture-teksten.
    await page.getByRole('button', { name: /Eller lim inn tekst/i }).click()
    const textBox = page.getByPlaceholder(/Lim inn ukeplan/i)
    await textBox.fill(hostcupText)
    await expect(textBox).toHaveValue(hostcupText)

    const analyzeBtn = page.getByRole('button', { name: 'Analyser tekst' })
    await expect(analyzeBtn).toBeEnabled({ timeout: 15_000 })
    await analyzeBtn.click()

    // Forslag dukker opp på siden (mock /api/analyze må ha truffet).
    const proposalsMarker = page.getByText('Foreslåtte hendelser')
    const sawProposals = await proposalsMarker
      .waitFor({ state: 'visible', timeout: 65_000 })
      .then(() => true)
      .catch(() => false)
    if (!sawProposals) {
      throw new Error(
        `Forslag («Foreslåtte hendelser») kom ikke til syne innen 65s. Mock POST-treff: ${mockStats.post}, OPTIONS: ${mockStats.options}, siste POST-URL: ${mockStats.lastPostUrl || '—'}.`
      )
    }

    if (useMock) {
      expect(
        mockStats.post,
        `Mock traff ikke POST til analyse-URL (post=${mockStats.post}, options=${mockStats.options}). Siste POST: ${mockStats.lastPostUrl || '—'}`
      ).toBeGreaterThan(0)
    }

    // Import-CTA og forventet arrangementstittel vises.
    // Rik delprogram-/høydepunkt-preview er flyttet til komponenttest
    // (src/features/tankestrom/__tests__/tankestromImportDialogPreview.test.tsx),
    // siden TankestrømPage ikke rendrer den i primærflyten.
    await expect(page.getByRole('button', { name: /Legg til \d+ hendelse/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Høstcupen/i).first()).toBeVisible()
  })
})
