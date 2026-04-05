export const COPY = {
  status: {
    now: 'Nå',
    next: 'Neste',
    laterToday: 'Ingen hast nå',
    needsClarification: 'To aktiviteter samtidig',
  },
  conflicts: {
    collidesWith: 'Kolliderer med',
    noCollisions: 'Ingen kollisjoner i dette tidsrommet.',
    laterTodayOne: '1 kollisjon senere i dag',
    laterTodayManySuffix: 'kollisjoner senere i dag',
    badgeHelp: 'To aktiviteter skjer samtidig. Velg hva som skal prioriteres eller flytt tidspunktet.',
    suggestion: 'Forslag',
    note: 'OBS',
  },
  actions: {
    done: 'Ferdig',
    confirm: 'Bekreft',
    postpone15: 'Utsett 15 min',
    moveTomorrow: 'Flytt til i morgen',
    prioritizeActivity: 'Prioriter aktiviteten',
    clarifyLater: 'Avklar senere',
  },
  feedback: {
    saving: 'Lagrer...',
    saved: 'Lagret',
    saveFailed: 'Kunne ikke lagre - Prøv igjen',
  },
} as const
