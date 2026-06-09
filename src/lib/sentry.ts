import * as Sentry from '@sentry/react'

/**
 * Initialises Sentry error monitoring.
 *
 * GDPR compliance:
 * - No personal data is sent to Sentry (beforeSend scrubs user context)
 * - No session replay (not enabled)
 * - No performance tracing (tracesSampleRate: 0)
 * - Sentry project is hosted in EU (ingest.de.sentry.io)
 * - Only unhandled errors and explicitly captured exceptions are sent
 *
 * Call this once at app startup in main.tsx, before rendering.
 */
export function initSentryClient(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

  if (!dsn) {
    if (import.meta.env.DEV) {
      console.warn('[sentry] VITE_SENTRY_DSN is not set — error monitoring disabled.')
    }
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.DEV ? 'development' : 'production',

    // Performance tracing disabled — we only want error monitoring
    tracesSampleRate: 0,

    // Session replay disabled — contains user behaviour data (GDPR risk)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // GDPR: scrub all user-identifying data before sending to Sentry
    // We never want names, emails, or family data in error reports
    beforeSend(event) {
      // Remove any user context that may have been set automatically
      delete event.user
      // Remove request headers that may contain auth tokens
      if (event.request?.headers) {
        delete event.request.headers['Authorization']
        delete event.request.headers['Cookie']
      }
      return event
    },

    // Only capture errors in production and development
    // Ignore known non-actionable browser errors
    ignoreErrors: [
      // Network errors outside our control
      'NetworkError',
      'Failed to fetch',
      'Load failed',
      // Browser extension interference
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // iOS Safari quirks
      "Can't find variable: _AutofillCallbackHandler",
    ],
  })
}

export type TankestromSentryBreadcrumbMessage =
  | 'tankestrom_import_opened'
  | 'tankestrom_analysis_started'
  | 'tankestrom_analysis_failed'
  | 'tankestrom_import_preview_render_failed'

/**
 * Adds a breadcrumb to the current Sentry event trail.
 * Breadcrumbs help understand what the user was doing before an error.
 * Only non-personal data is included — no titles, names, or content.
 */
export function addTankestromSentryBreadcrumb(
  message: TankestromSentryBreadcrumbMessage,
  data?: Record<string, string | number | boolean>
): void {
  Sentry.addBreadcrumb({
    category: 'tankestrom',
    message,
    data,
    level: 'info',
  })
}
