/**
 * Test/debug-hjelp for canonical preview — kun Node (ikke importer i app-UI).
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CanonicalDisplayTimeOrigin } from './tankestromCanonicalPreview'

export type TankestromPreviewDebugDayRow = {
  date: string
  title: string
  rawSegmentStart?: string
  rawSegmentEnd?: string
  canonicalDisplayTime: string | null
  displayTimeOrigin: CanonicalDisplayTimeOrigin
  shownTidField: string
  canonicalHighlights: string[]
  selected: boolean
  blockers: string[]
  isImportSelectable: boolean
  isPreliminaryDay: boolean
  importCountContribution: number
}

export type TankestromPreviewDebugReport = {
  fixtureLabel: string
  originalImportTextLength: number
  importButtonSummary: string
  days: TankestromPreviewDebugDayRow[]
}

export function writeTankestromPreviewDebugReport(
  report: TankestromPreviewDebugReport,
  opts?: { dir?: string; filename?: string }
): string {
  const dir = opts?.dir ?? join(process.cwd(), 'tmp', 'tankestrom-preview-debug')
  mkdirSync(dir, { recursive: true })
  const filename = opts?.filename ?? `preview-debug-${Date.now()}.json`
  const path = join(dir, filename)
  writeFileSync(path, JSON.stringify(report, null, 2), 'utf8')
  return path
}
