/** Lightweight onboarding state — stored in localStorage, no external deps. */

export interface TourStep {
  id: string
  title: string
  body: string
  /** DOM element ID to ring-highlight; null = no spotlight */
  targetId: string | null
  /**
   * Explicit card placement override.
   * 'top'    — card anchored near top of viewport (use when target is in lower screen half).
   * 'bottom' — card anchored above BottomNav (default for top-of-screen targets).
   * Omit to let OnboardingTour compute placement from measured ring position.
   */
  cardPlacement?: 'top' | 'bottom' | 'center'
}

export const SHORT_TOUR_STEPS: TourStep[] = [
  {
    id: 'today-nav',
    title: 'Bytt visning og finn tilbake',
    body: 'Knappen nederst til venstre sykler mellom visningene: «I dag» → «Uke» → «Måned» → tilbake til «I dag». Trykk «I dag» i verktøylinjen øverst for å hoppe direkte tilbake til dagens uke uansett hvor du er.',
    targetId: 'onb-nav-cycle',
    cardPlacement: 'center',
  },
  {
    id: 'move-blocks',
    title: 'Flytt blokker med dra/sveip',
    body: 'I dagsvisning kan du dra i håndtaket på en hendelsesblokk for å flytte tidspunkt. I ukelisten kan du sveipe en rad til venstre for raske handlinger.',
    targetId: 'onb-timeline',
    cardPlacement: 'bottom',
  },
  {
    id: 'add-event',
    title: 'Legg til en hendelse',
    body: '«+ Hendelse» oppretter noe med fast tid – fotball, trening, møter.',
    targetId: 'onb-add-event',
  },
  {
    id: 'tasks-tab',
    title: 'Alle gjøremål samlet',
    body: '«Gjøremål»-fanen viser alle åpne gjøremål på tvers av alle dager, sortert etter dato. Merk dem ferdige direkte der.',
    targetId: 'onb-tasks-tab',
    cardPlacement: 'top', // target is in BottomNav — card must sit above the spotlight ring
  },
]

export const EXTRA_TOUR_STEPS: TourStep[] = [
  {
    id: 'nav-week-strip',
    title: 'Bytt dag raskt',
    body: 'Trykk på en dag i ukeremsen for å se den dagen med en gang. Pilene blar uke for uke.',
    targetId: 'onb-week-strip',
  },
  {
    id: 'add-task',
    title: 'Legg til et gjøremål',
    body: '«+ Gjøremål» er for ting uten fast starttid – f.eks. ringe legen, kjøpe melk eller sende et skjema.',
    targetId: 'onb-add-task',
  },
  {
    id: 'transport',
    title: 'Levering og henting',
    body: 'En fargestripe øverst på en hendelsesblokk (↑) viser hvem som leverer; en stripe nederst (↓) viser hvem som henter.',
    targetId: null,
  },
]

export interface OnboardingState {
  tourCompleted: boolean
  tourStep: number
  /** IDs of one-time contextual hints already shown */
  seenHints: string[]
}

const STORAGE_KEY_PREFIX = 'foreldre_onboarding_v1'
const storageKey = (userId: string) => `${STORAGE_KEY_PREFIX}_${userId}`

export function loadOnboarding(userId: string): OnboardingState {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (raw) return JSON.parse(raw) as OnboardingState
  } catch {}
  return { tourCompleted: false, tourStep: 0, seenHints: [] }
}

export function saveOnboarding(state: OnboardingState, userId: string): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state))
  } catch {}
}

export function resetOnboarding(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId))
  } catch {}
}

export function hasSeenHint(hintId: string, userId: string): boolean {
  return loadOnboarding(userId).seenHints.includes(hintId)
}

export function markHintSeen(hintId: string, userId: string): void {
  const state = loadOnboarding(userId)
  if (!state.seenHints.includes(hintId)) {
    state.seenHints.push(hintId)
    saveOnboarding(state, userId)
  }
}
