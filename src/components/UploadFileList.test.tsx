// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UploadFileList, type UploadFileChip } from './UploadFileList'

let createSpy: ReturnType<typeof vi.fn>
let revokeSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  let n = 0
  createSpy = vi.fn(() => `blob:mock/${++n}`)
  revokeSpy = vi.fn()
  // happy-dom-uavhengig: kontroller objectURL-livssyklusen i testen.
  ;(URL as unknown as { createObjectURL: unknown }).createObjectURL = createSpy
  ;(URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeSpy
})
afterEach(() => cleanup())

function chip(
  id: string,
  name: string,
  type: string,
  status: UploadFileChip['status'] = 'ready',
  statusDetail?: string,
): UploadFileChip {
  return { id, file: new File(['x'], name, { type }), status, statusDetail }
}

describe('UploadFileList', () => {
  it('rendrer chips med navn og status', () => {
    render(
      <UploadFileList
        files={[chip('1', 'man.png', 'image/png'), chip('2', 'plan.pdf', 'application/pdf', 'error', 'Ingen treff')]}
        onRemove={vi.fn()}
        onAnalyze={vi.fn()}
        analyzing={false}
      />,
    )
    expect(screen.getByText('man.png')).toBeTruthy()
    expect(screen.getByText('plan.pdf')).toBeTruthy()
    expect(screen.getByText('Klar')).toBeTruthy()
    expect(screen.getByText('Ingen treff')).toBeTruthy()
  })

  it('tom liste rendrer ingenting', () => {
    const { container } = render(
      <UploadFileList files={[]} onRemove={vi.fn()} onAnalyze={vi.fn()} analyzing={false} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('× kaller onRemove med fil-id', () => {
    const onRemove = vi.fn()
    render(
      <UploadFileList
        files={[chip('abc', 'man.png', 'image/png')]}
        onRemove={onRemove}
        onAnalyze={vi.fn()}
        analyzing={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Fjern man.png' }))
    expect(onRemove).toHaveBeenCalledWith('abc')
  })

  it('«Analyser» kaller onAnalyze; skjules med showAnalyzeButton=false', () => {
    const onAnalyze = vi.fn()
    const { rerender } = render(
      <UploadFileList
        files={[chip('1', 'a.png', 'image/png')]}
        onRemove={vi.fn()}
        onAnalyze={onAnalyze}
        analyzing={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Analyser' }))
    expect(onAnalyze).toHaveBeenCalledTimes(1)

    rerender(
      <UploadFileList
        files={[chip('1', 'a.png', 'image/png')]}
        onRemove={vi.fn()}
        onAnalyze={onAnalyze}
        analyzing={false}
        showAnalyzeButton={false}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Analyser' })).toBeNull()
  })

  it('analyzing disabler × og «Analyser»', () => {
    render(
      <UploadFileList
        files={[chip('1', 'a.png', 'image/png')]}
        onRemove={vi.fn()}
        onAnalyze={vi.fn()}
        analyzing
      />,
    )
    expect((screen.getByRole('button', { name: 'Fjern a.png' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Analyserer…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('bilde får objectURL-miniatyr, ikke-bilde får generisk ikon', () => {
    const { container } = render(
      <UploadFileList
        files={[chip('1', 'a.png', 'image/png'), chip('2', 'b.pdf', 'application/pdf')]}
        onRemove={vi.fn()}
        onAnalyze={vi.fn()}
        analyzing={false}
      />,
    )
    expect(createSpy).toHaveBeenCalledTimes(1) // kun bildet
    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBe(1)
    expect(imgs[0]!.getAttribute('src')).toMatch(/^blob:mock\//)
  })

  it('revoker objectURL når en fil fjernes og ved unmount', () => {
    const a = chip('1', 'a.png', 'image/png')
    const b = chip('2', 'b.png', 'image/png')
    const { rerender, unmount } = render(
      <UploadFileList files={[a, b]} onRemove={vi.fn()} onAnalyze={vi.fn()} analyzing={false} />,
    )
    expect(createSpy).toHaveBeenCalledTimes(2)

    rerender(<UploadFileList files={[a]} onRemove={vi.fn()} onAnalyze={vi.fn()} analyzing={false} />)
    expect(revokeSpy).toHaveBeenCalledTimes(1) // b revoket

    unmount()
    expect(revokeSpy).toHaveBeenCalledTimes(2) // a revoket ved unmount
  })
})
