import type { ClassLocation } from '../types'
import { normalizeClassCode } from '../features/tankestrom/classHighlight'

/**
 * Per-klasse-lokasjon (klasse → rom → lærer) fra `metadata.classLocations` — primærkilden
 * for sted når analysen fant per-klasse-struktur (flat `location` er upålitelig fallback).
 *
 * Layout-hierarki: klassen(e) som matcher et familie-barn (via normalizeClassCode mot
 * relevanceProfile.school.classCode) vises ØVERST som full blokk (kode semibold, rom/lærer
 * på egen linje) — de dempede klassene komprimeres til ÉN flytende, kompakt blokk under
 * (liten tekst + opacity-60), der hver klasse er en inline-enhet «2STA · Rom 332-40 ·
 * Lærer …» adskilt med mellomrom (flex-gap). Når INGEN klasse matcher familien vises alle
 * i full størrelse uten demping — vi komprimerer ikke noe når det ikke er noe å fremheve.
 * «Rom »/«Lærer »-prefiks legges til her; serveren sender bar kode («332-40»).
 */
export function ClassLocationList({
  classLocations,
  familyClassCodes,
}: {
  classLocations: ClassLocation[]
  familyClassCodes: Set<string>
}) {
  if (classLocations.length === 0) return null
  const anyMatch = classLocations.some((c) => familyClassCodes.has(normalizeClassCode(c.classCode)))
  const detailFor = (c: ClassLocation) =>
    [c.room ? `Rom ${c.room}` : null, c.teacher ? `Lærer ${c.teacher}` : null].filter(Boolean).join(' · ')

  // Ingen familie-match → alle klasser i full størrelse, som-mottatt rekkefølge (uendret visning).
  if (!anyMatch) {
    return (
      <ul className="mt-1 space-y-1">
        {classLocations.map((c, idx) => {
          const detail = detailFor(c)
          return (
            <li key={`${c.classCode}-${idx}`}>
              <span className="text-body-sm text-synkaNavy/80">{c.classCode}</span>
              {detail ? <p className="mt-0.5 text-caption text-zinc-500">{detail}</p> : null}
            </li>
          )
        })}
      </ul>
    )
  }

  // Matchende ØVERST (full blokk, dominerer) — uavhengig av input-rekkefølge.
  const primary = classLocations.filter((c) => familyClassCodes.has(normalizeClassCode(c.classCode)))
  const demoted = classLocations.filter((c) => !familyClassCodes.has(normalizeClassCode(c.classCode)))

  return (
    <div className="mt-1">
      <ul className="space-y-1">
        {primary.map((c, idx) => {
          const detail = detailFor(c)
          return (
            <li key={`${c.classCode}-${idx}`}>
              <span className="text-body-sm font-semibold text-synkaNavy/80">{c.classCode}</span>
              {detail ? <p className="mt-0.5 text-caption text-zinc-500">{detail}</p> : null}
            </li>
          )
        })}
      </ul>
      {/* Dempede klasser flyter sammen kompakt: én enhet per klasse («2STA · Rom … · Lærer …»),
          « · » INNI enheten, flex-gap MELLOM enhetene (wrapper naturlig ved behov). */}
      {demoted.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-zinc-500 opacity-60">
          {demoted.map((c, idx) => {
            const detail = detailFor(c)
            return (
              <span key={`${c.classCode}-${idx}`}>
                {detail ? `${c.classCode} · ${detail}` : c.classCode}
              </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
