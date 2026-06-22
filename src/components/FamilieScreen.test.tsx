// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Person } from '../types'

// Delte mocks/data (vi.hoisted så de er tilgjengelige i de hoisted vi.mock-fabrikkene).
const h = vi.hoisted(() => ({
  updatePerson: vi.fn(async (_id: string, _updates: unknown) => undefined),
  addPerson: vi.fn(async (_person: unknown) => ({ id: 'new' })),
  removePerson: vi.fn(async (_id: string) => undefined),
  people: [
    {
      id: 'c1',
      name: 'Emma',
      memberKind: 'child',
      colorTint: '#dcfce7',
      colorAccent: '#22c55e',
      relevanceProfile: {
        school: { classCode: '2STC' },
        activities: [{ name: 'Kor' }, { name: 'Fotball' }],
      },
    },
    {
      id: 'c2',
      name: 'Noah',
      memberKind: 'child',
      colorTint: '#dbeafe',
      colorAccent: '#3b82f6',
    },
  ] as Person[],
}))

vi.mock('../context/FamilyContext', () => ({
  useFamily: () => ({
    people: h.people,
    addPerson: h.addPerson,
    updatePerson: h.updatePerson,
    removePerson: h.removePerson,
  }),
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../context/EffectiveUserIdContext', () => ({
  useEffectiveUserId: () => ({ effectiveUserId: 'u1', isLinked: false }),
}))
vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canManageFamilyMembers: true,
    canEditFamilyMember: () => true,
    selfFamilyMemberId: null,
  }),
}))
vi.mock('../lib/inviteApi', () => ({
  buildInviteUrl: () => '',
  getOrCreateInviteForTarget: vi.fn(async () => null),
}))

// Gjør framer-motion synkron i test: ingen animasjoner, AnimatePresence = passthrough.
vi.mock('framer-motion', async () => {
  const React = await import('react')
  const FRAMER_ONLY = new Set([
    'initial', 'animate', 'exit', 'variants', 'custom', 'transition', 'whileTap', 'whileHover',
    'whileFocus', 'whileInView', 'layout', 'layoutId', 'drag', 'onDragEnd', 'mode',
  ])
  const strip = (props: Record<string, unknown>) => {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(props)) if (!FRAMER_ONLY.has(k)) out[k] = props[k]
    return out
  }
  // Cache komponent per tag — ellers gir Proxy en ny funksjon hver render, og React
  // remounter subtreet (mister fokus midt i tasting).
  const cache: Record<string, (props: Record<string, unknown>) => unknown> = {}
  const motion = new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        if (!cache[tag]) {
          cache[tag] = (props: Record<string, unknown>) => React.createElement(tag, strip(props))
        }
        return cache[tag]
      },
    }
  )
  return {
    motion,
    AnimatePresence: (props: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, props.children),
    useReducedMotion: () => true,
  }
})

import { FamilieScreen } from './FamilieScreen'

beforeEach(() => {
  h.updatePerson.mockClear()
  h.addPerson.mockClear()
})
afterEach(() => cleanup())

describe('FamilieScreen — relevansprofil', () => {
  it('viser oppsummering for barn med profil og tomtilstand for barn uten', () => {
    render(<FamilieScreen onBack={() => undefined} />)
    expect(screen.getByText(/Klasse: 2STC/)).toBeTruthy()
    expect(screen.getByText(/Aktiviteter: Kor, Fotball/)).toBeTruthy()
    expect(screen.getByText('Relevansprofil ikke satt opp')).toBeTruthy()
  })

  it('viser eksisterende relevansprofil (skole/klasse/aktiviteter) når man redigerer et barn', async () => {
    const user = userEvent.setup()
    render(<FamilieScreen onBack={() => undefined} />)

    // Rediger Emma (første barn) → Steg 1 (Grunninfo) → Neste → Steg 2 (Relevans).
    await user.click(screen.getAllByRole('button', { name: 'Rediger' })[0]!)
    await user.click(screen.getByRole('button', { name: 'Neste' }))

    expect(screen.getByText('Skole og aktiviteter')).toBeTruthy()
    expect(screen.getByDisplayValue('2STC')).toBeTruthy()
    expect(screen.getByDisplayValue('Kor')).toBeTruthy()
    expect(screen.getByDisplayValue('Fotball')).toBeTruthy()
  })

  it('lar deg fylle ut klasse + aktivitet og inkluderer relevanceProfile i save-payload', async () => {
    const user = userEvent.setup()
    render(<FamilieScreen onBack={() => undefined} />)

    // Rediger Noah (andre barn — ingen relevansprofil ennå).
    await user.click(screen.getAllByRole('button', { name: 'Rediger' })[1]!)
    await user.click(screen.getByRole('button', { name: 'Neste' })) // → Steg 2 (Relevans)

    await user.type(screen.getByPlaceholderText('f.eks. 2STC'), '3STA')
    await user.click(screen.getByRole('button', { name: 'Legg til aktivitet' }))
    await user.type(screen.getByPlaceholderText('f.eks. Kor'), 'Speider')

    await user.click(screen.getByRole('button', { name: 'Neste' })) // → Steg 3 (Timeplan)
    await user.click(screen.getByRole('button', { name: 'Fullfør' }))

    const call = h.updatePerson.mock.calls.find((c) => c[0] === 'c2')
    expect(call).toBeTruthy()
    const updates = call![1] as { relevanceProfile?: NonNullable<Person['relevanceProfile']> }
    expect(updates.relevanceProfile?.school?.classCode).toBe('3STA')
    expect(updates.relevanceProfile?.activities?.map((a) => a.name)).toEqual(['Speider'])
  })
})
