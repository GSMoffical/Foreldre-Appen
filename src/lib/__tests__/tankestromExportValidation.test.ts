import { describe, expect, it } from 'vitest'
import {
  collectTankestromEventExportValidationIssues,
  collectTankestromTaskExportValidationIssues,
  groupTankestromExportValidationIssues,
} from '../../features/tankestrom/useTankestromImport'
import type { TankestromEventDraft, TankestromTaskDraft } from '../../features/tankestrom/types'

describe('Tankestrom eksport-validering (preflight)', () => {
  const eventBase: TankestromEventDraft = {
    title: 'Skolefest',
    date: '2026-06-15',
    start: '10:00',
    end: '11:00',
    personId: 'p1',
    location: '',
    notes: '',
    includeRecurrence: false,
    dropoffBy: '',
    pickupBy: '',
    isManualCalendarEntry: true,
  }

  it('gir tydelig person-feil når person mangler', () => {
    const issues = collectTankestromEventExportValidationIssues(
      'proposal-a',
      undefined,
      { ...eventBase, personId: '' },
      new Set(['p1'])
    )
    expect(issues.some((i) => i.code === 'missing_person')).toBe(true)
    expect(issues.find((i) => i.field === 'personId')?.message).toMatch(/barn|person/i)
    expect(issues.find((i) => i.field === 'personId')?.actionHint.length).toBeGreaterThan(10)
  })

  it('gir tydelig melding når dato mangler', () => {
    const issues = collectTankestromEventExportValidationIssues(
      'proposal-b',
      undefined,
      { ...eventBase, date: '' },
      new Set(['p1'])
    )
    expect(issues.some((i) => i.code === 'missing_date')).toBe(true)
    expect(issues.find((i) => i.field === 'date')?.message).toMatch(/Dato mangler/i)
  })

  it('gir tydelig melding når tittel mangler', () => {
    const issues = collectTankestromEventExportValidationIssues(
      'proposal-c',
      undefined,
      { ...eventBase, title: '  ' },
      new Set(['p1'])
    )
    expect(issues.some((i) => i.code === 'missing_title')).toBe(true)
  })

  it('gir slutt-før-start-feil med riktig kode', () => {
    const issues = collectTankestromEventExportValidationIssues(
      'proposal-d',
      undefined,
      { ...eventBase, start: '10:00', end: '09:00' },
      new Set(['p1'])
    )
    expect(issues.some((i) => i.code === 'end_not_after_start')).toBe(true)
    expect(issues.find((i) => i.field === 'end')?.message).toMatch(/etter start/i)
  })

  it('har ingen issues for gyldig hendelsesutkast', () => {
    const issues = collectTankestromEventExportValidationIssues(
      'proposal-ok',
      undefined,
      eventBase,
      new Set(['p1'])
    )
    expect(issues).toEqual([])
  })

  it('grupperer flere felt til én melding med (+N til) når nødvendig', () => {
    const issues = collectTankestromEventExportValidationIssues(
      'proposal-x',
      undefined,
      {
        ...eventBase,
        title: '',
        date: '',
        personId: '',
        start: '09:00',
        end: '',
      },
      new Set(['p1'])
    )
    const grouped = groupTankestromExportValidationIssues(issues)
    expect(grouped?.validationCode).toBe('multiple_validation')
    expect(grouped?.message).toMatch(/\+\d+ til/)
  })

  const taskBase: TankestromTaskDraft = {
    title: 'Levere perm',
    date: '2026-06-20',
    notes: '',
    dueTime: '',
    childPersonId: '',
    assignedToPersonId: '',
    showInMonthView: false,
    taskIntent: 'must_do',
  }

  it('oppgave: manglende tittel gir strukturert issue', () => {
    const issues = collectTankestromTaskExportValidationIssues('t1', { ...taskBase, title: '' })
    expect(issues[0]?.code).toBe('missing_task_title')
  })
})
