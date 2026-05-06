import { describe, expect, it } from 'vitest'
import { normalizeCalendarEventTitle } from '../tankestromTitleNormalization'

describe('normalizeCalendarEventTitle', () => {
  it('fjerner dato-støy fra cup-tittel men beholder meningsbærende del', () => {
    const out = normalizeCalendarEventTitle(
      'Vårcupen 2026 – fredag · Fredag 12. juni 2026',
      { start: '18:40', end: '20:00' }
    )
    expect(out).toBe('Vårcupen 2026 – fredag')
  })

  it('fjerner statusord i parentes og lar kort aktivitet stå', () => {
    const out = normalizeCalendarEventTitle(
      'Vårcupen 2026 – søndag · Søndag 14. juni 2026 (usikker / betinget)',
      { start: '09:20', end: '10:40' }
    )
    expect(out).toBe('Vårcupen 2026 – søndag')
  })

  it('normaliserer flyreise-tittel med dato til kompakt rute', () => {
    const out = normalizeCalendarEventTitle('Flyreise Oslo til Split ons. 29. juli 2026', {
      start: '08:30',
      end: '11:30',
    })
    expect(out).toBe('Flyreise Oslo–Split')
  })

  it('fjerner klokkeslett i title når de matcher event start/end', () => {
    const out = normalizeCalendarEventTitle('Trening kl. 18:40–20:00 foreløpig', {
      start: '18:40',
      end: '20:00',
    })
    expect(out).toBe('Trening')
  })
})

