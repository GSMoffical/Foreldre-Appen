import type { Person } from '../../types'
import type { CanonicalPlanItem, CanonicalSchoolImportPlan } from '../../lib/canonicalSchoolImportPlan'
import { CanonicalSchoolDayContent } from '../../components/CanonicalSchoolDayContent'
import { ShadowChildReview, ShadowItemReviewControls } from './ShadowReviewControls'
import type { UseShadowReview } from './useShadowReview'

/**
 * Forhåndsvisning som utelukkende bruker den delte `CanonicalSchoolImportPlan`. Ingen parallell
 * schoolBlock-/overlay-preview og ingen tekstfallback — canonical er autoritativ når planen finnes.
 * Selve dags-innholdet rendres av `CanonicalSchoolDayContent` — SAMME komponent som den lagrede
 * skoleblokken (BackgroundDetailSheet) bruker etter readback, så preview og persist er identiske.
 *
 * `shadowReview` er OPT-IN: uten den er dette ren read-only preview (uendret). Med den vises Shadow-
 * review (barn + per-item Godkjenn/Rett/Avvis + lagrings-status). Prediction endres aldri.
 */
export interface ShadowReviewBinding {
  review: UseShadowReview
  predictedChild: Person | undefined
  candidates: Person[]
}

export function CanonicalSchoolImportPreview({
  plan,
  child,
  shadowReview,
}: {
  plan: CanonicalSchoolImportPlan
  child: Person | undefined
  shadowReview?: ShadowReviewBinding
}) {
  if (plan.days.length === 0) return null

  const sr = shadowReview
  const renderItemReview = sr
    ? (item: CanonicalPlanItem) => (
        <ShadowItemReviewControls
          item={item}
          verdict={sr.review.getItemVerdict(item.itemId)}
          onApprove={() => sr.review.approveItem(item)}
          onReject={() => sr.review.rejectItem(item)}
          onCorrect={(corrected) => sr.review.correctItem(item, corrected)}
        />
      )
    : undefined

  return (
    <div className="mx-4 mt-4 rounded-md border border-synkaNavy/10 bg-white p-3">
      <p className="text-body-sm font-semibold text-synkaNavy">Slik blir skole-uken</p>
      <p className="mt-0.5 text-caption text-synkaNavy/50">
        {sr
          ? 'Shadow-vurdering (pilot): bekreft eller rett hva Synka forsto. Lagres kun for piloten — ikke importert.'
          : `Forhåndsvisning av skoleuken for ${child?.name ?? 'barnet'} basert på ukeplanen.`}
      </p>

      {sr ? <ShadowReviewStatus review={sr.review} /> : null}

      {sr ? (
        <div className="mt-2">
          <ShadowChildReview
            predictedChild={sr.predictedChild}
            candidates={sr.candidates}
            childApproved={sr.review.reviewState.runReview?.childVerdict === 'approve'}
            correctedChildId={sr.review.reviewState.runReview?.correctedChildMemberId}
            onApprove={() => sr.review.approveChild()}
            onCorrect={(id) => sr.review.correctChild(id)}
          />
        </div>
      ) : null}

      <div className="mt-2 space-y-3">
        {plan.days.map((day, i) => (
          <div key={`${day.weekday ?? 'x'}-${i}`} className="rounded-md border border-synkaNavy/10 bg-synkaCream/40 p-2">
            <p className="text-caption font-semibold text-synkaNavy">{day.dayLabel}</p>
            <CanonicalSchoolDayContent day={day} renderItemReview={renderItemReview} />
          </div>
        ))}
      </div>
    </div>
  )
}

function ShadowReviewStatus({ review }: { review: UseShadowReview }) {
  if (review.runStatus === 'creating') {
    return <p className="mt-1 text-caption text-synkaNavy/50">Klargjør Shadow-vurdering…</p>
  }
  if (review.runStatus === 'error') {
    return (
      <p className="mt-1 rounded-md border border-amber-200 bg-amber-50/70 px-2 py-1 text-caption text-amber-900">
        Kunne ikke starte Shadow-vurdering. Vanlig import fungerer fortsatt; vurderingen kan ikke lagres nå.
      </p>
    )
  }
  const save =
    review.saveStatus === 'saving'
      ? 'Lagrer…'
      : review.saveStatus === 'error'
        ? 'Kunne ikke lagre vurderingen — prøv igjen.'
        : review.saveStatus === 'saved'
          ? review.isComplete
            ? 'Vurdering lagret for piloten (ferdig).'
            : 'Vurdering lagret for piloten.'
          : null
  if (!save) return null
  const isErr = review.saveStatus === 'error'
  return (
    <p
      className={`mt-1 rounded-md px-2 py-1 text-caption ${
        isErr ? 'border border-rose-200 bg-rose-50/70 text-rose-900' : 'text-synkaNavy/50'
      }`}
    >
      {save}
    </p>
  )
}
