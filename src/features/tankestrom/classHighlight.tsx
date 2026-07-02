import { Fragment } from 'react'

/**
 * Frontend-port av tankestrommens klassekode-deteksjon (`school-class-schedule.ts` → `CLASS_CODE_RE`),
 * bevisst speilet slik at uthevingen i Tankestrøm-forslags-previewen kjenner igjen de samme VGS-kodene
 * (2STC, 1IMA, 3PBA …). KUN presentasjon: vi uthever barnets egen klasse og demper de andre i blandede
 * linjer — uten å fjerne noe.
 */
const CLASS_CODE_RE = /\b\d{1,2}\s?(?:st|im|yf|pb|el|hs|sf|mk|id|na|ss|rm|dh|ba|tip|ho)[a-f]\b/i
/** Klassekode + ev. umiddelbart etterfølgende klokkeslett ELLER tidsrom («-»/«–»), så både
 *  «2STB 10.00» og «2STA 13.10-13.40» dempes som ÉN enhet (før ble range-slutten stående plain). */
const CLASS_CODE_WITH_TIME_SRC =
  '\\b\\d{1,2}\\s?(?:st|im|yf|pb|el|hs|sf|mk|id|na|ss|rm|dh|ba|tip|ho)[a-f]\\b(?:\\s*\\d{1,2}[:.]\\d{2}(?:\\s*[–-]\\s*\\d{1,2}[:.]\\d{2})?)?'

function normalizeNorwegianLetters(input: string): string {
  return input.toLowerCase().replace(/å/g, 'a').replace(/ø/g, 'o').replace(/æ/g, 'e')
}

/**
 * Normaliser en klassekode for sammenligning: små bokstaver, å/ø/æ-fold, uten whitespace.
 * Eksportert som felles sannhetskilde — brukes også av classLocations-matchingen (isPrimary).
 */
export function normalizeClassCode(code: string): string {
  return normalizeNorwegianLetters(code).replace(/\s+/g, '')
}

export type ClassSegmentKind = 'plain' | 'own' | 'other'
export interface ClassSegment {
  text: string
  kind: ClassSegmentKind
}

/**
 * Samme normalisering som `notesPreviewSnippet` i TankestromImportDialog (uten 130-trunkeringen):
 * kollaps til én linje, dropp «Match debug:»-linjer og ledende «fra:».
 */
export function collapseNotesForDisplay(notes: string): string {
  let raw = notes.replace(/\r\n/g, '\n').trim()
  if (!raw) return ''
  let lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  lines = lines.filter((l) => !/^Match debug:/i.test(l))
  if (lines.length > 0 && /^fra:\s*/i.test(lines[0] ?? '')) lines = lines.slice(1)
  raw = lines.join('\n').trim()
  return raw.replace(/\s+/g, ' ').trim()
}

/**
 * Splitt en (kollapset) linje på klassekoder. Hvert kode-treff (+ ev. etterfølgende klokkeslett)
 * merkes `own` (matcher barnets klasse) eller `other`; tekst mellom er `plain`. Sammenslåing av
 * segmentenes tekst gir alltid input uendret (ingenting fjernes/legges til).
 */
export function segmentByClass(
  text: string,
  childClassCode: string | undefined,
): { segments: ClassSegment[]; hasClassCodes: boolean } {
  const child = childClassCode ? normalizeClassCode(childClassCode) : ''
  const segments: ClassSegment[] = []
  const re = new RegExp(CLASS_CODE_WITH_TIME_SRC, 'gi')
  let last = 0
  let hasClassCodes = false
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    hasClassCodes = true
    if (m.index > last) segments.push({ text: text.slice(last, m.index), kind: 'plain' })
    const lead = m[0].match(CLASS_CODE_RE)
    const code = lead ? normalizeClassCode(lead[0]) : ''
    segments.push({ text: m[0], kind: child && code === child ? 'own' : 'other' })
    last = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++ // defensiv mot tom-match-loop
  }
  if (last < text.length) segments.push({ text: text.slice(last), kind: 'plain' })
  return { segments, hasClassCodes }
}

/** Bindetekst mellom nabo-koder («2STA, 2STC og 2STE») — kun da koalesceres kodene til én gruppe. */
const CONNECTOR_ONLY_RE = /^(?:\s|,|&|\+|\/|\bog\b|\beller\b)*$/i

/**
 * Variant B — EKTE segment-demping (opt-in for notat-tekst; `segmentByClass` er uendret default):
 * hvert span går fra en klassekode til NESTE kode ELLER en setningsgrense, slik at «2STA Anette
 * og Andreas» dempes HELT (ikke bare koden).
 *
 * - Tekst før første kode er alltid plain.
 * - Setningsgrense-vakt: [.!?;] er kun grense når neste ikke-blanke tegn er STOR bokstav eller
 *   streng-slutt — så «13.10» (punktum+siffer) og «kl.»/«f.eks.» ikke deler spanet, mens
 *   «… Mari. Husk gymtøy» redder felles-halen som plain.
 * - Bindetekst-gruppering («barnets-klasse-også-nevnt»-regelen): nabo-koder med KUN bindetekst
 *   imellom (og/,/&/+/eller) koalesceres til én gruppe som er `own` hvis NOEN kode er barnets —
 *   så «2STA og 2STC møter i rom 12» og pulje-lister («2STA, 2STC og 2STE») aldri dempes for barnet.
 * - Invariant (som segmentByClass): segmentene slått sammen gir alltid input uendret.
 */
export function segmentByClassSpans(
  text: string,
  childClassCode: string | undefined,
): { segments: ClassSegment[]; hasClassCodes: boolean } {
  const child = childClassCode ? normalizeClassCode(childClassCode) : ''
  const codeRe = new RegExp(CLASS_CODE_RE.source, 'gi')
  const hits: Array<{ start: number; end: number; code: string }> = []
  let m: RegExpExecArray | null
  while ((m = codeRe.exec(text)) !== null) {
    hits.push({ start: m.index, end: m.index + m[0].length, code: normalizeClassCode(m[0]) })
    if (m[0].length === 0) codeRe.lastIndex++ // defensiv mot tom-match-loop
  }
  if (hits.length === 0) return { segments: [{ text, kind: 'plain' }], hasClassCodes: false }

  // Koalescér nabo-koder med ren bindetekst imellom til grupper.
  const groups: Array<{ start: number; end: number; codes: string[] }> = []
  let cur = { start: hits[0]!.start, end: hits[0]!.end, codes: [hits[0]!.code] }
  for (let i = 1; i < hits.length; i++) {
    const h = hits[i]!
    if (CONNECTOR_ONLY_RE.test(text.slice(cur.end, h.start))) {
      cur.end = h.end
      cur.codes.push(h.code)
    } else {
      groups.push(cur)
      cur = { start: h.start, end: h.end, codes: [h.code] }
    }
  }
  groups.push(cur)

  const segments: ClassSegment[] = []
  let last = 0
  for (let g = 0; g < groups.length; g++) {
    const grp = groups[g]!
    if (grp.start > last) segments.push({ text: text.slice(last, grp.start), kind: 'plain' })
    const limit = g + 1 < groups.length ? groups[g + 1]!.start : text.length
    // Span slutter ved neste gruppe ELLER første setningsterminator med stor bokstav/slutt etter.
    let spanEnd = limit
    for (let i = grp.end; i < limit; i++) {
      const ch = text[i]
      if (ch === '.' || ch === '!' || ch === '?' || ch === ';') {
        let j = i + 1
        while (j < text.length && /\s/.test(text[j]!)) j++
        if (j >= text.length || /[A-ZÆØÅ]/.test(text[j]!)) {
          spanEnd = i + 1
          break
        }
      }
    }
    const kind: ClassSegmentKind = child && grp.codes.includes(child) ? 'own' : 'other'
    segments.push({ text: text.slice(grp.start, spanEnd), kind })
    last = spanEnd
  }
  if (last < text.length) segments.push({ text: text.slice(last), kind: 'plain' })
  return { segments, hasClassCodes: true }
}

/** True når uthevingen skal slå inn: barn satt + linja har minst én klassekode. */
export function shouldHighlightClasses(text: string, childClassCode: string | undefined): boolean {
  if (!childClassCode?.trim()) return false
  return segmentByClass(collapseNotesForDisplay(text), childClassCode).hasClassCodes
}

/**
 * Velg ÉN classCode å uthev for, fra valgte personer («Hvem gjelder dette?») med fallback til
 * familien. Nøkles på classCode-TILSTEDEVÆRELSE (ikke member_kind) — kun barn har skole-classCode,
 * så «nøyaktig én med classCode» er robust mot member_kind-feilklassifisering.
 *
 * - Nøyaktig én distinkt classCode blant valgte → den.
 * - Flere distinkte blant valgte → undefined (gjetter ikke blant flere klasser).
 * - Ingen blant valgte → fallback: nøyaktig én distinkt classCode i hele familien → den, ellers undefined.
 */
export function deriveActiveChildClassCode(
  people: Array<{ id: string; classCode?: string }>,
  selectedIds: ReadonlySet<string>,
): string | undefined {
  const distinct = (list: Array<{ classCode?: string }>): string[] => [
    ...new Set(list.map((p) => p.classCode?.trim()).filter((c): c is string => !!c)),
  ]
  const selected = distinct(people.filter((p) => selectedIds.has(p.id)))
  if (selected.length === 1) return selected[0]
  if (selected.length > 1) return undefined
  const all = distinct(people)
  return all.length === 1 ? all[0] : undefined
}

/**
 * Rendrer notat-/oppsummerings-tekst med barnets egen klasse uthevet (fet) og andre klasser dempet.
 * No-op — rendrer `fallback` uendret — når barnets classCode mangler eller linja ikke har klassekoder,
 * slik at ikke-skole-forslag ser identiske ut som før.
 */
export function ClassHighlightedText({
  text,
  fallback,
  childClassCode,
  mode = 'tokens',
}: {
  text: string
  fallback: string
  childClassCode: string | undefined
  /** 'tokens' (default, uendret) = kun koden(+tid) markeres; 'spans' = HELE klasse-segmentet
   *  dempes (variant B) — opt-in for notat-tekst, ikke korte labels. */
  mode?: 'tokens' | 'spans'
}) {
  const child = childClassCode?.trim()
  if (!child) return <>{fallback}</>
  const segmenter = mode === 'spans' ? segmentByClassSpans : segmentByClass
  const { segments, hasClassCodes } = segmenter(collapseNotesForDisplay(text), child)
  if (!hasClassCodes) return <>{fallback}</>
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === 'own') {
          return (
            <strong key={i} className="font-semibold">
              {seg.text}
            </strong>
          )
        }
        if (seg.kind === 'other') {
          return (
            <span key={i} className="opacity-60">
              {seg.text}
            </span>
          )
        }
        return <Fragment key={i}>{seg.text}</Fragment>
      })}
    </>
  )
}
