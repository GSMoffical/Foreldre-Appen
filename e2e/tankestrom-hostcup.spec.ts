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

async function loginAndOpenCalendar(page: import('@playwright/test').Page) {
  const email = process.env.E2E_LOGIN_EMAIL?.trim()
  const password = process.env.E2E_LOGIN_PASSWORD?.trim()
  test.skip(!email || !password, 'Sett E2E_LOGIN_EMAIL og E2E_LOGIN_PASSWORD for innlogging.')

  await page.goto('/')
  const innstillinger = page.getByRole('button', { name: 'Innstillinger' })
  if (await innstillinger.isVisible().catch(() => false)) return

  await page.getByLabel('E-post').fill(email)
  await page.getByLabel('Passord').fill(password)
  await page.getByRole('button', { name: 'Logg inn' }).click()
  await expect(innstillinger).toBeVisible({ timeout: 25_000 })

  const skipFamily = page.getByRole('button', { name: 'Hopp over for nå' })
  if (await skipFamily.isVisible().catch(() => false)) {
    await skipFamily.click()
    await expect(innstillinger).toBeVisible({ timeout: 15_000 })
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

  test('viser forventet delprogram, høydepunkter og ryddig struktur (Høstcupen)', async ({ page }) => {
    await loginAndOpenCalendar(page)

    await page.getByRole('button', { name: 'Innstillinger' }).click()
    await page.getByTestId('tankestrom-import-open').click()

    const dialog = page.getByTestId('tankestrom-import-dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Tekst' }).click()
    const textBox = dialog.getByTestId('tankestrom-import-text')
    await textBox.fill(hostcupText)
    await expect(textBox).toHaveValue(hostcupText)

    const analyzeBtn = dialog.getByTestId('tankestrom-analyze')
    await expect(analyzeBtn).toBeEnabled({ timeout: 15_000 })
    await analyzeBtn.click()

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
        `Verken review («Limt inn tekst») eller feilmelding innen 65s. Mock POST-treff: ${mockStats.post}, OPTIONS: ${mockStats.options}, siste POST-URL: ${mockStats.lastPostUrl || '—'}.`
      )
    }

    await expect(reviewHeaderMarker).toBeVisible()
    if (useMock) {
      expect(mockStats.post).toBeGreaterThan(0)
    }

    const confirm = page.getByTestId('tankestrom-import-confirm')
    await expect(confirm).toBeVisible({ timeout: 15_000 })
    await expect(confirm).toContainText('Importer valgte (1 arrangement / 3 hendelser)')
    await expect(dialog).toContainText('Høstcupen')

    const friday = dialog.getByTestId('tankestrom-delprogram-day-2026-09-18')
    const saturday = dialog.getByTestId('tankestrom-delprogram-day-2026-09-19')
    const sunday = dialog.getByTestId('tankestrom-delprogram-day-2026-09-20')

    await expect(friday).toBeVisible()
    await expect(saturday).toBeVisible()
    await expect(sunday).toBeVisible()

    await expect(dialog.locator('[data-testid^="tankestrom-delprogram-day-"]')).toHaveCount(3)
    await expect(friday).toContainText('Høstcupen – fredag')
    await expect(saturday).toContainText('Høstcupen – lørdag')
    await expect(sunday).toContainText('Høstcupen – søndag')

    const forbiddenTitleNoise = [
      'Høstcupen – 18',
      'Høstcupen 2026, J2013 – Friday',
      'Høstcupen , J2013',
      'Friday',
      'Saturday',
      'Sunday',
    ] as const
    for (const bad of forbiddenTitleNoise) {
      await expect(dialog).not.toContainText(bad)
    }

    const forbiddenGeneralPatterns = [
      'Høydepunkter:',
      'Notater:',
      'Dagens innhold',
      'duplicate day cards',
      'event-title som highlight',
      'dato-token i child-title',
    ] as const
    for (const bad of forbiddenGeneralPatterns) {
      await expect(dialog).not.toContainText(bad)
    }

    await friday.getByRole('button', { name: /Høstcupen.*– fredag/ }).click()
    const friHi = friday.getByTestId('tankestrom-schedule-highlights-2026-09-18')
    await expect(friHi).toBeVisible()
    await expect(friHi).toContainText('17:30')
    await expect(friHi).toContainText('Oppmøte')
    await expect(friHi).toContainText('18:15')
    await expect(friHi).toContainText('Første kamp')
    await expect(friHi).not.toContainText('Høstcupen')

    await saturday.getByRole('button', { name: /Høstcupen.*– lørdag/ }).click()
    const lorHi = saturday.getByTestId('tankestrom-schedule-highlights-2026-09-19')
    await expect(lorHi).toBeVisible()
    await expect(lorHi).toContainText('08:20')
    await expect(lorHi).toContainText('Oppmøte før første kamp')
    await expect(lorHi).toContainText('09:00')
    await expect(lorHi).toContainText('Første kamp')
    await expect(lorHi).toContainText('13:55')
    await expect(lorHi).toContainText('Oppmøte før andre kamp')
    await expect(lorHi).toContainText('14:40')
    await expect(lorHi).toContainText('Andre kamp')
    await expect(lorHi.locator('li', { hasText: '14:40' })).toHaveCount(1)
    await expect(lorHi).not.toContainText('Høstcupen')

    await expect(sunday.getByText('Foreløpig')).toBeVisible()
    await sunday.getByRole('button', { name: /Høstcupen.*– søndag/ }).click()
    await expect(sunday.getByText('Ikke endelig avklart', { exact: true })).toBeVisible()
    await expect(sunday).not.toContainText('Fast kampstart')

    await expect(sunday.getByTestId('tankestrom-schedule-highlights-2026-09-20')).toHaveCount(0)

    const dayCards = [friday, saturday, sunday]
    for (const day of dayCards) {
      await expect(day).toContainText('Husk / ta med')
      await expect(day).toContainText(/drikkeflaske/i)
      await expect(day).toContainText(/matpakke/i)
      await expect(day).toContainText(/ekstra (t-skjorte|klær)/i)
      await expect(day).not.toContainText(/^t$/)
      await expect(day).not.toContainText(/^skjorte$/)

      const notesBlocks = day.locator('[data-testid^="tankestrom-schedule-notes-"]')
      const notesCount = await notesBlocks.count()
      expect(notesCount).toBeLessThanOrEqual(1)

      if (notesCount === 1) {
        const notesText = (await notesBlocks.first().innerText()).trim()
        expect(notesText).not.toMatch(/Høydepunkter:|Husk:|Notater:|Dagens innhold/i)
        const repeatedPhrase = 'Foreldre hjelper med rydding etter siste kamp.'
        const repeatedCount = notesText.split(repeatedPhrase).length - 1
        expect(repeatedCount).toBeLessThanOrEqual(1)
      }
    }
  })
})
