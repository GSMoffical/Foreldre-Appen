import { useRef, useState } from 'react'
import { IconArrowLeft, IconPencil, IconUser, IconTrash } from '@tabler/icons-react'
import type { ChildSchoolProfile, ParentWorkProfile, Person, WeekdayMonFri } from '../types'
import {
  DEFAULT_SCHOOL_GATE_BY_BAND,
  GRADE_BAND_LABELS,
  subjectLabelForKey,
} from '../data/norwegianSubjects'
import { formatTimeRange } from '../lib/time'
import { typSectionCap } from '../lib/ui'
import { TankestromWeekBadge } from './TankestromWeekBadge'

const WD_LABELS: Record<WeekdayMonFri, string> = {
  0: 'Mandag',
  1: 'Tirsdag',
  2: 'Onsdag',
  3: 'Torsdag',
  4: 'Fredag',
}
const WEEKDAYS: WeekdayMonFri[] = [0, 1, 2, 3, 4]

function roleLabel(kind: Person['memberKind']): string {
  return kind === 'parent' ? 'Forelder' : kind === 'guest' ? 'Gjest' : 'Barn'
}

function roleChipClass(kind: Person['memberKind']): string {
  return kind === 'parent'
    ? 'bg-synkaTeal/15 text-synkaPrimary'
    : kind === 'guest'
      ? 'bg-zinc-100 text-zinc-500'
      : 'bg-synkaYellow/25 text-synkaNavy/70'
}

interface PersonDetailProps {
  person: Person
  /** Ukedager (man=0…fre=4) med Tankestrøm-avvik denne uken. */
  overlayDays: Set<WeekdayMonFri>
  canEdit: boolean
  canInvite: boolean
  canRemove: boolean
  onBack: () => void
  onEdit: () => void
  onInvite: () => void
  onRemove: () => void
}

export function PersonDetail({
  person,
  overlayDays,
  canEdit,
  canInvite,
  canRemove,
  onBack,
  onEdit,
  onInvite,
  onRemove,
}: PersonDetailProps) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const scheduleRef = useRef<HTMLDivElement>(null)
  const overlayCount = overlayDays.size
  const isLinkedParent = person.memberKind === 'parent' && !!person.linkedAuthUserId

  function scrollToSchedule() {
    scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-synkaNavy/8 bg-synkaCream px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-synkaNavy/8 active:opacity-70 touch-manipulation"
          aria-label="Tilbake"
        >
          <IconArrowLeft size={18} className="text-synkaNavy" aria-hidden />
        </button>
        <h1 className="truncate text-heading font-bold text-synkaNavy">{person.name}</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] [-webkit-overflow-scrolling:touch]">
        {/* Identitet */}
        <div className="rounded-md bg-white p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-display font-bold"
              style={{
                backgroundColor: person.colorTint,
                border: `2px solid ${person.colorAccent}`,
                color: person.colorAccent,
              }}
              aria-hidden
            >
              {person.name.trim().slice(0, 1).toUpperCase() || '?'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-heading font-bold text-synkaNavy">{person.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-block rounded-pill px-2 py-0.5 text-caption font-semibold uppercase tracking-wide ${roleChipClass(person.memberKind)}`}
                >
                  {roleLabel(person.memberKind)}
                </span>
                {isLinkedParent && (
                  <span className="inline-block rounded-pill bg-synkaPrimary/10 px-2 py-0.5 text-caption font-semibold text-synkaPrimary">
                    I appen
                  </span>
                )}
              </div>
            </div>
          </div>

          {person.memberKind === 'child' && overlayCount > 0 && (
            <div className="mt-3">
              <TankestromWeekBadge count={overlayCount} onClick={scrollToSchedule} />
            </div>
          )}

          {/* Handlinger */}
          {(canEdit || canInvite) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-synkaPrimary px-4 py-2 text-body-sm font-semibold text-white shadow-planner-sm transition hover:brightness-95 active:shadow-planner-press"
                >
                  <IconPencil size={14} aria-hidden /> Rediger
                </button>
              )}
              {canInvite && (
                <button
                  type="button"
                  onClick={onInvite}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-synkaTeal/15 px-4 py-2 text-body-sm font-semibold text-synkaPrimary transition hover:bg-synkaTeal/25 active:opacity-70"
                >
                  <IconUser size={14} aria-hidden /> Inviter til appen
                </button>
              )}
            </div>
          )}
        </div>

        {/* Profil */}
        {person.memberKind === 'child' && (
          <div ref={scheduleRef} className="mt-4">
            <ChildSchoolView school={person.school} overlayDays={overlayDays} />
          </div>
        )}
        {person.memberKind === 'parent' && (
          <div className="mt-4">
            <ParentWorkView work={person.work} />
          </div>
        )}
        {person.memberKind === 'guest' && (
          <div className="mt-4 rounded-md bg-white p-4 shadow-soft">
            <p className="text-body-sm text-synkaNavy/60">
              Gjester kan se familiekalenderen, men har ingen skole- eller arbeidsprofil.
            </p>
          </div>
        )}

        {/* Fjern */}
        {canRemove && (
          <div className="mt-6">
            {confirmRemove ? (
              <div className="flex items-center gap-2 rounded-lg border border-synkaCoral/20 bg-synkaCoral/5 px-3 py-2.5">
                <p className="flex-1 text-label font-medium text-synkaCoral">
                  Fjerne {person.name} fra familien?
                </p>
                <button
                  type="button"
                  onClick={onRemove}
                  className="rounded-pill bg-synkaCoral px-3 py-1.5 text-caption font-semibold text-white transition hover:bg-synkaCoral/90 active:opacity-70 touch-manipulation"
                >
                  Fjern
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  className="rounded-pill border border-synkaCoral/30 bg-white px-3 py-1.5 text-caption font-semibold text-synkaCoral active:opacity-70 touch-manipulation"
                >
                  Avbryt
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="inline-flex items-center gap-1.5 rounded-pill border border-synkaCoral/30 bg-synkaCoral/5 px-4 py-2 text-body-sm font-semibold text-synkaCoral transition hover:bg-synkaCoral/10 active:opacity-70 touch-manipulation"
              >
                <IconTrash size={14} aria-hidden /> Fjern fra familien
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Child school ──────────────────────────────────────────────────────────────

function ChildSchoolView({
  school,
  overlayDays,
}: {
  school: ChildSchoolProfile | undefined
  overlayDays: Set<WeekdayMonFri>
}) {
  if (!school) {
    return (
      <EmptySection
        title="Skolerute"
        text="Skolerute ikke satt. Rediger barnet for å legge til trinn og timeplan."
      />
    )
  }

  const gates = DEFAULT_SCHOOL_GATE_BY_BAND[school.gradeBand]

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-white p-4 shadow-soft">
        <SectionCap>Trinn</SectionCap>
        <p className="mt-1.5 text-body font-semibold text-synkaNavy">
          {GRADE_BAND_LABELS[school.gradeBand]}
        </p>
        <p className="mt-1 text-caption text-synkaNavy/50">
          Standard skoledag når annet ikke er satt: {gates.start}–{gates.end} (man–fre).
        </p>
      </div>

      <div className="rounded-md bg-white p-4 shadow-soft">
        <SectionCap>Uke (man–fre)</SectionCap>
        <div className="mt-2.5 space-y-2">
          {WEEKDAYS.map((wd) => {
            const plan = school.weekdays[wd]
            const changed = overlayDays.has(wd)
            const lessons =
              plan && plan.useSimpleDay === false && plan.lessons?.length ? plan.lessons : null
            return (
              <div
                key={wd}
                className={`rounded-md border px-3 py-2.5 ${
                  changed
                    ? 'border-synkaTeal/40 bg-synkaTeal/8'
                    : 'border-synkaNavy/10 bg-zinc-50/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body-sm font-semibold text-synkaNavy">{WD_LABELS[wd]}</span>
                  {changed && (
                    <span className="rounded-pill bg-synkaTeal/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-synkaPrimary">
                      Endret
                    </span>
                  )}
                </div>
                {!plan ? (
                  <p className="mt-1 text-body-sm text-synkaNavy/45">Fri</p>
                ) : lessons ? (
                  <ul className="mt-1.5 space-y-1">
                    {lessons.map((L, i) => (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-body-sm text-synkaNavy">
                          {subjectLabelForKey(
                            school.gradeBand,
                            L.subjectKey,
                            L.customLabel,
                            L.lessonSubcategory,
                          )}
                        </span>
                        <span className="shrink-0 text-caption tabular-nums text-synkaNavy/55">
                          {formatTimeRange(L.start, L.end)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-body-sm text-synkaNavy">Skole</span>
                    <span className="shrink-0 text-caption tabular-nums text-synkaNavy/55">
                      {formatTimeRange(plan.schoolStart ?? gates.start, plan.schoolEnd ?? gates.end)}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Parent work ─────────────────────────────────────────────────────────────

function ParentWorkView({ work }: { work: ParentWorkProfile | undefined }) {
  const weekdays = work?.weekdays
  const hasAny = !!weekdays && Object.keys(weekdays).length > 0

  if (!hasAny) {
    return (
      <EmptySection
        title="Arbeidstid"
        text="Arbeidstid ikke satt. Rediger forelderen for å legge til arbeidstid."
      />
    )
  }

  return (
    <div className="rounded-md bg-white p-4 shadow-soft">
      <SectionCap>Arbeidstid (man–fre)</SectionCap>
      <div className="mt-2.5 space-y-2">
        {WEEKDAYS.map((wd) => {
          const row = weekdays[wd]
          return (
            <div
              key={wd}
              className="flex items-center justify-between gap-3 rounded-md border border-synkaNavy/10 bg-zinc-50/60 px-3 py-2.5"
            >
              <span className="text-body-sm font-semibold text-synkaNavy">{WD_LABELS[wd]}</span>
              {row ? (
                <span className="shrink-0 text-caption tabular-nums text-synkaNavy/55">
                  {formatTimeRange(row.start, row.end)}
                </span>
              ) : (
                <span className="text-body-sm text-synkaNavy/45">Fri</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function SectionCap({ children }: { children: React.ReactNode }) {
  return <p className={typSectionCap}>{children}</p>
}

function EmptySection({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md bg-white p-4 shadow-soft">
      <SectionCap>{title}</SectionCap>
      <p className="mt-1.5 text-body-sm text-synkaNavy/55">{text}</p>
    </div>
  )
}
