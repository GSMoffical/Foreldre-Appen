// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChildSchoolProfile } from '../../types'

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }))
vi.mock('../supabaseClient', () => ({
  supabase: { auth: { getSession: getSessionMock } },
}))

import {
  buildOutgoingRelevanceContext,
  analyzeDocumentWithTankestrom,
  analyzeTextWithTankestrom,
} from '../tankestromApi'

const SCHOOL: ChildSchoolProfile = {
  gradeBand: '5-7',
  weekdays: {
    0: { useSimpleDay: false, lessons: [{ subjectKey: 'matematikk', start: '08:15', end: '09:00' }] },
  },
}

describe('buildOutgoingRelevanceContext', () => {
  it('returnerer undefined når ingenting er satt', () => {
    expect(buildOutgoingRelevanceContext(undefined)).toBeUndefined()
    expect(buildOutgoingRelevanceContext({})).toBeUndefined()
    expect(buildOutgoingRelevanceContext({ classCode: '   ' })).toBeUndefined()
  })

  it('trimmer classCode', () => {
    expect(buildOutgoingRelevanceContext({ classCode: '  2STC ' })).toEqual({ classCode: '2STC' })
  })

  it('BÆRER schoolProfile videre (dropper det IKKE) — også uten classCode', () => {
    // Dette er chokepunkt-regresjonen: tidligere ble alt utenom classCode forkastet her.
    expect(buildOutgoingRelevanceContext({ schoolProfile: SCHOOL })).toEqual({ schoolProfile: SCHOOL })
  })

  it('bærer både classCode og schoolProfile', () => {
    expect(buildOutgoingRelevanceContext({ classCode: '2STC', schoolProfile: SCHOOL })).toEqual({
      classCode: '2STC',
      schoolProfile: SCHOOL,
    })
  })
})

describe('analyze* sender schoolProfile på wire-en', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubEnv('VITE_TANKESTROM_ANALYZE_URL', 'https://example.test/api/analyze')
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
    // Minimalt svar: requesten er allerede sendt (og fanget) før analyzeWithTankestrom kaster på parsing.
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => '{}',
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('FIL (multipart): schoolProfile havner i relevanceContext-feltet (JSON-streng)', async () => {
    const file = new File(['x'], 'ukeplan.pdf', { type: 'application/pdf' })
    await expect(
      analyzeDocumentWithTankestrom(file, { classCode: '2STC', schoolProfile: SCHOOL })
    ).rejects.toBeTruthy()

    const body = fetchMock.mock.calls[0]![1]!.body as FormData
    expect(body).toBeInstanceOf(FormData)
    const rc = JSON.parse(body.get('relevanceContext') as string)
    expect(rc).toEqual({ classCode: '2STC', schoolProfile: SCHOOL })
  })

  it('TEKST (JSON-body): schoolProfile havner i relevanceContext', async () => {
    await expect(
      analyzeTextWithTankestrom('en ukeplan', { schoolProfile: SCHOOL })
    ).rejects.toBeTruthy()

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
    expect(body.text).toBe('en ukeplan')
    expect(body.relevanceContext).toEqual({ schoolProfile: SCHOOL })
  })
})
