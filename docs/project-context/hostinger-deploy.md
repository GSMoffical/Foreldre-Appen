# Hostinger deploy

Static-only deploy av Vite-build til Hostinger.

## Kjente fakta

- Host: `82.25.113.207` (port `65002`)
- Bruker: `u366744973`
- Domene-rot pa serveren:
  `/home/u366744973/domains/darkblue-beaver-826498.hostingersite.com/public_html`
- Live URL: `https://darkblue-beaver-826498.hostingersite.com/`
- Lokalt build-output: `dist/` (Vite default).

## Hva scriptet gjør

`scripts/deploy-hostinger.ps1`:

1. `npm run build` (kan skippes med `-SkipBuild`).
2. **Lokal sanity:** Leser `dist/index.html` og sjekker at alle `/assets/...`-referanser finnes pa disk under `dist/`.
3. **SSH preflight:** `mkdir -p <remote>`, deretter (default) `rm -rf <remote>/assets`, `mkdir -p <remote>/assets`, og `ls -la <remote>`. Med `-NoCleanRemoteAssets` kjores bare `mkdir -p <remote>/assets` (ingen sletting).
4. **Upload:**
   - **`-UsePasswordAuth`:** `scp` i batches (OpenSSH pa Windows handterer interaktivt passord her; `sftp -b` gjorde det ikke).
   - **SSH-nokkel (default):** `sftp -b` med batch (ikke-interaktivt).
   - Passord-modus: alle filer under `dist/assets/` (flat, rekursivt) kopieres til `<remote>/assets/` (ikke `assets/assets`). Rotfiler `index.html`, `favicon.svg`, `manifest.webmanifest` til `<remote>/`.
5. **Etter upload (SSH):** `chmod` (mapper 755, filer 644), `ls -la` pa `public_html` og `public_html/assets`, og feil hvis det ikke finnes minst en `index-*.js` og en `index-*.css` i `assets/`.
6. **HTTP-verify:** `scripts/verify-hostinger.ps1` (kan skippes med `-SkipVerify`). Leser **live** `/`, plukker ut alle `/assets/*.js` og `/assets/*.css`, sjekker HEAD (GET som fallback ved ikke-200), og feiler ved 404 eller feil content-type.

## Kommandoer

```powershell
# Bygg + deploy + auto-verify (passord + scp, anbefalt):
npm run deploy:hostinger:password

# Dry-run (ingen SSH/SCP, viser plan):
npm run deploy:hostinger:password:dry

# Bare verifisere live:
npm run verify:hostinger

# Valgfritt: inkluder ogsa /assets-URL-er fra lokal dist/index.html i HTTP-sjekk
# (nyttig hvis live fortsatt viser gammel index mens lokal er ny):
powershell -ExecutionPolicy Bypass -File ./scripts/verify-hostinger.ps1 -IncludeLocalIndexPaths
```

## Auth

- Uten `-UsePasswordAuth` forventes SSH-key i `%USERPROFILE%\.ssh\hostinger_ed25519_nopass`.
- Med `-UsePasswordAuth` prompter `ssh`/`scp` for passord. **Flere SCP-batcher** kan bety **flere passordprompter** (typisk en per batch a ~25 filer + en for rotfiler). Det er normal OpenSSH-oppforsel. Losning: bruk SSH-key (`ssh-copy-id` / legg inn public key i hPanel) for ett prompt eller ingen.

## Typiske feil

| Symptom | Arsak | Fiks |
|---|---|---|
| `Permission denied` pa `sftp -b` med passord | Batch-modus kan ikke svare pa passordprompt | Bruk `npm run deploy:hostinger:password` (scp-gren) |
| 404 pa `/assets/*.js` | Assets kom aldri opp (gammel glob-feil, feil mappe, etc.) | Kjor deploy pa nytt; sjekk `ls -la` i script-output |
| `assets/assets` | Unormal manuell opplasting | Preflight sletter `remote/assets` for du laster opp pa nytt |
| Verify: 200 men `text/html` for `.js` | SPA fallback / fil mangler | Sjekk remote `ls assets/` |

## Manuell sjekk

```powershell
curl.exe -sI "https://darkblue-beaver-826498.hostingersite.com/assets/<filnavn>.js"
```
