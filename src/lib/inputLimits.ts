/**
 * Maximum input lengths for all user-facing fields.
 * These are enforced both in the HTML (maxLength attribute)
 * and should be checked before any API call.
 *
 * Keep in sync with any server-side limits if added later.
 */

export const INPUT_LIMITS = {
  // Calendar events
  EVENT_TITLE: 200,
  EVENT_LOCATION: 200,
  EVENT_NOTES: 2000,

  // Tasks
  TASK_TITLE: 200,
  TASK_NOTES: 2000,

  // Family members and profiles
  PERSON_NAME: 100,
  DISPLAY_NAME: 100,
  FAMILY_NAME: 100,

  // Auth
  EMAIL: 254,       // RFC 5321 maximum
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
} as const
