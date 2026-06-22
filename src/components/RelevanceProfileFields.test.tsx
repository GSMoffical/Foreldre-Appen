// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RelevanceProfileFields } from './RelevanceProfileFields'
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
})
