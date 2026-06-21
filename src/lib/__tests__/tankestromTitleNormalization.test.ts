import { describe, expect, it } from 'vitest'
import {
  normalizeCalendarEventTitle,
  normalizeSingleEventCalendarTitle,
  stripResolvedRelativeDateTimeFromTitle,
} from '../tankestromTitleNormalization'

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

describe('normalizeSingleEventCalendarTitle — kalendertrygge enkelthendelse-titler', () => {
  it('fjerner relativt datoord når dato er tolket', () => {
    expect(normalizeSingleEventCalendarTitle('Samling ved Sognsvann i morgen', { start: '18:00' })).toBe(
      'Samling ved Sognsvann'
    )
  })

  it('fjerner relativt datoord + «kl <tid>»', () => {
    expect(
      normalizeSingleEventCalendarTitle('Samling ved Sognsvann i morgen kl 18', { start: '18:00' })
    ).toBe('Samling ved Sognsvann')
  })

  it('fjerner «på <ukedag>» + klokkeslett med minutter', () => {
    expect(normalizeSingleEventCalendarTitle('Fotballtrening på fredag kl 17:30', { start: '17:30' })).toBe(
      'Fotballtrening'
    )
  })

  it('beholder sted, fjerner kun bar ukedag + tid', () => {
    expect(
      normalizeSingleEventCalendarTitle('Kamp mot Lyn på Ekeberg lørdag kl 12', { start: '12:00' })
    ).toBe('Kamp mot Lyn på Ekeberg')
  })

  it('beholder «på <sted>», fjerner «neste <ukedag>»', () => {
    expect(normalizeSingleEventCalendarTitle('Foreldremøte på skolen neste tirsdag')).toBe(
      'Foreldremøte på skolen'
    )
  })

  it('ødelegger ikke sammensatt dato-navn «17. mai-frokost»', () => {
    expect(normalizeSingleEventCalendarTitle('17. mai-frokost')).toBe('17. mai-frokost')
  })

  it('lar etablert tittel uten dato/tid stå urørt', () => {
    expect(normalizeSingleEventCalendarTitle('Kamp mot Lyn')).toBe('Kamp mot Lyn')
  })

  it('beholder ukenummer i «Uke 42-planlegging»', () => {
    expect(normalizeSingleEventCalendarTitle('Uke 42-planlegging')).toBe('Uke 42-planlegging')
  })

  it('lager ikke tom tittel når alt er dato/tid (trygg fallback)', () => {
    const out = normalizeSingleEventCalendarTitle('I morgen kl 18', { start: '18:00' })
    expect(out.trim().length).toBeGreaterThan(0)
  })

  it('returnerer tom streng kun når hele tittelen er dato/tid', () => {
    expect(stripResolvedRelativeDateTimeFromTitle('I morgen kl 18')).toBe('')
    expect(stripResolvedRelativeDateTimeFromTitle('Samling ved Sognsvann i morgen')).toBe(
      'Samling ved Sognsvann'
    )
  })
})

