export function initSentryClient(): void {
  // no-op
}

export type TankestromSentryBreadcrumbMessage =
  | 'tankestrom_import_opened'
  | 'tankestrom_analysis_started'
  | 'tankestrom_analysis_failed'
  | 'tankestrom_import_preview_render_failed'

export function addTankestromSentryBreadcrumb(
  _message: TankestromSentryBreadcrumbMessage,
  _data?: Record<string, string | number | boolean>
): void {
  // no-op
}
