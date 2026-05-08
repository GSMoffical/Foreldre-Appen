import { defineConfig, devices } from '@playwright/test'

const devPort = Number(process.env.E2E_DEV_PORT ?? '5173')
const baseURL = `http://127.0.0.1:${devPort}`

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/e2e/**/*.spec.ts', 'e2e/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${devPort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_TANKESTROM_ANALYZE_URL:
        process.env.VITE_TANKESTROM_ANALYZE_URL ?? 'http://127.0.0.1:3000/api/analyze',
    },
  },
})
