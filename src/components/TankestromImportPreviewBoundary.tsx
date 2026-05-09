import * as Sentry from '@sentry/react'
import type { ReactNode } from 'react'

/**
 * Fanger render-feil i Tankestrøm import-forhåndsvisning uten å lekke innhold til bruker.
 * Breadcrumb/capture går gjennom globale Sentry privacy-filtre.
 */
export function TankestromImportPreviewBoundary({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      beforeCapture={(scope) => {
        scope.addBreadcrumb({
          category: 'tankestrom',
          message: 'tankestrom_import_preview_render_failed',
          level: 'error',
        })
      }}
      fallback={
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
          <p className="text-[13px] font-medium text-rose-900">Kunne ikke vise forhåndsvisningen.</p>
          <p className="mt-1 text-[12px] text-rose-800">Lukk vinduet og prøv igjen, eller last siden på nytt.</p>
        </div>
      }
    >
      {children}
    </Sentry.ErrorBoundary>
  )
}
