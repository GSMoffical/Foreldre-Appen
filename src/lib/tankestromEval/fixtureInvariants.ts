import type {
  PortalEventProposal,
  PortalImportProposalBundle,
  PortalTaskProposal,
} from '../../features/tankestrom/types'
import type { Event, EventMetadata } from '../../types'
import type { VaacupInvariantViolation, VaacupNormalizedDay } from '../tankestromVaacupInvariants'
import { assertVaacupOriginalInvariants } from '../tankestromVaacupInvariants'
import type { EvalEmbeddedDaySnapshot } from './vaacupNormalize'
import { findConservativeExistingEventMatch } from '../tankestromExistingEventMatch'
import { suggestTaskIntentFromTitleAndNotes } from '../taskIntent'

const KAMP = /\bkamp|første|andre|match\b/i
const OPPMOTE = /\boppm[øo]te\b|\bm[øo]tes?\b/i

export type FixtureInvariantFailure = {
  code: string
  message: string
  detail?: Record<string, unknown>
}

export function invariantFailuresForVaacupDays(days: VaacupNormalizedDay[]): FixtureInvariantFailure[] {
  const violations = assertVaacupOriginalInvariants(days)
  return violations.map((v: VaacupInvariantViolation) => ({
    code: v.code,
    message: v.message,
    detail: v.detail,
  }))
}

export function invariantFailuresForHostcupDays(days: EvalEmbeddedDaySnapshot[]): FixtureInvariantFailure[] {
  const out: FixtureInvariantFailure[] = []
  if (days.length !== 3) {
    out.push({
      code: 'hostcup_day_count',
      message: `Forventet 3 delprogram-dager, fikk ${days.length}`,
      detail: { dates: days.map((d) => d.date) },
    })
    return out
  }
  const fri = days.find((d) => d.date === '2026-09-18')
  const lor = days.find((d) => d.date === '2026-09-19')
  const son = days.find((d) => d.date === '2026-09-20')
  if (!fri || !lor || !son) {
    out.push({
      code: 'hostcup_dates',
      message: 'Mangler forventede datoer 2026-09-18 / 19 / 20',
      detail: { dates: days.map((d) => d.date) },
    })
    return out
  }

  const fri1730 = fri.highlights.find((h) => h.time === '17:30')
  if (!fri1730 || !OPPMOTE.test(fri1730.label)) {
    out.push({
      code: 'hostcup_fri_1730_oppmote',
      message: 'Fredag mangler 17:30 som oppmøte-highlight',
      detail: { highlights: fri.highlights },
    })
  }
  const fri1815 = fri.highlights.find((h) => h.time === '18:15')
  if (!fri1815 || !KAMP.test(fri1815.label)) {
    out.push({
      code: 'hostcup_fri_1815_kamp',
      message: 'Fredag mangler 18:15 som kamp-highlight',
      detail: { highlights: fri.highlights },
    })
  }

  const lor0920 = lor.highlights.find((h) => h.time === '09:00')
  if (!lor0920 || (OPPMOTE.test(lor0920.label) && !KAMP.test(lor0920.label))) {
    out.push({
      code: 'hostcup_lor_0920_mislabeled_oppmote',
      message: 'Lørdag 09:00 skal være kamp/første kamp, ikke ren oppmøte-label',
      detail: { label: lor0920?.label, highlights: lor.highlights },
    })
  }
  const labels0820 = lor.highlights.find((h) => h.time === '08:20')?.label ?? ''
  if (!lor.highlights.some((h) => h.time === '08:20') || !/oppm|første/i.test(labels0820)) {
    out.push({
      code: 'hostcup_lor_0820',
      message: 'Lørdag mangler 08:20 oppmøte før første kamp',
      detail: { highlights: lor.highlights },
    })
  }
  if (!lor.highlights.some((h) => h.time === '13:55' && /oppm|andre/i.test(h.label))) {
    out.push({
      code: 'hostcup_lor_1355',
      message: 'Lørdag mangler 13:55 oppmøte før andre kamp',
      detail: { highlights: lor.highlights },
    })
  }
  const lor1440 = lor.highlights.find((h) => h.time === '14:40')
  if (!lor1440 || !/andre|kamp/i.test(lor1440.label)) {
    out.push({
      code: 'hostcup_lor_1440',
      message: 'Lørdag mangler 14:40 andre kamp',
      detail: { highlights: lor.highlights },
    })
  }

  if (son.isConditional !== true && son.highlights.length > 0) {
    const suspicious = son.highlights.some((h) => h.time === '17:30' || h.time === '17:45')
    if (suspicious) {
      out.push({
        code: 'hostcup_son_time_leak',
        message: 'Søndag (foreløpig) skal ikke få fredagens oppmøtetider som eksakte highlights',
        detail: { highlights: son.highlights },
      })
    }
  }

  return out
}

export function invariantFailuresForSpondBundle(bundle: PortalImportProposalBundle): FixtureInvariantFailure[] {
  const tasks = bundle.items.filter((i): i is PortalTaskProposal => i.kind === 'task')
  const events = bundle.items.filter((i) => i.kind === 'event')
  if (tasks.length === 0) {
    return [
      {
        code: 'spond_no_task',
        message: 'Forventet minst ett gjøremål (task) for Spond-frist',
        detail: { itemKinds: bundle.items.map((i) => i.kind) },
      },
    ]
  }
  const primary = tasks[0]!
  const intent =
    primary.task.taskIntent ?? suggestTaskIntentFromTitleAndNotes(primary.task.title, primary.task.notes ?? '')
  if (intent !== 'must_do') {
    return [
      {
        code: 'spond_task_not_must_do',
        message: 'Spond-svarfrist skal klassifiseres som plikt (must_do)',
        detail: { intent, title: primary.task.title },
      },
    ]
  }
  if (events.length > 0) {
    return [
      {
        code: 'spond_unexpected_calendar_event',
        message: 'Spond-deadline-fixture skal ikke primært være vanlig kalenderhendelse',
        detail: { eventTitles: events.map((e) => (e.kind === 'event' ? e.event.title : '')) },
      },
    ]
  }
  return []
}

export function invariantFailuresForAmbiguousWeekend(bundle: PortalImportProposalBundle): FixtureInvariantFailure[] {
  const ev = bundle.items.find((i): i is PortalEventProposal => i.kind === 'event')
  if (!ev || ev.kind !== 'event') {
    return [{ code: 'ambiguous_no_event', message: 'Forventet ett hendelsesforslag', detail: {} }]
  }
  const meta = ev.event.metadata as EventMetadata | undefined
  const tp = meta?.timePrecision
  const tw = meta?.timeWindowCandidates
  const hasTentativeWindow =
    Array.isArray(tw) && tw.some((w) => w && typeof w === 'object' && (w as { tentative?: boolean }).tentative === true)
  if (tp !== 'date_only' && tp !== 'start_only' && !hasTentativeWindow) {
    return [
      {
        code: 'ambiguous_not_marked_uncertain',
        message: 'Usikker helg skal ha date_only/start_only eller tentative timeWindowCandidates, ikke bare eksakt timed',
        detail: { timePrecision: tp, timeWindowCandidates: tw },
      },
    ]
  }
  return []
}

const EXISTING_VAACUP_FRIDAY_ROW: Event = {
  id: 'eval-existing-friday',
  personId: 'eval-child-1',
  title: 'Vårcupen – fredag',
  start: '17:45',
  end: '20:00',
  notes: 'Eksisterende kalenderinfo (syntetisk)',
  metadata: {
    arrangementStableKey: 'embed-export-child-stable-key-friday',
  },
}

export function invariantFailuresForVaacupUpdateMatch(bundle: PortalImportProposalBundle): FixtureInvariantFailure[] {
  const proposal = bundle.items.find((i): i is PortalEventProposal => i.kind === 'event')
  if (!proposal || proposal.kind !== 'event') {
    return [{ code: 'vaacup_update_no_event', message: 'Forventet parent-event i bundle', detail: {} }]
  }
  const meta = proposal.event.metadata as EventMetadata | undefined
  const start = proposal.event.date.trim()
  const end =
    typeof meta?.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(meta.endDate.trim())
      ? meta.endDate.trim()
      : start
  const r = findConservativeExistingEventMatch(
    proposal,
    proposal.event.title,
    start,
    end,
    proposal.event.personId?.trim() ?? '',
    [{ event: EXISTING_VAACUP_FRIDAY_ROW, anchorDate: '2026-06-12' }]
  )
  if (r.rejected || !r.candidate) {
    return [
      {
        code: 'vaacup_update_no_existing_match',
        message:
          'Oppdateringsimport skal treffe eksisterende dag-rad (cluster) når dato/tittel stemmer — sjekk findConservativeExistingEventMatch',
        detail: {
          rejectReason: r.rejectReason,
          score: r.score,
          trace: r.importMatchTrace,
        },
      },
    ]
  }
  if (r.defaultAction !== 'update') {
    return [
      {
        code: 'vaacup_update_not_update_action',
        message: `Forventet defaultAction «update», fikk «${r.defaultAction}»`,
        detail: { defaultAction: r.defaultAction, score: r.score },
      },
    ]
  }
  return []
}
