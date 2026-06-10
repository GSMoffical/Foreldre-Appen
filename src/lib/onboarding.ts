export interface TourStep {
  id: string
  title: string
  body: string
  targetId: string | null
  cardPlacement?: 'top' | 'bottom' | 'center'
}

export const SHORT_TOUR_STEPS: TourStep[] = [
  {
    id: 'week-strip',
    title: 'Dette er dagen din',
    body: '«I dag» er hjemmebasen din. Trykk på en dag i ukestripen øverst for å hoppe rett dit – perfekt når du skal sjekke onsdagen i farta.',
    targetId: 'onb-week-strip',
    cardPlacement: 'bottom',
  },
  {
    id: 'add-event',
    title: 'Hendelser har et klokkeslett',
    body: 'Fotball, tannlege, foreldremøte – alt med fast tid er en hendelse. Den lander som en farget blokk på tidslinjen.',
    targetId: 'onb-add-event',
    cardPlacement: 'top',
  },
  {
    id: 'drag-event',
    title: 'Flytt hendelser med dra',
    body: 'Trykk og hold på en hendelsesblokk for å flytte den til et nytt tidspunkt. Dra i håndtaket nederst til høyre.',
    targetId: 'onb-timeline',
    cardPlacement: 'top',
  },
  {
    id: 'tasks-tab',
    title: 'Gjøremål – alt det andre',
    body: 'Kjøpe melk, ringe skolen, sende skjema? Gjøremål er for alt uten fast klokkeslett. Samles her, sortert etter dato.',
    targetId: 'onb-tasks-tab',
    cardPlacement: 'top',
  },
  {
    id: 'tankestrom',
    title: 'La Synka lese skoleskrivene',
    body: 'Under «Mer» finner du Tankestrøm: last opp et skoleskriv, så lager den hendelser og gjøremål for deg. Litt magisk, faktisk.',
    targetId: 'onb-mer-tab',
    cardPlacement: 'top',
  },
]

export const EXTRA_TOUR_STEPS: TourStep[] = [
  {
    id: 'transport',
    title: 'Hvem leverer og henter?',
    body: 'Stripen øverst på en hendelsesblokk viser hvem som leverer, stripen nederst hvem som henter. Ett blikk – null misforståelser.',
    targetId: null,
    cardPlacement: 'center',
  },
  {
    id: 'partner',
    title: 'Del med partneren din',
    body: 'Gå til Mer → Familie og inviter partneren din. Da ser dere samme kalender – og slipper «trodde du tok det?».',
    targetId: null,
    cardPlacement: 'center',
  },
]

export interface OnboardingState {
  tourCompleted: boolean
  tourStep: number
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
