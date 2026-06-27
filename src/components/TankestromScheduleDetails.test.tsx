// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TankestromScheduleDetails } from './TankestromScheduleDetails'

afterEach(() => cleanup())

const noteWithClasses = 'Bokinnlevering: 2STA 13.10, 2STC 10.30'

describe('TankestromScheduleDetails — klasse-utheving', () => {
  it('uthever barnets klasse og demper de andre når childClassCode er satt', () => {
    const { container } = render(
      <TankestromScheduleDetails
        useNormalizedInput
        highlights={[]}
        notes={[noteWithClasses]}
        childClassCode="2STC"
      />,
    )
    // Egen klasse → <strong> (font-semibold); andre klasser → dempet <span class="opacity-60">.
    const strong = container.querySelector('strong')
    expect(strong?.textContent).toContain('2STC')
    const dimmed = Array.from(container.querySelectorAll('span.opacity-60')).map((e) => e.textContent)
    expect(dimmed.join(' ')).toContain('2STA')
  })

  it('no-op uten childClassCode: ren tekst, ingen utheving', () => {
    const { container } = render(
      <TankestromScheduleDetails useNormalizedInput highlights={[]} notes={[noteWithClasses]} />,
    )
    expect(container.querySelector('strong')).toBeNull()
    expect(container.querySelector('span.opacity-60')).toBeNull()
    expect(screen.getByText(noteWithClasses)).toBeTruthy()
  })
})
