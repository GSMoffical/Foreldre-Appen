import type { RelevanceProfile, RelevanceProfileActivity, RelevanceProfileSchool } from '../types'

/**
 * Normaliserer en (potensielt halvferdig) relevansprofil fra UI til en ryddig verdi som er trygg
 * å persistere: trimmer strenger, dropper tomme felter, og returnerer `undefined` når ingenting er
 * fylt ut (så vi ikke lagrer tomme objekter i `profile.relevance`).
 */
export function normalizeRelevanceProfile(
  input: RelevanceProfile | undefined
): RelevanceProfile | undefined {
  if (!input) return undefined
  const out: RelevanceProfile = {}

  const school = normalizeSchool(input.school)
  if (school) out.school = school

  const activities = (input.activities ?? [])
    .map(normalizeActivity)
    .filter((a): a is RelevanceProfileActivity => a != null)
  if (activities.length > 0) out.activities = activities

  return Object.keys(out).length > 0 ? out : undefined
}

function cleanAliases(aliases: string[] | undefined): string[] {
  if (!aliases) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of aliases) {
    // Tål kommaseparerte verdier i ett element (UI lagrer aliaser som kommaseparert tekst).
    for (const piece of (raw ?? '').split(',')) {
      const a = piece.trim()
      if (!a || seen.has(a.toLowerCase())) continue
      seen.add(a.toLowerCase())
      out.push(a)
    }
  }
  return out
}

function normalizeSchool(
  school: RelevanceProfileSchool | undefined
): RelevanceProfileSchool | undefined {
  if (!school) return undefined
  const out: RelevanceProfileSchool = {}
  const name = school.name?.trim()
  const classCode = school.classCode?.trim()
  const grade = school.grade?.trim()
  const aliases = cleanAliases(school.aliases)
  if (name) out.name = name
  if (classCode) out.classCode = classCode
  if (grade) out.grade = grade
  if (aliases.length > 0) out.aliases = aliases
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Kort oppsummering av en relevansprofil for visning i familieoversikten (f.eks.
 * «Klasse: 2STC · Aktiviteter: Kor, Fotball»). Returnerer `null` når profilen er tom,
 * slik at UI kan vise en tomtilstand i stedet.
 */
export function summarizeRelevanceProfile(profile: RelevanceProfile | undefined): string | null {
  const norm = normalizeRelevanceProfile(profile)
  if (!norm) return null
  const parts: string[] = []
  if (norm.school?.classCode) parts.push(`Klasse: ${norm.school.classCode}`)
  else if (norm.school?.grade) parts.push(`Trinn: ${norm.school.grade}`)
  if (norm.school?.name) parts.push(`Skole: ${norm.school.name}`)
  if (norm.activities && norm.activities.length > 0) {
    parts.push(`Aktiviteter: ${norm.activities.map((a) => a.name).join(', ')}`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

function normalizeActivity(
  activity: RelevanceProfileActivity | undefined
): RelevanceProfileActivity | null {
  if (!activity) return null
  const name = activity.name?.trim()
  if (!name) return null // navn er påkrevd for en aktivitet
  const out: RelevanceProfileActivity = { name }
  const type = activity.type?.trim()
  const groupName = activity.groupName?.trim()
  const aliases = cleanAliases(activity.aliases)
  if (type) out.type = type
  if (groupName) out.groupName = groupName
  if (aliases.length > 0) out.aliases = aliases
  return out
}
