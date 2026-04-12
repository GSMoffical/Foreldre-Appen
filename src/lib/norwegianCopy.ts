export const COPY = {
  status: {
    now: 'Nå',
    next: 'Neste',
    laterToday: 'Ingen hast nå',
    needsClarification: 'To hendelser samtidig',
  },
  conflicts: {
    collidesWith: 'Kolliderer med',
    noCollisions: 'Ingen kollisjoner i dette tidsrommet.',
    laterTodayOne: '1 kollisjon senere i dag',
    laterTodayManySuffix: 'kollisjoner senere i dag',
    badgeHelp: 'To hendelser skjer samtidig. Velg hva som skal prioriteres eller flytt tidspunktet.',
    suggestion: 'Forslag',
    note: 'OBS',
  },
  actions: {
    done: 'Ferdig',
    confirm: 'Bekreft',
    postpone15: 'Utsett 15 min',
    moveTomorrow: 'Flytt til i morgen',
    prioritizeActivity: 'Prioriter hendelsen',
    clarifyLater: 'Avklar senere',
  },
  feedback: {
    saving: 'Lagrer...',
    saved: 'Lagret',
    saveFailed: 'Kunne ikke lagre - Prøv igjen',
  },
} as const
