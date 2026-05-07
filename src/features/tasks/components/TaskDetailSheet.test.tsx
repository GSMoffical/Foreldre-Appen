// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskDetailSheet } from './TaskDetailSheet'
import type { Task } from '../../../types'

vi.mock('../../../context/FamilyContext', () => ({
  useFamily: () => ({
    people: [
      { id: 'c1', name: 'Anna', memberKind: 'child' as const, colorTint: '#fff7ed', colorAccent: '#ea580c' },
      { id: 'p1', name: 'Per', memberKind: 'parent' as const, colorTint: '#f4f4f5', colorAccent: '#52525b' },
    ],
  }),
}))

const baseTask: Task = {
  id: 't1',
  title: 'Husk gymbag',
  date: '2026-05-06',
  notes: 'Fra Tankestrøm: husk sekken',
  dueTime: '08:00',
  childPersonId: 'c1',
  assignedToPersonId: 'p1',
  taskIntent: 'must_do',
}

describe('TaskDetailSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
  })

  it('shows notes and opens from dialog role', async () => {
    const onClose = vi.fn()
    render(
      <TaskDetailSheet
        task={baseTask}
        onClose={onClose}
        onEdit={vi.fn()}
        onMarkComplete={vi.fn()}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByRole('dialog', { name: /gjøremålsdetaljer/i })).toBeTruthy()
    expect(screen.getByText('Husk gymbag')).toBeTruthy()
    expect(screen.getByText(/Fra Tankestrøm/)).toBeTruthy()
  })

  it('Lukk calls onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <TaskDetailSheet
        task={baseTask}
        onClose={onClose}
        onEdit={vi.fn()}
        onMarkComplete={vi.fn()}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    const lukkButtons = screen.getAllByRole('button', { name: /^Lukk$/i })
    await user.click(lukkButtons[lukkButtons.length - 1]!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Marker som fullført calls onMarkComplete', async () => {
    const user = userEvent.setup()
    const onMarkComplete = vi.fn()
    render(
      <TaskDetailSheet
        task={baseTask}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onMarkComplete={onMarkComplete}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    const completeButtons = screen.getAllByRole('button', { name: /marker som fullført/i })
    await user.click(completeButtons[0]!)
    expect(onMarkComplete).toHaveBeenCalledWith(baseTask)
  })

  it('renders for task without due time or persons', () => {
    const minimal: Task = {
      id: 't2',
      title: 'Enkelt',
      date: '2026-05-06',
    }
    render(
      <TaskDetailSheet
        task={minimal}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onMarkComplete={vi.fn()}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('Enkelt')).toBeTruthy()
    expect(screen.getByText('Åpen')).toBeTruthy()
  })

  it('completed task shows Gjenåpne', async () => {
    const user = userEvent.setup()
    const onReopen = vi.fn()
    const done: Task = { ...baseTask, completedAt: new Date().toISOString() }
    render(
      <TaskDetailSheet
        task={done}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onMarkComplete={vi.fn()}
        onReopen={onReopen}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('Fullført')).toBeTruthy()
    const reopenButtons = screen.getAllByRole('button', { name: /gjenåpne/i })
    await user.click(reopenButtons[0]!)
    expect(onReopen).toHaveBeenCalledWith(done)
  })
})
