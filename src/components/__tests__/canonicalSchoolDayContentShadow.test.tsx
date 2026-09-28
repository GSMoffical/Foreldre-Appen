// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { CanonicalPlanDay, CanonicalPlanItem } from '../../lib/canonicalSchoolImportPlan'
import { CanonicalSchoolDayContent } from '../CanonicalSchoolDayContent'

afterEach(cleanup)

function item(over: Partial<CanonicalPlanItem> = {}): CanonicalPlanItem {
  return {
    itemId: 'it-1', sourceId: 's-1', sourceRef: null, placement: 'subject', contentType: 'lesson',
    subjectKey: 'matematikk', start: '10:35', end: '11:35', audienceEntries: [], lines: ['Forberedelsesdag'],
    reviewRequired: false, ...over,
  }
}

const day: CanonicalPlanDay = {
  weekday: 1, dayLabel: 'Tirsdag', op: 'none', note: null,
  timetable: [{ key: 'r1', label: 'Matematikk', start: '10:35', end: '11:35', items: [item()] }],
  replacement: null, unplacedSubjectGroups: [],
  audienceItems: [item({ itemId: 'aud-1', placement: 'audience', lines: ['2STC 10:30'] })],
  generalMessages: [item({ itemId: 'gen-1', placement: 'day', lines: ['Ta med kalkulator'] })],
  reviewRequired: false,
}

describe('CanonicalSchoolDayContent — Shadow opt-in invariant (Del 18 G)', () => {
  it('UTEN renderItemReview: ingen review-kontroller, innhold vises read-only', () => {
    render(<CanonicalSchoolDayContent day={day} />)
    expect(screen.getByText('Forberedelsesdag')).toBeTruthy()
    expect(screen.getByText('Ta med kalkulator')).toBeTruthy()
    expect(screen.getByText('2STC 10:30')).toBeTruthy()
    expect(screen.queryByText('REVIEW-CTRL')).toBeNull()
  })

  it('MED renderItemReview: kontroll rendres per reviewbart item (subject + audience + general)', () => {
    render(
      <CanonicalSchoolDayContent
        day={day}
        renderItemReview={(it) => <span>{`REVIEW-CTRL:${it.itemId}`}</span>}
      />
    )
    expect(screen.getByText('REVIEW-CTRL:it-1')).toBeTruthy()
    expect(screen.getByText('REVIEW-CTRL:aud-1')).toBeTruthy()
    expect(screen.getByText('REVIEW-CTRL:gen-1')).toBeTruthy()
    // innhold fortsatt synlig
    expect(screen.getByText('Forberedelsesdag')).toBeTruthy()
  })
})
