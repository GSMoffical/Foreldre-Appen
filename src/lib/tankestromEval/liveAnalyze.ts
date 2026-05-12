/**
 * Node-only live-klient mot Tankestrøm analyse-API.
 *
 * Lett kopi av `analyzeWithTankestrom` i `src/lib/tankestromApi.ts`, men:
 *  - leser URL/auth fra `process.env` (ikke `import.meta.env`)
 *  - krever ikke Supabase-session (auth-token sendes inn som arg)
 *  - har eksplisitt timeout og strukturert feilrapportering
 *
 * Brukes kun av `runTankestromEval({ mode: 'live' })` — ikke koblet til UI/produksjon.
 */
import { normalizeTankestromAnalyzeHttpJson, parsePortalImportProposalBundle } from '../tankestromApi'
import type { PortalImportProposalBundle } from '../../features/tankestrom/types'

export type LiveAnalyzeOptions = {
  url: string
  bearer?: string
  apiKey?: string
  timeoutMs?: number
  extraHeaders?: Record<string, string>
}

export type LiveAnalyzeResult = {
  bundle: PortalImportProposalBundle
  rawPayload: unknown
  httpStatus: number
  durationMs: number
}

export class LiveAnalyzeError extends Error {
  readonly httpStatus?: number
  readonly responseText?: string
  readonly durationMs?: number
  readonly stage: 'config' | 'fetch' | 'http' | 'parse' | 'timeout'
  constructor(
    message: string,
    opts: {
      stage: LiveAnalyzeError['stage']
      httpStatus?: number
      responseText?: string
      durationMs?: number
    }
  ) {
    super(message)
    this.stage = opts.stage
    this.httpStatus = opts.httpStatus
    this.responseText = opts.responseText
    this.durationMs = opts.durationMs
  }
}

const DEFAULT_TIMEOUT_MS = 60_000

export async function analyzeTextWithLiveApi(
  text: string,
  opts: LiveAnalyzeOptions
): Promise<LiveAnalyzeResult> {
  const url = (opts.url ?? '').trim()
  if (!url) {
    throw new LiveAnalyzeError(
      'Mangler analyse-URL: sett VITE_TANKESTROM_ANALYZE_URL (env) før live eval.',
      { stage: 'config' }
    )
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(opts.extraHeaders ?? {}),
  }
  if (opts.bearer && opts.bearer.trim()) headers['Authorization'] = `Bearer ${opts.bearer.trim()}`
  if (opts.apiKey && opts.apiKey.trim()) headers['X-API-Key'] = opts.apiKey.trim()

  const timeoutMs = Math.max(1_000, Math.floor(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS))
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  const t0 = Date.now()
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text }),
      signal: ac.signal,
    })
  } catch (err) {
    const durationMs = Date.now() - t0
    if (ac.signal.aborted) {
      throw new LiveAnalyzeError(`Live analyse timeout etter ${timeoutMs} ms`, {
        stage: 'timeout',
        durationMs,
      })
    }
    const msg = err instanceof Error ? err.message : 'ukjent fetch-feil'
    throw new LiveAnalyzeError(`Live analyse fetch feilet: ${msg}`, { stage: 'fetch', durationMs })
  } finally {
    clearTimeout(timer)
  }

  const durationMs = Date.now() - t0
  const responseText = await res.text()
  let responseJson: unknown = null
  try {
    responseJson = responseText ? JSON.parse(responseText) : null
  } catch {
    responseJson = null
  }

  if (!res.ok) {
    throw new LiveAnalyzeError(
      `Live analyse HTTP ${res.status}: ${responseText.slice(0, 500) || '(tomt svar)'}`,
      { stage: 'http', httpStatus: res.status, responseText: responseText.slice(0, 4000), durationMs }
    )
  }
  if (!responseJson) {
    throw new LiveAnalyzeError(
      `Tomt/ugyldig svar fra live analyse (HTTP ${res.status}). Rå: ${responseText.slice(0, 500)}`,
      { stage: 'parse', httpStatus: res.status, responseText: responseText.slice(0, 4000), durationMs }
    )
  }

  const normalized = normalizeTankestromAnalyzeHttpJson(responseJson)
  let bundle: PortalImportProposalBundle
  try {
    bundle = parsePortalImportProposalBundle(normalized)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new LiveAnalyzeError(`Live analyse parse-feil: ${msg}`, {
      stage: 'parse',
      httpStatus: res.status,
      responseText: responseText.slice(0, 4000),
      durationMs,
    })
  }

  return { bundle, rawPayload: responseJson, httpStatus: res.status, durationMs }
}

/** Bygger live-opts fra `process.env` (Node CLI / GitHub Actions). */
export function liveOptionsFromEnv(): LiveAnalyzeOptions {
  const url = (process.env.VITE_TANKESTROM_ANALYZE_URL ?? '').trim()
  const bearer = (process.env.TANKESTROM_BEARER ?? '').trim() || undefined
  const apiKey = (process.env.TANKESTROM_API_KEY ?? '').trim() || undefined
  const timeoutRaw = (process.env.TANKESTROM_EVAL_LIVE_TIMEOUT_MS ?? '').trim()
  const timeoutMs = timeoutRaw && Number.isFinite(Number(timeoutRaw)) ? Number(timeoutRaw) : undefined
  return { url, bearer, apiKey, timeoutMs }
}
