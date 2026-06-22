import { describe, expect, it } from 'vitest'
import { buildTimetableSuggestionFromBundle } from '../timetableImageImport'
import type { PortalImportProposalBundle, PortalProposalItem } from '../../features/tankestrom/types'
import type { ChildSchoolProfile } from '../../types'

function bundleWith(items: PortalProposalItem[]): PortalImportProposalBundle {
  return { items } as unknown as PortalImportProposalBundle
}

function schoolItem(profile: ChildSchoolProfile, confidence = 0.9): PortalProposalItem {
  return {
    proposalId: 'p1',
    kind: 'school_profile',
    sourceId: 's',
    originalSourceType: 'uploaded_file',
    confidence,
    schoolProfile: profile,
  } as unknown as PortalProposalItem
}

describe('buildTimetableSuggestionFromBundle', () => {
  it('mapper enkle skoledager til forslag med tidspunkter', () => {
    const out = buildTimetableSuggestionFromBundle(
      bundleWith([
        schoolItem({
          gradeBand: '5-7',
          weekdays: {
            0: { useSimpleDay: true, schoolStart: '08:15', schoolEnd: '14:00' },
            2: { useSimpleDay: true, schoolStart: '08:15', schoolEnd: '13:00' },
          },
        }),
      ])
    )
    expect(out).not.toBeNull()
    expect(out!.profile.gradeBand).toBe('5-7')
    expect(out!.days).toEqual([
      { weekday: 0, label: 'Mandag', startTime: '08:15', endTime: '14:00' },
      { weekday: 2, label: 'Onsdag', startTime: '08:15', endTime: '13:00' },
    ])
    expect(out!.profile.weekdays[0]).toEqual({
      useSimpleDay: true,
      schoolStart: '08:15',
      schoolEnd: '14:00',
    })
    expect(out!.confidence).toBe('high')
    expect(out!.warnings).toEqual([])
  })

  it('forenkler detaljert timeplan (lessons) til tidligste start / seneste slutt med advarsel', () => {
    const out = buildTimetableSuggestionFromBundle(
      bundleWith([
        schoolItem(
          {
            gradeBand: '8-10',
            weekdays: {
              1: {
                useSimpleDay: false,
                lessons: [
                  { subjectKey: 'mat', start: '09:00', end: '09:45' },
                  { subjectKey: 'nor', start: '08:30', end: '09:15' },
                  { subjectKey: 'eng', start: '10:00', end: '11:30' },
                ],
              },
            },
          },
          0.5
        ),
      ])
    )
    expect(out!.days).toEqual([{ weekday: 1, label: 'Tirsdag', startTime: '08:30', endTime: '11:30' }])
    expect(out!.confidence).toBe('medium')
    expect(out!.warnings).toContain('Detaljert timeplan ble forenklet til start- og sluttid.')
  })

  it('advarer når en dag mangler tydelig tid', () => {
    const out = buildTimetableSuggestionFromBundle(
      bundleWith([schoolItem({ gradeBand: '1-4', weekdays: { 0: { useSimpleDay: true } } })])
    )
    expect(out!.days).toEqual([{ weekday: 0, label: 'Mandag', startTime: undefined, endTime: undefined }])
    expect(out!.warnings).toContain('Noen dager mangler tydelig start-/sluttid — sjekk dem manuelt.')
  })

  it('returnerer null uten school_profile-forslag', () => {
    const eventItem = {
      proposalId: 'e1',
      kind: 'event',
      sourceId: 's',
      originalSourceType: 'uploaded_file',
      confidence: 0.9,
      event: { date: '2026-09-01', personId: '', title: 'Noe', start: '08:00', end: '09:00', metadata: {} },
    } as unknown as PortalProposalItem
    expect(buildTimetableSuggestionFromBundle(bundleWith([eventItem]))).toBeNull()
  })

  it('returnerer null når skoleprofilen ikke har dager', () => {
    expect(
      buildTimetableSuggestionFromBundle(bundleWith([schoolItem({ gradeBand: '1-4', weekdays: {} })]))
    ).toBeNull()
  })
})
