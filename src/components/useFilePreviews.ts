import { useEffect, useRef, useState } from 'react'

/**
 * Genererer objectURL-miniatyrer for bilde-filer (nøkkel = fil-id) og rydder opp etter seg:
 * `revokeObjectURL` når en fil fjernes OG for alle ved unmount — ellers lekker blob-URL-ene minne.
 * Ikke-bilde-filer får ingen URL (kalleren viser et generisk ikon i stedet).
 *
 * Brukes internt av {@link UploadFileList}, men ligger separat så objectURL-livssyklusen finnes
 * ett sted og er enkel å teste.
 */
export function useFilePreviews(files: Array<{ id: string; file: File }>): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const mapRef = useRef<Record<string, string>>({})

  // Stabil nøkkel: kjør effekten kun når id-settet faktisk endres, ikke ved hver nye array-identitet.
  const idKey = files.map((f) => f.id).join('|')

  useEffect(() => {
    const cur = mapRef.current
    const next: Record<string, string> = {}
    const present = new Set(files.map((f) => f.id))
    for (const { id, file } of files) {
      if (cur[id]) next[id] = cur[id]!
      else if (file.type.startsWith('image/')) next[id] = URL.createObjectURL(file)
    }
    // Revoke URL-er for filer som ikke lenger er i lista.
    for (const id of Object.keys(cur)) {
      if (!present.has(id)) URL.revokeObjectURL(cur[id]!)
    }
    mapRef.current = next
    setUrls(next)
    // idKey fanger relevante endringer; `files`-identiteten i seg selv skal ikke trigge effekten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey])

  // Revoke alt som gjenstår når komponenten forsvinner.
  useEffect(
    () => () => {
      for (const url of Object.values(mapRef.current)) URL.revokeObjectURL(url)
      mapRef.current = {}
    },
    [],
  )

  return urls
}
