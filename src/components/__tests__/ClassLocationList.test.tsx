// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ClassLocationList } from '../ClassLocationList'

afterEach(cleanup)

const THREE = [
  { classCode: '2STA', room: '332-40', teacher: 'Andreas Vågen' },
  { classCode: '2STC', room: '332-50', teacher: 'Marte Hermanrud' },
  { classCode: '2STE', room: '332-60' },
]

describe('ClassLocationList', () => {
  it('matchende klasse dominerer (full blokk øverst, semibold); dempede komprimert i én liten flyt-blokk — ALLE synlige', () => {
    render(<ClassLocationList classLocations={THREE} familyClassCodes={new Set(['2stc'])} />)
    // Matchende: full blokk — kode semibold i full størrelse, rom/lærer på egen linje:
    const code = screen.getByText('2STC')
    expect(code.className).toContain('font-semibold')
    expect(code.className).toContain('text-body-sm')
    expect(screen.getByText('Rom 332-50 · Lærer Marte Hermanrud').className).toContain('text-caption')
    // Dempede: én enhet per klasse («kode · Rom … · Lærer …»), i felles kompakt blokk:
    const unitA = screen.getByText('2STA · Rom 332-40 · Lærer Andreas Vågen')
    const unitE = screen.getByText('2STE · Rom 332-60')
    const flow = unitA.parentElement!
    expect(unitE.parentElement).toBe(flow) // samme flyt-blokk
    expect(flow.className).toContain('text-[10px]')
    expect(flow.className).toContain('opacity-60')
    expect(flow.className).toContain('flex-wrap')
  })

  it('matchende vises ØVERST selv når den ikke er først i input-rekkefølgen', () => {
    const { container } = render(
      <ClassLocationList classLocations={THREE} familyClassCodes={new Set(['2ste'])} />
    )
    // 2STE (matchende, sist i input) skal komme før de dempede enhetene i DOM-en:
    const text = container.textContent ?? ''
    expect(text.indexOf('2STE')).toBeLessThan(text.indexOf('2STA'))
    expect(screen.getByText('2STE').className).toContain('font-semibold')
  })

  it('INGEN match → alle i full størrelse, egne blokker, ingen demping/komprimering', () => {
    render(<ClassLocationList classLocations={THREE} familyClassCodes={new Set(['9z'])} />)
    for (const code of ['2STA', '2STC', '2STE']) {
      expect(screen.getByText(code).className).toContain('text-body-sm')
      expect(screen.getByText(code).className).not.toContain('font-semibold')
    }
    // Detalj-linjer separate og normal størrelse (ikke flettet inn i én enhet):
    expect(screen.getByText('Rom 332-40 · Lærer Andreas Vågen').className).toContain('text-caption')
    expect(document.querySelector('.opacity-60')).toBeNull()
    expect(document.querySelector('[class*="text-\\[10px\\]"]')).toBeNull()
  })

  it('«Rom »/«Lærer »-prefiks i begge visninger (bar kode «332-40» fra serveren)', () => {
    render(<ClassLocationList classLocations={THREE} familyClassCodes={new Set(['2stc'])} />)
    expect(screen.getByText('Rom 332-50 · Lærer Marte Hermanrud')).toBeTruthy() // matchende
    expect(screen.getByText('2STA · Rom 332-40 · Lærer Andreas Vågen')).toBeTruthy() // dempet enhet
  })

  it('flerbarns: ALLE matchende som fulle blokker øverst; resten komprimert', () => {
    render(<ClassLocationList classLocations={THREE} familyClassCodes={new Set(['2stc', '2sta'])} />)
    expect(screen.getByText('2STA').className).toContain('font-semibold')
    expect(screen.getByText('2STC').className).toContain('font-semibold')
    expect(screen.getByText('2STE · Rom 332-60').parentElement!.className).toContain('opacity-60')
  })

  it('normalisering: familie-kode «2 STC» matcher server «2STC»', () => {
    render(
      <ClassLocationList
        classLocations={[{ classCode: '2STC', room: '1' }]}
        familyClassCodes={new Set(['2stc'])}
      />
    )
    expect(screen.getByText('2STC').className).toContain('font-semibold')
  })

  it('tom liste → null', () => {
    const { container } = render(<ClassLocationList classLocations={[]} familyClassCodes={new Set()} />)
    expect(container.innerHTML).toBe('')
  })
})
