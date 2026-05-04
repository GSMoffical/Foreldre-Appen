import { describe, expect, it } from 'vitest'
import {
  buildTankestromImportFailureUserMessage,
  buildTankestromTaskPersistPayloadFingerprint,
  classifyTankestromPersistThrownError,
} from '../tankestromImportPersistDiagnostics'

describe('tankestromImportPersistDiagnostics', () => {
  it('klassifiserer nettverksfeil', () => {
    const r = classifyTankestromPersistThrownError(new Error('Failed to fetch'), 'createEvent')
    expect(r.kind).toBe('network')
  })

  it('bygger brukermelding med treff på flere feiltyper', () => {
    const msg = buildTankestromImportFailureUserMessage(
      [
        {
          proposalId: 'a',
          proposalSurfaceType: 'event',
          operation: 'createEvent',
          kind: 'network',
          message: 'fetch',
        },
        {
          proposalId: 'b',
          proposalSurfaceType: 'task',
          operation: 'createTask',
          kind: 'task_create_failed',
          message: 'x',
          taskPersistContext: {
            title: 'Levere samtykkeskjema',
            date: '2026-05-10',
            taskIntent: 'must_do',
            childPersonId: null,
            assignedToPersonId: null,
          },
        },
      ],
      8
    )
    expect(msg).toContain('2 av 8')
    expect(msg).toMatch(/oppgave\(r\).*hendelse/i)
    expect(msg).toContain('Levere samtykkeskjema')
    expect(msg.toLowerCase()).toMatch(/nettverk|tilkobling/)
  })

  it('grupperer flere oppgave-feil etter type med titteleksempler', () => {
    const msg = buildTankestromImportFailureUserMessage(
      [
        {
          proposalId: 't1',
          proposalSurfaceType: 'task',
          operation: 'createTask',
          kind: 'validation',
          message: 'constraint',
          taskPersistContext: {
            title: 'A',
            date: '2026-06-01',
            taskIntent: 'must_do',
            childPersonId: 'c1',
            assignedToPersonId: null,
          },
        },
        {
          proposalId: 't2',
          proposalSurfaceType: 'task',
          operation: 'createTask',
          kind: 'validation',
          message: 'constraint',
          taskPersistContext: {
            title: 'B',
            date: '2026-06-02',
            taskIntent: 'can_help',
            childPersonId: null,
            assignedToPersonId: null,
          },
        },
      ],
      5
    )
    expect(msg).toContain('2 av 5')
    expect(msg.toLowerCase()).toMatch(/ugyldig|dato|klokkeslett|felt/)
    expect(msg).toContain('«A»')
    expect(msg).toContain('«B»')
  })

  it('bygger stabil payload-fingerprint for oppgaver', () => {
    const fp = buildTankestromTaskPersistPayloadFingerprint({
      title: 'X',
      date: '2026-01-15',
      taskIntent: 'must_do',
      childPersonId: 'p1',
    })
    expect(fp).toContain('d=2026-01-15')
    expect(fp).toContain('tl=1')
    expect(fp).toContain('i=must_do')
    expect(fp).toContain('c=p1')
  })

  it('nevner manglende mål ved oppdatering', () => {
    const msg = buildTankestromImportFailureUserMessage(
      [
        {
          proposalId: 'c',
          proposalSurfaceType: 'event',
          operation: 'editEventPrecheck',
          kind: 'event_update_target_missing',
          message: 'missing',
        },
      ],
      4
    )
    expect(msg).toContain('1 av 4')
    expect(msg.toLowerCase()).toMatch(/ikke funnet/)
  })
})
