import type { ChildSchoolProfile, WeekdayMonFri } from '../types'
import {
  CUSTOM_SUBJECT_KEY,
  DEFAULT_SCHOOL_GATE_BY_BAND,
  SUBJECTS_BY_BAND,
  isKnownSubjectKeyForBand,
  subjectLabelForKey,
} from '../data/norwegianSubjects'
import { addLessonToProfile, removeLessonFromProfile, updateLessonInProfile } from '../lib/schoolLessons'

const WD_LABELS: Record<WeekdayMonFri, string> = {
  0: 'Mandag',
  1: 'Tirsdag',
  2: 'Onsdag',
  3: 'Torsdag',
  4: 'Fredag',
}
const WEEKDAYS: WeekdayMonFri[] = [0, 1, 2, 3, 4]

interface TimetableSuggestionLessonsProps {
  /** Den redigerbare forslags-profilen (en lokal draft — IKKE den lagrede profilen). */
  profile: ChildSchoolProfile
  onChange: (next: ChildSchoolProfile) => void
}

/**
 * Kompakt fag + tid-editor for timeplan-forslaget, vist FØR «Bruk forslag». Lar deg se hvilke fag
 * analysen fant og rette dem (fag + start/slutt), uten å dra inn hele «Avansert timeplan»
 * (rom/lærer/underkategori/pauser ligger der, etter at forslaget er brukt). Redigeringslogikken er
 * delt med `SchoolProfileFields` via `lib/schoolLessons`, så de to flatene aldri divergerer.
 */
export function TimetableSuggestionLessons({ profile, onChange }: TimetableSuggestionLessonsProps) {
  const band = profile.gradeBand
  const subjects = SUBJECTS_BY_BAND[band]
  const gates = DEFAULT_SCHOOL_GATE_BY_BAND[band]
  const days = WEEKDAYS.filter((wd) => profile.weekdays[wd])
  if (days.length === 0) return null

  function setSimpleTime(wd: WeekdayMonFri, part: 'start' | 'end', val: string) {
    const plan = profile.weekdays[wd]
    onChange({
      ...profile,
      weekdays: {
        ...profile.weekdays,
        [wd]: {
          useSimpleDay: true,
          lessons: undefined,
          schoolStart: part === 'start' ? val : plan?.schoolStart ?? gates.start,
          schoolEnd: part === 'end' ? val : plan?.schoolEnd ?? gates.end,
        },
      },
    })
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2" aria-label="Foreslåtte skoledager">
        {days.map((wd) => {
          const plan = profile.weekdays[wd]!
          const hasLessons = plan.useSimpleDay === false && !!plan.lessons?.length
          const dayLabel = WD_LABELS[wd]
          return (
            <li key={wd} className="rounded-md border border-synkaNavy/12 bg-white px-2.5 py-2">
              <p className="text-body-sm font-semibold text-synkaNavy">{dayLabel}</p>
              {hasLessons ? (
                <div className="mt-1.5 space-y-1.5">
                  {plan.lessons!.map((L, i) => {
                    const known = isKnownSubjectKeyForBand(band, L.subjectKey)
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <select
                            aria-label={`Fag ${dayLabel} time ${i + 1}`}
                            value={L.subjectKey === CUSTOM_SUBJECT_KEY ? CUSTOM_SUBJECT_KEY : L.subjectKey}
                            onChange={(e) => {
                              const v = e.target.value
                              if (v === L.subjectKey) return
                              if (v === CUSTOM_SUBJECT_KEY) {
                                onChange(
                                  updateLessonInProfile(profile, wd, i, {
                                    subjectKey: CUSTOM_SUBJECT_KEY,
                                    customLabel: L.customLabel ?? '',
                                    lessonSubcategory: undefined,
                                  })
                                )
                              } else {
                                onChange(
                                  updateLessonInProfile(profile, wd, i, {
                                    subjectKey: v,
                                    customLabel: undefined,
                                  })
                                )
                              }
                            }}
                            className="min-h-9 min-w-0 flex-[1.6] rounded border border-synkaNavy/15 bg-white px-2 py-1 text-caption text-synkaNavy"
                          >
                            {!known ? (
                              <option value={L.subjectKey}>
                                {subjectLabelForKey(band, L.subjectKey, L.customLabel, L.lessonSubcategory)} (fra
                                import)
                              </option>
                            ) : null}
                            {subjects.map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.label}
                              </option>
                            ))}
                            <option value={CUSTOM_SUBJECT_KEY}>Annet fag…</option>
                          </select>
                          <input
                            type="time"
                            step={60}
                            aria-label={`Start ${dayLabel} time ${i + 1}`}
                            value={L.start}
                            onChange={(e) => onChange(updateLessonInProfile(profile, wd, i, { start: e.target.value }))}
                            className="h-9 w-[84px] shrink-0 rounded border border-synkaNavy/15 px-1.5 py-1 text-caption tabular-nums text-synkaNavy"
                          />
                          <span className="text-synkaNavy/40">–</span>
                          <input
                            type="time"
                            step={60}
                            aria-label={`Slutt ${dayLabel} time ${i + 1}`}
                            value={L.end}
                            onChange={(e) => onChange(updateLessonInProfile(profile, wd, i, { end: e.target.value }))}
                            className="h-9 w-[84px] shrink-0 rounded border border-synkaNavy/15 px-1.5 py-1 text-caption tabular-nums text-synkaNavy"
                          />
                          <button
                            type="button"
                            aria-label={`Fjern ${dayLabel} time ${i + 1}`}
                            onClick={() => onChange(removeLessonFromProfile(profile, wd, i))}
                            className="ml-auto inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-pill border border-synkaCoral/30 px-1 text-caption font-semibold text-synkaCoral"
                          >
                            ×
                          </button>
                        </div>
                        {L.subjectKey === CUSTOM_SUBJECT_KEY ? (
                          <input
                            type="text"
                            aria-label={`Fagnavn ${dayLabel} time ${i + 1}`}
                            value={L.customLabel ?? ''}
                            placeholder="Skriv inn fagnavn"
                            onChange={(e) => onChange(updateLessonInProfile(profile, wd, i, { customLabel: e.target.value }))}
                            className="w-full rounded border border-synkaNavy/15 px-2 py-1.5 text-caption text-synkaNavy"
                          />
                        ) : null}
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => onChange(addLessonToProfile(profile, wd))}
                    className="min-h-8 rounded-pill border border-synkaPrimary/30 px-3 py-1 text-caption font-medium text-synkaPrimary"
                  >
                    + Legg til time
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="time"
                    aria-label={`Start ${dayLabel}`}
                    value={plan.schoolStart ?? gates.start}
                    onChange={(e) => setSimpleTime(wd, 'start', e.target.value)}
                    className="h-9 w-[96px] rounded border border-synkaNavy/15 px-2 py-1 text-caption tabular-nums text-synkaNavy"
                  />
                  <span className="text-synkaNavy/40">–</span>
                  <input
                    type="time"
                    aria-label={`Slutt ${dayLabel}`}
                    value={plan.schoolEnd ?? gates.end}
                    onChange={(e) => setSimpleTime(wd, 'end', e.target.value)}
                    className="h-9 w-[96px] rounded border border-synkaNavy/15 px-2 py-1 text-caption tabular-nums text-synkaNavy"
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-caption text-synkaNavy/55">
        Rett fag og tider her. Rom, lærer og spor justeres i «Avansert timeplan» etter at du har brukt forslaget.
      </p>
    </div>
  )
}
