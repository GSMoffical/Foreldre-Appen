import { describe, expect, it } from 'vitest'
import { isPostgrestTaskIntentColumnMissingError } from '../tasksApi'

describe('isPostgrestTaskIntentColumnMissingError', () => {
  it('matcher PGRST204 når meldingen nevner task_intent', () => {
    expect(
      isPostgrestTaskIntentColumnMissingError({
        code: 'PGRST204',
        message: "Could not find the 'task_intent' column of 'tasks' in the schema cache",
      })
    ).toBe(true)
  })

  it('matcher ikke andre PGRST204-feil', () => {
    expect(
      isPostgrestTaskIntentColumnMissingError({
        code: 'PGRST204',
        message: "Could not find the 'foo' column",
      })
    ).toBe(false)
  })

  it('matcher ikke andre koder', () => {
    expect(
      isPostgrestTaskIntentColumnMissingError({
        code: '23503',
        message: 'task_intent',
      })
    ).toBe(false)
  })
})
