import { test, expect, type Page, type Locator } from '@playwright/test'

const E2E_OPEN_PARAM = 'e2eOpenTankestromImport'

/** Venter til innlogget app-shell (ny bottom nav etter redesign). */
export async function loginAndOpenApp(page: Page) {
  const email = process.env.E2E_LOGIN_EMAIL?.trim()
  const password = process.env.E2E_LOGIN_PASSWORD?.trim()
  const hasE2EEmail = Boolean(email)
  const hasE2EPassword = Boolean(password)
  test.skip(!email || !password, 'Sett E2E_LOGIN_EMAIL og E2E_LOGIN_PASSWORD for innlogging.')

  const merTab = page.getByRole('button', { name: /^Mer$/i }).first()
  const idagTab = page.getByRole('button', { name: /I dag/i }).first()
  const gjoremalTab = page.getByRole('button', { name: /Gjøremål/i }).first()
  const manedTab = page.getByRole('button', { name: /Måned/i }).first()
  const waitForAuthenticatedShell = async (timeoutMs: number) => {
    const candidates = [merTab, idagTab, gjoremalTab, manedTab]
    await Promise.any(candidates.map((locator) => locator.waitFor({ state: 'visible', timeout: timeoutMs })))
  }

  await page.goto('/')
  if (await idagTab.isVisible().catch(() => false)) return

  await page.getByLabel('E-post').fill(email!)
  await page.getByRole('textbox', { name: 'Passord' }).fill(password!)
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
    const bodyText = ((await page.locator('body').innerText().catch(() => '')) ?? '')
      .replace(/\s+/g, ' ')
      .slice(0, 500)
    const screenshotPath = `test-results/login-failure-${Date.now()}.png`
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

export async function logTankestromPickState(page: Page, label: string) {
  const dialog = page.getByTestId('tankestrom-import-dialog')
  const dialogVisible = await dialog.isVisible().catch(() => false)
  const textCount = await dialog.getByTestId('tankestrom-import-text').count()
  const analyze = dialog.getByTestId('tankestrom-analyze')
  const analyzeCount = await analyze.count()
  const analyzeEnabled =
    analyzeCount > 0 ? await analyze.isEnabled().catch(() => false) : false
  const blockedHint =
    (await dialog.getByTestId('tankestrom-analyze-blocked-hint').textContent().catch(() => '')) ?? ''
  const snippet = ((await dialog.innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ').slice(0, 400)
  console.log(
    `[e2e tankestrom ${label}] dialogVisible=${dialogVisible} textAreas=${textCount} analyzeCount=${analyzeCount} analyzeEnabled=${analyzeEnabled} blocked="${blockedHint.trim()}" snippet="${snippet}"`
  )
}

/** Åpner import-dialogen med full delprogram-preview (VITE_E2E-hook, ikke produksjons-UX). */
export async function openTankestromImportDialog(page: Page) {
  const opener = page.getByTestId('tankestrom-import-open')
  const openerCount = await opener.count()
  console.log(`[e2e tankestrom open] openerCount=${openerCount} url=${page.url()}`)

  if (openerCount > 0) {
    // Hooken er sr-only (utenfor viewport). dispatchEvent omgår viewport/actionability-sjekker
    // og trigger React onClick direkte, uten å gjøre knappen prod-synlig.
    await opener.dispatchEvent('click')
  } else {
    const url = new URL(page.url())
    url.searchParams.set(E2E_OPEN_PARAM, '1')
    console.log(`[e2e tankestrom open] fallback goto ${url.toString()}`)
    await page.goto(url.toString())
  }

  const dialog = page.getByTestId('tankestrom-import-dialog')
  try {
    await expect(dialog).toBeVisible({ timeout: 25_000 })
  } catch {
    const body = ((await page.locator('body').innerText().catch(() => '')) ?? '')
      .replace(/\s+/g, ' ')
      .slice(0, 600)
    throw new Error(
      `[e2e tankestrom open] Import-dialog ble ikke synlig. openerCount=${await opener.count()}, url=${page.url()}, bodySnippet="${body}"`
    )
  }

  await logTankestromPickState(page, 'after-open')
  await expect(
    dialog.getByTestId('tankestrom-import-text'),
    'Familie må være lastet før tekstfelt vises i import-dialogen'
  ).toBeVisible({ timeout: 30_000 })
  await logTankestromPickState(page, 'textarea-ready')
}

/**
 * Klikker «Analyser» robust. Playwrights auto-retryende expect-matchere (`toBeEnabled`, `toBeAttached`)
 * kan henge til test-timeout på mobil selv når knappen faktisk er enabled. Vi poller DOM direkte
 * via evaluate og klikker med native `.click()` (trigger React onClick uten actionability-sjekker).
 */
export async function clickTankestromAnalyze(page: Page, dialog: Locator) {
  const analyzeBtn = dialog.getByTestId('tankestrom-analyze')
  console.log('[e2e tankestrom analyze] polling for enabled button')

  const deadline = Date.now() + 15_000
  let lastState = { attached: false, disabled: true, blocked: '' as string }

  while (Date.now() < deadline) {
    lastState = await analyzeBtn
      .evaluate((el) => {
        const btn = el as HTMLButtonElement
        const hint = btn
          .closest('[data-testid="tankestrom-import-dialog"]')
          ?.querySelector('[data-testid="tankestrom-analyze-blocked-hint"]')
        return {
          attached: true,
          disabled: btn.disabled || btn.getAttribute('aria-disabled') === 'true',
          blocked: hint?.textContent?.trim() ?? '',
        }
      })
      .catch(() => ({ attached: false, disabled: true, blocked: '' as string }))

    if (lastState.attached && !lastState.disabled) break
    await page.waitForTimeout(100)
  }

  if (!lastState.attached || lastState.disabled) {
    await logTankestromPickState(page, 'analyze-still-disabled')
    throw new Error(
      `[e2e tankestrom analyze] Analyser-knappen ble ikke enabled innen 15s. attached=${lastState.attached} disabled=${lastState.disabled} blocked="${lastState.blocked}". Familie/inputMode/textInput må være klar.`
    )
  }

  console.log('[e2e tankestrom analyze] clicking via DOM .click()')
  await analyzeBtn.evaluate((el) => {
    ;(el as HTMLButtonElement).click()
  })
  console.log('[e2e tankestrom analyze] click done')
}
