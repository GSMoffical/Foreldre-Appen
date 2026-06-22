// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RelevanceProfileFields } from './RelevanceProfileFields'
import { normalizeRelevanceProfile } from '../lib/relevanceProfile'
import type { RelevanceProfile } from '../types'

afterEach(() => cleanup())

function Harness({ onValue }: { onValue: (v: RelevanceProfile | undefined) => void }) {
  const [value, setValue] = useState<RelevanceProfile | undefined>(undefined)
  return (
    <RelevanceProfileFields
      value={value}
      onChange={(v) => {
        setValue(v)
        onValue(v)
      }}
    />
  )
}

describe('RelevanceProfileFields', () => {
  it('viser eksisterende skole/klasse/trinn', () => {
    render(
      <RelevanceProfileFields
        value={{ school: { name: 'Nydalen skole', classCode: '2STC', grade: 'VG2' } }}
        onChange={() => undefined}
      />
    )
    expect(screen.getByDisplayValue('Nydalen skole')).toBeTruthy()
    expect(screen.getByDisplayValue('2STC')).toBeTruthy()
    expect(screen.getByDisplayValue('VG2')).toBeTruthy()
  })

  it('samler klasse-input i relevanceProfile.school.classCode via onChange', async () => {
    const seen: (RelevanceProfile | undefined)[] = []
    render(<Harness onValue={(v) => seen.push(v)} />)
    const user = userEvent.setup()

    await user.type(screen.getByPlaceholderText('f.eks. 2STC'), '2STC')

    // Kontrollert akkumulering: siste onChange har full klassekode, og inputen viser den.
    const last = seen[seen.length - 1]
    expect(last?.school?.classCode).toBe('2STC')
    expect(screen.getByDisplayValue('2STC')).toBeTruthy()
  })

  it('kan legge til en aktivitet og fylle inn navn, gruppe, type og aliaser', async () => {
    const seen: (RelevanceProfile | undefined)[] = []
    render(<Harness onValue={(v) => seen.push(v)} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Legg til aktivitet' }))
    await user.type(screen.getByPlaceholderText('f.eks. Kor'), 'Kor')
    await user.type(screen.getByPlaceholderText('f.eks. Nydalen J2015'), 'Barnekoret')
    await user.type(screen.getByPlaceholderText('f.eks. kor'), 'kor')
    await user.type(screen.getByPlaceholderText('f.eks. kor, barnekor, sang'), 'kor, barnekor')

    // Normaliser sluttilstanden (slik PersonForm gjør ved lagring).
    const normalized = normalizeRelevanceProfile(seen[seen.length - 1])
    expect(normalized?.activities).toEqual([
      { name: 'Kor', type: 'kor', groupName: 'Barnekoret', aliases: ['kor', 'barnekor'] },
    ])
  })

  it('kan fjerne en aktivitet', async () => {
    render(
      <Harness onValue={() => undefined} />
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Legg til aktivitet' }))
    expect(screen.getByPlaceholderText('f.eks. Kor')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Fjern' }))
    expect(screen.queryByPlaceholderText('f.eks. Kor')).toBeNull()
  })

  it('viser eksisterende aktivitet (navn, gruppe, type, aliaser)', () => {
    render(
      <RelevanceProfileFields
        value={{
          activities: [
            { name: 'Fotball', groupName: 'Nydalen J2015', type: 'fotball', aliases: ['j2015', 'kamp'] },
          ],
        }}
        onChange={() => undefined}
      />
    )
    expect(screen.getByDisplayValue('Fotball')).toBeTruthy()
    expect(screen.getByDisplayValue('Nydalen J2015')).toBeTruthy()
    expect(screen.getByDisplayValue('fotball')).toBeTruthy()
    expect(screen.getByDisplayValue('j2015,kamp')).toBeTruthy()
  })

  it('skole/klasse/trinn fungerer fortsatt når en aktivitet finnes', () => {
    render(
      <RelevanceProfileFields
        value={{
          school: { name: 'Nydalen skole', classCode: '2STC', grade: 'VG2' },
          activities: [{ name: 'Speider' }],
        }}
        onChange={() => undefined}
      />
    )
    expect(screen.getByDisplayValue('Nydalen skole')).toBeTruthy()
    expect(screen.getByDisplayValue('2STC')).toBeTruthy()
    expect(screen.getByDisplayValue('VG2')).toBeTruthy()
    expect(screen.getByDisplayValue('Speider')).toBeTruthy()
  })
})
