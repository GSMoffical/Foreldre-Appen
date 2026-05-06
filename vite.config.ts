import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version?: string }

// TODO: remove build fingerprint after deploy verification (also vite-env.d.ts + BuildFingerprintMarker + AppShell)
const buildFingerprintIso = new Date().toISOString()
const gitSha =
  process.env.GITHUB_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.CF_PAGES_COMMIT_SHA ??
  'unknown'

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_FINGERPRINT__: JSON.stringify(buildFingerprintIso),
    __APP_VERSION__: JSON.stringify(pkg.version ?? '0.0.0'),
    __GIT_SHA__: JSON.stringify(gitSha),
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
  },
})
