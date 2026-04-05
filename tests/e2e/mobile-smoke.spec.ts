import { test, expect } from '@playwright/test'

test.describe('Mobile smoke', () => {
  test('shows login screen with primary controls', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'ForeldrePortalen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Logg inn' })).toBeVisible()
    await expect(page.getByLabel('E-post')).toBeVisible()
    await expect(page.getByLabel('Passord')).toBeVisible()
  })

  test('invite flow shows role selection for child/adult', async ({ page }) => {
    await page.goto('/?invite=demo-token')
    await expect(page.getByText('Du har blitt invitert til en familie.')).toBeVisible()
    await expect(page.getByText('Når du blir med i familien, er du:')).toBeVisible()
    const voksen = page.getByLabel('Voksen')
    const barn = page.getByLabel('Barn')
    await expect(voksen).toBeVisible()
    await expect(barn).toBeVisible()
    await barn.check()
    await expect(barn).toBeChecked()
    await expect(voksen).not.toBeChecked()
  })
})
