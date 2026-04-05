import { describe, expect, it } from 'vitest'
import { generateInviteToken } from '../inviteToken'

describe('generateInviteToken', () => {
  it('returns URL-safe token with sufficient entropy length', () => {
    const token = generateInviteToken()
    expect(token.length).toBeGreaterThanOrEqual(32)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('generates different tokens across multiple calls', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateInviteToken()))
    expect(tokens.size).toBe(200)
  })
})

