import * as Sentry from '@sentry/react'
import type { Event } from '@sentry/core'

/**
 * Streng privacy: ingen rå Tankestrøm-tekst, analyse-JSON, notater, navn eller tokens i Sentry.
 *
 * Session replay er av (0 %). For å aktivere senere: legg til f.eks. `Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })`
 * og sett `replaysSessionSampleRate` / `replaysOnErrorSampleRate` til lave verdier etter egen vurdering.
 */
const SENSITIVE_KEY_RE =
  /^(password|pass|token|secret|authorization|cookie|jwt|apikey|api_key|refresh_token|access_token|bearer|anon|service_role|supabase|session|dsn)$/i

const SENSITIVE_KEY_SUBSTR_RE =
  /password|secret|token|authorization|supabase|email|phone|ssn|fødsels|birth|note|notes|payload|raw|body|tankestrom|analyze|fritekst|person|child|barn|navn|name|title|message|text|input|clipboard|invite/i

function redactEmails(s: string): string {
  return s.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[redacted]')
}

function scrubString(s: string): string {
  let out = redactEmails(s)
  if (out.length > 800) out = `${out.slice(0, 800)}…`
  return out
}

function scrubUnknown(value: unknown, depth: number): unknown {
  if (depth > 8) return '[depth]'
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return scrubString(value)
  if (typeof value === 'bigint') return '[bigint]'
  if (typeof value === 'function') return '[function]'
  if (Array.isArray(value)) {
    return value.slice(0, 40).map((v) => scrubUnknown(v, depth + 1))
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    const next: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o)) {
      if (SENSITIVE_KEY_RE.test(k) || SENSITIVE_KEY_SUBSTR_RE.test(k)) {
        next[k] = '[redacted]'
        continue
      }
      next[k] = scrubUnknown(v, depth + 1)
    }
    return next
  }
  return value
}

function scrubSentryEvent(event: Event): void {
  event.user = undefined

  if (event.request) {
    delete event.request.headers
    delete event.request.data
    delete event.request.cookies
    delete event.request.query_string
  }

  if (event.breadcrumbs?.length) {
    for (const b of event.breadcrumbs) {
      if (typeof b.message === 'string') b.message = scrubString(b.message)
      if (b.data) b.data = scrubUnknown(b.data, 0) as Record<string, unknown>
    }
  }

  if (event.extra) {
    event.extra = scrubUnknown(event.extra, 0) as Record<string, unknown>
  }

  if (event.contexts) {
    event.contexts = scrubUnknown(event.contexts, 0) as Event['contexts']
  }

  if (event.tags) {
    event.tags = scrubUnknown(event.tags, 0) as Record<string, string>
  }

  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (typeof ex.value === 'string') ex.value = scrubString(ex.value)
    }
  }
}

export function initSentryClient(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE,
    sendDefaultPii: false,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = scrubUnknown(breadcrumb.data, 0) as Record<string, unknown>
      }
      if (typeof breadcrumb.message === 'string') {
        breadcrumb.message = scrubString(breadcrumb.message)
      }
      return breadcrumb
    },
    beforeSend(event) {
      scrubSentryEvent(event)
      return event
    },
  })
}

export type TankestromSentryBreadcrumbMessage =
  | 'tankestrom_import_opened'
  | 'tankestrom_analysis_started'
  | 'tankestrom_analysis_failed'
  | 'tankestrom_import_preview_render_failed'

/** Kun korte, ikke-personlige felter (ingen fritekst, ingen analyse-JSON). */
export function addTankestromSentryBreadcrumb(
  message: TankestromSentryBreadcrumbMessage,
  data?: Record<string, string | number | boolean>
): void {
  if (!import.meta.env.VITE_SENTRY_DSN?.trim()) return
  Sentry.addBreadcrumb({
    category: 'tankestrom',
    message,
    level: message === 'tankestrom_analysis_failed' || message === 'tankestrom_import_preview_render_failed' ? 'error' : 'info',
    data,
  })
}
