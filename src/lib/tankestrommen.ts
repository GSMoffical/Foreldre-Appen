import { supabase } from './supabaseClient'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single event proposal returned by the Tankestrømmen analysis endpoint. */
export interface TankestrommenProposal {
  title: string
  date: string | null
  startTime: string | null
  endTime: string | null
  attendanceTime: string | null
  location: string | null
  category: string | null
  targetGroup: string | null
  description: string | null
  isTentative: boolean
  tentativeReason: string | null
  bringItems: string[]
  highlights: string[]
  requiresManualReview: boolean
  confidence: number
}

interface AnalyzeResponse {
  events: TankestrommenProposal[]
}

export type DocumentInput =
  | { kind: 'image'; base64: string }
  | { kind: 'text'; text: string }

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const TANKESTROMMEN_URL = import.meta.env.VITE_TANKESTROMMEN_URL as string | undefined

/**
 * Send an image (base64) or plain text to the Tankestrømmen analysis API and
 * return the parsed array of event proposals.
 *
 * The endpoint URL is read from `VITE_TANKESTROMMEN_URL`.
 * An `Authorization: Bearer <jwt>` header is attached using the current
 * Supabase session token.
 */
export async function analyzeDocument(input: DocumentInput): Promise<TankestrommenProposal[]> {
  if (!TANKESTROMMEN_URL) {
    throw new Error('VITE_TANKESTROMMEN_URL er ikke satt. Konfigurer miljøvariabelen for å bruke dokumentskanning.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const jwt = sessionData?.session?.access_token
  if (!jwt) {
    throw new Error('Du må være logget inn for å bruke dokumentskanning.')
  }

  const body = input.kind === 'image'
    ? { image: input.base64 }
    : { text: input.text }

  const res = await fetch(`${TANKESTROMMEN_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => null) as { error?: string } | null
    throw new Error(errBody?.error ?? `Feil fra Tankestrømmen (${res.status})`)
  }

  const data = (await res.json()) as AnalyzeResponse
  return data.events
}
