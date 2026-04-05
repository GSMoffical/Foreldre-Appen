type MetricName =
  | 'time_to_add_event_ms'
  | 'time_to_resolve_conflict_ms'
  | 'time_to_reassign_participant_ms'
  | 'flow_backtracks'
  | 'unresolved_conflicts_end_of_day'

interface MetricEvent {
  name: MetricName
  value: number
  ts: string
}

const STORAGE_KEY = 'ux-metrics-v1'
const timers = new Map<string, number>()

function readMetricEvents(): MetricEvent[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as MetricEvent[]
  } catch {
    return []
  }
}

function writeMetricEvents(events: MetricEvent[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-500)))
}

export function startUxTimer(timerId: string) {
  timers.set(timerId, performance.now())
}

export function endUxTimer(timerId: string, metricName: MetricName) {
  const started = timers.get(timerId)
  if (started == null) return
  timers.delete(timerId)
  const duration = Math.max(0, Math.round(performance.now() - started))
  logUxMetric(metricName, duration)
}

export function logUxMetric(name: MetricName, value: number) {
  const events = readMetricEvents()
  events.push({
    name,
    value,
    ts: new Date().toISOString(),
  })
  writeMetricEvents(events)
}

export function getUxMetricsSnapshot(): MetricEvent[] {
  return readMetricEvents()
}
