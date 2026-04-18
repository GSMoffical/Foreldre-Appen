import { describe, expect, it } from 'vitest'
import { parseChildSchoolProfile, parsePortalImportProposalBundle } from '../tankestromApi'

const provenance = {
  sourceSystem: 'tankestrom' as const,
  sourceType: 'test',
  generatedAt: '2026-01-01T12:00:00Z',
  importRunId: '00000000-0000-4000-8000-000000000001',
}

describe('parseChildSchoolProfile', () => {
  it('parser gyldig profil med én dag og timer', () => {
    const p = parseChildSchoolProfile(
      {
        gradeBand: '5-7',
        weekdays: {
          0: {
            useSimpleDay: false,
            lessons: [
              { subjectKey: 'matematikk', start: '08:15', end: '09:00' },
              { subjectKey: 'norsk', start: '09:15', end: '10:00' },
            ],
          },
        },
      },
      'test'
    )
    expect(p.gradeBand).toBe('5-7')
    expect(p.weekdays[0]?.lessons).toHaveLength(2)
    expect(p.weekdays[0]?.lessons?.[0]?.subjectKey).toBe('matematikk')
  })

  it('avviser ugyldig gradeBand', () => {
    expect(() =>
      parseChildSchoolProfile({ gradeBand: 'vg99', weekdays: {} }, 'x')
    ).toThrow(/gradeBand/)
  })

  it('avviser ukedag utenfor 0–4', () => {
    expect(() =>
      parseChildSchoolProfile(
        { gradeBand: '1-4', weekdays: { 5: { useSimpleDay: true, schoolStart: '08:30', schoolEnd: '14:00' } } },
        'x'
      )
    ).toThrow(/ukedag/)
  })
})

describe('parsePortalImportProposalBundle — school_profile', () => {
  it('aksepterer items med kind school_profile', () => {
    const bundle = parsePortalImportProposalBundle({
      schemaVersion: '1.0.0',
      provenance,
      items: [
        {
          proposalId: 'c3d4e5f6-a7b8-4901-8234-567890abcdef',
          kind: 'school_profile',
          sourceId: 'src-1',
          originalSourceType: 'weekly_timetable',
          confidence: 0.9,
          suggestedPersonId: 'child-1',
          schoolProfile: {
            gradeBand: '8-10',
            weekdays: {
              1: { useSimpleDay: true, schoolStart: '08:15', schoolEnd: '15:00' },
            },
          },
        },
      ],
    })
    expect(bundle.items).toHaveLength(1)
    expect(bundle.items[0]!.kind).toBe('school_profile')
    if (bundle.items[0]!.kind === 'school_profile') {
      expect(bundle.items[0].schoolProfile.gradeBand).toBe('8-10')
      expect(bundle.items[0].suggestedPersonId).toBe('child-1')
    }
  })

  it('støtter alias profile på item', () => {
    const bundle = parsePortalImportProposalBundle({
      schemaVersion: '1.0.0',
      provenance,
      items: [
        {
          proposalId: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
          kind: 'school_profile',
          sourceId: 'src-1',
          originalSourceType: 'timetable',
          confidence: 1,
          profile: {
            gradeBand: 'vg1',
            weekdays: {},
          },
        },
      ],
    })
    expect(bundle.items[0]!.kind).toBe('school_profile')
  })

  it('støtter toppnivå schoolProfile når items er tom', () => {
    const bundle = parsePortalImportProposalBundle({
      schemaVersion: '1.0.0',
      provenance,
      items: [],
      schoolProfile: {
        gradeBand: '5-7',
        weekdays: {
          0: { useSimpleDay: false, lessons: [{ subjectKey: 'norsk', start: '09:00', end: '10:00' }] },
        },
      },
    })
    expect(bundle.items).toHaveLength(1)
    expect(bundle.items[0]!.kind).toBe('school_profile')
  })

  it('avviser blanding av school_profile og event', () => {
    expect(() =>
      parsePortalImportProposalBundle({
        schemaVersion: '1.0.0',
        provenance,
        items: [
          {
            proposalId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            kind: 'school_profile',
            sourceId: 's',
            originalSourceType: 't',
            confidence: 1,
            schoolProfile: { gradeBand: '1-4', weekdays: {} },
          },
          {
            proposalId: 'b2c3d4e5-f6a7-4890-b123-456789abcdef',
            kind: 'event',
            sourceId: 'e',
            originalSourceType: 'e',
            confidence: 1,
            event: {
              date: '2026-04-20',
              personId: 'p1',
              title: 'X',
              start: '10:00',
              end: '11:00',
            },
          },
        ],
      })
    ).toThrow(/kan ikke kombineres/)
  })
})
