import type { ClassLocation, Person } from '../types'
import { normalizeClassCode } from '../features/tankestrom/classHighlight'

/**
 * Les-tid-uttrekk av `metadata.classLocations` (speiler extractSchoolContext-mønsteret):
 * defensiv cast + form-validering, aldri throw. Server-kontrakt: `classCode` påkrevd
 * ikke-tom streng; `room`/`teacher` UTELATES når fraværende (aldri null) og beholdes kun
 * når de er strenger. Tom/ugyldig/fraværende → [] (så UI-et faller tilbake til flat location).
 */
export function extractClassLocations(metadata: unknown): ClassLocation[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  const raw = (metadata as { classLocations?: unknown }).classLocations
  if (!Array.isArray(raw)) return []
  const out: ClassLocation[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const e = entry as { classCode?: unknown; room?: unknown; teacher?: unknown }
    if (typeof e.classCode !== 'string' || !e.classCode.trim()) continue
    const loc: ClassLocation = { classCode: e.classCode.trim() }
    if (typeof e.room === 'string' && e.room.trim()) loc.room = e.room.trim()
    if (typeof e.teacher === 'string' && e.teacher.trim()) loc.teacher = e.teacher.trim()
    out.push(loc)
  }
  return out
}

/**
 * Alle familie-barns normaliserte klassekoder — driver isPrimary-utheving i
 * ClassLocationList (flerbarns: ALLE matchende klasser utheves, ikke bare én aktiv).
 * Samme normalisering som klassekode-uthevingen i flat tekst (normalizeClassCode).
 */
export function buildFamilyClassCodeSet(people: Person[]): Set<string> {
  return new Set(
    people
      .filter((p) => p.memberKind === 'child')
      .map((p) => p.relevanceProfile?.school?.classCode?.trim())
      .filter((c): c is string => Boolean(c))
      .map(normalizeClassCode)
  )
}
