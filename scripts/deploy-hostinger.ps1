param(
  [string]$RemotePath = "/home/u366744973/domains/darkblue-beaver-826498.hostingersite.com/public_html",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\hostinger_ed25519_nopass",
  [string]$LiveUrl = "https://darkblue-beaver-826498.hostingersite.com",
  [switch]$SkipBuild,
  [switch]$DryRun,
  [switch]$TestConnection,
  [switch]$UsePasswordAuth,
  [switch]$NoCleanRemoteAssets,
  [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$HostName = "82.25.113.207"
$Port = 65002
$UserName = "u366744973"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$DistPath = Join-Path $ProjectRoot "dist"
$AssetsLocal = Join-Path $DistPath "assets"

$authLabel = if ($UsePasswordAuth) { "password (interactive) + scp upload" } else { "ssh-key + sftp batch ($KeyPath)" }
$cleanLabel = if ($NoCleanRemoteAssets) { "no" } else { "yes (rm -rf remote/assets, mkdir remote/assets)" }

Write-Host "Deploy target : $UserName@$HostName`:$RemotePath (port $Port)"
Write-Host "Auth mode     : $authLabel"
Write-Host "Live URL      : $LiveUrl"
Write-Host "Clean assets/ : $cleanLabel"

function New-SshArgList {
  param([string]$RemoteCommand = "")
  $argList = @(
    "-p", "$Port",
    "-o", "ConnectTimeout=12",
    "-o", "StrictHostKeyChecking=accept-new"
  )
  if (-not $UsePasswordAuth) {
    $argList += @("-o", "BatchMode=yes", "-i", "$KeyPath")
  }
  $argList += @("$UserName@$HostName")
  if ($RemoteCommand) { $argList += @($RemoteCommand) }
  return ,$argList
}

function New-SftpArgList {
  param([string]$BatchFile)
  $argList = @(
    "-o", "StrictHostKeyChecking=accept-new",
    "-P", "$Port"
  )
  if (-not $UsePasswordAuth) {
    $argList += @("-o", "BatchMode=yes", "-i", "$KeyPath")
  }
  $argList += @("-b", "$BatchFile", "$UserName@$HostName")
  return ,$argList
}

function New-ScpBaseArgs {
  $b = @(
    "-P", "$Port",
    "-o", "StrictHostKeyChecking=accept-new"
  )
  if (-not $UsePasswordAuth) {
    $b += @("-o", "BatchMode=yes", "-i", "$KeyPath")
  }
  return $b
}

function Test-DistIndexReferencesExist {
  param([string]$IndexPath, [string]$AssetsDirPath)
  $html = Get-Content -Raw -Path $IndexPath
  $rx = [regex]::new('(?:href|src)\s*=\s*"(/assets/[^"#?]+)"', 'IgnoreCase')
  $paths = @()
  foreach ($m in $rx.Matches($html)) {
    $paths += $m.Groups[1].Value
  }
  $paths = $paths | Sort-Object -Unique
  if ($paths.Count -eq 0) {
    throw "Local dist/index.html has no /assets/... references. Build output looks wrong."
  }
  $missing = New-Object System.Collections.Generic.List[string]
  foreach ($webPath in $paths) {
    $rel = $webPath.TrimStart('/').Replace('/', [char][IO.Path]::DirectorySeparatorChar)
    $local = Join-Path $DistPath $rel
    if (-not (Test-Path -LiteralPath $local)) {
      $missing.Add("$webPath -> expected at $local") | Out-Null
    }
  }
  if ($missing.Count -gt 0) {
    Write-Host "Missing files referenced by dist/index.html:" -ForegroundColor Red
    foreach ($m in $missing) { Write-Host "  $m" -ForegroundColor Red }
    throw "Local sanity check failed: $($missing.Count) referenced asset(s) missing under dist/."
  }
  Write-Host "      Local sanity: $($paths.Count) /assets/... path(s) in index.html all exist on disk."
}

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "[1/5] Building app (npm run build)"
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Build failed (exit code $LASTEXITCODE)." }
}

if (-not (Test-Path $DistPath)) {
  throw "dist/ folder not found at $DistPath. Run 'npm run build' first."
}
if (-not $UsePasswordAuth -and -not (Test-Path $KeyPath)) {
  throw "SSH key not found at $KeyPath. Either create the key and add its .pub to Hostinger, or pass -UsePasswordAuth."
}

$indexHtmlPath = Join-Path $DistPath "index.html"
if (-not (Test-Path $indexHtmlPath)) {
  throw "dist/index.html missing. Build looks incomplete."
}
if (-not (Test-Path $AssetsLocal)) {
  throw "dist/assets is missing. Run 'npm run build' again."
}

Write-Host ""
Write-Host "[2/5] Local sanity: dist/index.html vs dist/assets"
Test-DistIndexReferencesExist -IndexPath $indexHtmlPath -AssetsDirPath $AssetsLocal

# Same base64 trick for preflight: keeps all quoting on the PowerShell side and
# delivers a script-shaped command to bash without any active metacharacters
# on the wire.
$prepCleanLine = if ($NoCleanRemoteAssets) { "" } else { "rm -rf '__RP__/assets'`n" }
$prepScript = (@"
set -e
mkdir -p '__RP__'
${prepCleanLine}mkdir -p '__RP__/assets'
ls -la '__RP__'
"@ -replace "`r", '').Replace('__RP__', $RemotePath)

$prepBytes = [System.Text.Encoding]::UTF8.GetBytes($prepScript)
$prepB64 = [Convert]::ToBase64String($prepBytes)
$remotePrepCmd = "echo $prepB64 | base64 -d | bash"

Write-Host ""
Write-Host "[3/5] SSH preflight (mkdir, clean/recreate assets, list)"
foreach ($line in ($prepScript -split "`n")) {
  if ($line.Trim()) { Write-Host "      $line" }
}

if ($DryRun) {
  Write-Host "      DRY RUN: would run ssh with: $remotePrepCmd"
} else {
  $sshArgs = New-SshArgList -RemoteCommand $remotePrepCmd
  & ssh @sshArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Host "SSH preflight failed (exit code $LASTEXITCODE)." -ForegroundColor Yellow
    if (-not $UsePasswordAuth) {
      Write-Host "Tip: rerun with -UsePasswordAuth for interactive password + scp upload." -ForegroundColor Yellow
    }
    throw "SSH preflight failed (exit code $LASTEXITCODE)."
  }
}

if ($TestConnection) {
  Write-Host "SSH connection test OK."
  exit 0
}

$remoteAssetsUri = "${UserName}@${HostName}:${RemotePath}/assets/"
$remoteRootUri = "${UserName}@${HostName}:${RemotePath}/"

function Invoke-ScpFilesBatched {
  param(
    [string[]]$LocalPathsPosix,
    [string]$RemoteDestUri,
    [int]$BatchSize = 25
  )
  if ($LocalPathsPosix.Count -eq 0) { return }
  $scpBase = New-ScpBaseArgs
  for ($i = 0; $i -lt $LocalPathsPosix.Count; $i += $BatchSize) {
    $end = [Math]::Min($i + $BatchSize - 1, $LocalPathsPosix.Count - 1)
    $batch = @($LocalPathsPosix[$i..$end])
    Write-Host "      scp batch ($($batch.Count) file(s)) -> $RemoteDestUri"
    if ($DryRun) { continue }
    & scp @scpBase @batch $RemoteDestUri
    if ($LASTEXITCODE -ne 0) {
      throw "scp upload failed (exit code $LASTEXITCODE). Destination: $RemoteDestUri"
    }
  }
}

Write-Host ""
Write-Host "[4/5] Upload"

$assetFiles = Get-ChildItem -Path $AssetsLocal -Recurse -File | Sort-Object FullName
$assetPathsPosix = @($assetFiles | ForEach-Object { $_.FullName -replace '\\', '/' })
$rootNames = @("index.html", "favicon.svg", "manifest.webmanifest")
$rootLocalPaths = @()
foreach ($n in $rootNames) {
  $p = Join-Path $DistPath $n
  if (Test-Path -LiteralPath $p) {
    $rootLocalPaths += ($p -replace '\\', '/')
  }
}

if ($UsePasswordAuth) {
  Write-Host "      Mode: scp (password-friendly; you may be prompted once per scp batch)"
  Write-Host "      Upload $($assetPathsPosix.Count) file(s) under dist/assets -> $remoteAssetsUri"
  if ($DryRun) {
    Write-Host "      DRY RUN: would scp asset batches, then root files to $remoteRootUri"
  } else {
    Invoke-ScpFilesBatched -LocalPathsPosix $assetPathsPosix -RemoteDestUri $remoteAssetsUri
    if ($rootLocalPaths.Count -gt 0) {
      Write-Host "      scp root file(s) -> $remoteRootUri"
      $scpBase = New-ScpBaseArgs
      & scp @scpBase @rootLocalPaths $remoteRootUri
      if ($LASTEXITCODE -ne 0) {
        throw "scp root files failed (exit code $LASTEXITCODE)."
      }
    }
  }
} else {
  Write-Host "      Mode: sftp batch (non-interactive key auth)"
  $topLevelItems = Get-ChildItem -Path $DistPath -Force
  if (-not $topLevelItems) { throw "dist/ is empty. Nothing to upload." }

  $batchLines = New-Object System.Collections.Generic.List[string]
  $batchLines.Add("cd `"$RemotePath`"") | Out-Null
  foreach ($item in $topLevelItems) {
    $localFwd = $item.FullName -replace '\\', '/'
    if ($item.PSIsContainer) {
      $batchLines.Add("put -r `"$localFwd`"") | Out-Null
    } else {
      $batchLines.Add("put `"$localFwd`" `"$($item.Name)`"") | Out-Null
    }
  }
  $batchLines.Add("bye") | Out-Null
  Write-Host "      SFTP batch lines: $($batchLines.Count)"
  foreach ($line in $batchLines) { Write-Host "        $line" }

  if ($DryRun) {
    Write-Host "      DRY RUN: would run sftp with batch above."
  } else {
    $batchFile = [System.IO.Path]::GetTempFileName()
    $keepBatchFile = $false
    try {
      Set-Content -Path $batchFile -Value ($batchLines -join "`n") -Encoding ascii
      $sftpArgs = New-SftpArgList -BatchFile $batchFile
      & sftp @sftpArgs
      if ($LASTEXITCODE -ne 0) {
        $keepBatchFile = $true
        Write-Host "Batch file kept: $batchFile"
        throw "SFTP upload failed (exit code $LASTEXITCODE)."
      }
    } finally {
      if (-not $keepBatchFile -and (Test-Path $batchFile)) {
        Remove-Item -Path $batchFile -Force -ErrorAction SilentlyContinue
      }
    }
  }
}

# Why base64?
#
# PowerShell 5.x has a long-standing bug where double-quotes inside arguments
# passed to native executables (here: ssh) get stripped or mangled. We've seen
# both `(` parens triggering bash syntax errors and CRLF sneaking in from
# here-strings. To avoid all three layers of quoting (PowerShell -> Windows
# CreateProcess argv -> remote sshd shell), we encode the bash script as
# base64 and decode + execute it on the remote. The wire-side command becomes
# a single token of [A-Za-z0-9+/=], which has no shell metacharacters.
$bashScript = @'
set -e
echo "--- chmod public_html + assets ---"
find '__RP__/assets' -type d -exec chmod 755 {} \; 2>/dev/null || true
find '__RP__/assets' -type f -exec chmod 644 {} \; 2>/dev/null || true
chmod 755 '__RP__' '__RP__/assets' 2>/dev/null || true
[ -f '__RP__/index.html' ] && chmod 644 '__RP__/index.html' || true
[ -f '__RP__/favicon.svg' ] && chmod 644 '__RP__/favicon.svg' || true
[ -f '__RP__/manifest.webmanifest' ] && chmod 644 '__RP__/manifest.webmanifest' || true
echo "--- ls -la public_html ---"
ls -la '__RP__'
echo "--- ls -la public_html/assets ---"
ls -la '__RP__/assets'
echo "--- require index-*.js and index-*.css in assets ---"
js_n=$(ls -1 '__RP__/assets'/index-*.js 2>/dev/null | wc -l | tr -d ' ')
css_n=$(ls -1 '__RP__/assets'/index-*.css 2>/dev/null | wc -l | tr -d ' ')
if [ "$js_n" -lt 1 ] || [ "$css_n" -lt 1 ]; then
  printf '%s\n' "FAIL: expected at least one index-*.js and one index-*.css under assets (js=$js_n css=$css_n)" >&2
  exit 2
fi
printf '%s\n' "OK: remote assets contains index bundles (js=$js_n css=$css_n)"
'@
# Normalize to LF (Hostinger bash trips on stray CR) and inject the absolute path.
$bashScript = ($bashScript -replace "`r", '').Replace('__RP__', $RemotePath)

$bashBytes = [System.Text.Encoding]::UTF8.GetBytes($bashScript)
$bashB64 = [Convert]::ToBase64String($bashBytes)
$chmodAndInspect = "echo $bashB64 | base64 -d | bash"

Write-Host ""
Write-Host "[4b] Remote chmod + inspection"
Write-Host "      (base64-encoded bash script piped to remote bash)"

if ($DryRun) {
  Write-Host "      DRY RUN: would run ssh with: $chmodAndInspect"
  Write-Host "      Decoded bash script:"
  foreach ($line in ($bashScript -split "`n")) { Write-Host "        $line" }
} else {
  $sshArgs2 = New-SshArgList -RemoteCommand $chmodAndInspect
  & ssh @sshArgs2
  if ($LASTEXITCODE -ne 0) {
    throw "Remote chmod/inspection failed (exit code $LASTEXITCODE). Check listing above."
  }
}

if ($DryRun) {
  Write-Host ""
  Write-Host "DRY RUN complete. Exiting before HTTP verify."
  exit 0
}

Write-Host ""
Write-Host "      Upload + remote checks done."

if ($SkipVerify) {
  Write-Host "Skipping HTTP verify (-SkipVerify)."
  exit 0
}

$verifyScript = Join-Path $PSScriptRoot "verify-hostinger.ps1"
if (-not (Test-Path $verifyScript)) {
  Write-Warning "verify-hostinger.ps1 not found at $verifyScript - skipping."
  exit 0
}

Write-Host ""
Write-Host "[5/5] HTTP verify: $LiveUrl"
& powershell -NoProfile -ExecutionPolicy Bypass -File "$verifyScript" -LiveUrl "$LiveUrl" -DistPath "$DistPath"
if ($LASTEXITCODE -ne 0) {
  throw "Live verification failed (exit code $($LASTEXITCODE))."
}
