// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimelineGrid } from './TimelineGrid'
import type { Task } from '../types'

describe('TimelineGrid task chip', () => {
  afterEach(() => {
    cleanup()
  })

  it('calls onSelectTask when deadline chip is clicked', async () => {
    const user = userEvent.setup()
    const onSelectTask = vi.fn()
    const task: Task = {
      id: 't1',
      title: 'Lever inn skjema',
      date: '2026-05-06',
      dueTime: '14:30',
    }
    render(
      <TimelineGrid
        layoutItems={[]}
        backgroundLayoutItems={[]}
        gaps={[]}
        showCurrentTime={false}
        selectedDate="2026-05-06"
        onSelectEvent={vi.fn()}
        dayTasks={[task]}
        onSelectTask={onSelectTask}
      />
    )
    await user.click(screen.getByRole('button', { name: /åpne gjøremål: lever inn skjema/i }))
    expect(onSelectTask).toHaveBeenCalledWith(task)
  })
})
