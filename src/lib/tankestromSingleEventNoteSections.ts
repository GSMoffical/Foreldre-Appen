/**
 * Lett UI-parsing av fritekst-notater for ENKELTHENDELSER i Tankestrøm-previewen.
 *
 * Flerdagers-/cup-analyse legger ofte praktisk info som én rå notatlinje, f.eks.
 *   «Viktig for hele perioden: Møtested: kiosken …; NYT-TK-2STC»
 * For én enkelthendelse blir dette flatt og lite lesbart. Denne funksjonen trekker ut
 * møtested, gruppe-/klassekode («Gjelder») og praktisk info, og lar resten stå som notater.
 *
 * Ren presentasjon: endrer IKKE draft/persist (jobber på toppen av eksisterende notes-streng),
 * og brukes KUN for enkelthendelse-preview — cup/flerdagers har egen strukturert metadata.
 */

export type SingleEventNoteSections = {
  /** Møtested/oppmøtested trukket ut fra «Møtested: …». */
  meetingPlace?: string
  /** Praktisk info: innhold under «Viktig for hele perioden:»/«Praktisk:» som ikke er møtested/kode. */
  practical: string[]
  /** Gruppe-/klassekoder, f.eks. «NYT-TK-2STC». */
  appliesTo: string[]
  /** Resterende fritekst som ikke passer bedre i en annen seksjon. */
  notes: string[]
}

// «Viktig for hele perioden:» er en teknisk wrapper fra flerdagers-analyse som ikke gir mening
// for én enkelthendelse. Strip label-en; innholdet rutes til beste seksjon (krav: ikke vis ordrett).
const PRACTICAL_WRAPPER_RE = /^(?:viktig for hele perioden|praktisk info|praktisk)\s*:\s*(.*)$/i
// «Møtested: …» / «Sted: …» / «Oppmøtested: …» osv. Ankret til start av segmentet.
const MEETING_PLACE_RE =
  /^(?:møtested|møteplass|oppmøtested|oppmøtessted|oppmøte\s*sted|oppmøte|sted)\s*:\s*(.+)$/i
// Gruppe-/klassekode: store bokstaver/tall med minst én bindestrek, f.eks. «NYT-TK-2STC».
// Konservativ (krever bindestrek) for å ikke fange vanlige ord/setninger.
const GROUP_CODE_RE = /^[A-ZÆØÅ0-9]{2,}(?:-[A-ZÆØÅ0-9]+)+$/

export function parseSingleEventNoteSections(rawNotes: string[]): SingleEventNoteSections {
  const out: SingleEventNoteSections = { practical: [], appliesTo: [], notes: [] }
  for (const raw of rawNotes) {
    let line = (raw ?? '').trim()
    if (!line) continue
    let practicalContext = false
    const wrap = PRACTICAL_WRAPPER_RE.exec(line)
    if (wrap) {
      practicalContext = true
      line = (wrap[1] ?? '').trim()
      if (!line) continue
    }
    // Del på «;» og linjeskift — IKKE komma (adresser/stedsnavn kan inneholde komma).
    const segments = line
      .split(/[;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    for (const seg of segments) {
      const mp = MEETING_PLACE_RE.exec(seg)
      if (mp) {
        const val = mp[1]!.trim()
        if (!out.meetingPlace) out.meetingPlace = val
        else out.notes.push(seg) // ekstra møtested → behold som notat (mister ikke info)
        continue
      }
      if (GROUP_CODE_RE.test(seg)) {
        if (!out.appliesTo.includes(seg)) out.appliesTo.push(seg)
        continue
      }
      if (practicalContext) out.practical.push(seg)
      else out.notes.push(seg)
    }
  }
  return out
}
