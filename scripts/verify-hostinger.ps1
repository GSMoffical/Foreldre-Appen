param(
  [string]$LiveUrl = "https://darkblue-beaver-826498.hostingersite.com",
  [string]$DistPath = "",
  [switch]$IncludeLocalIndexPaths
)

$ErrorActionPreference = "Stop"

$base = $LiveUrl.TrimEnd('/')

$browserUa =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
$commonHeaders = @{
  'User-Agent' = $browserUa
  'Accept' = '*/*'
}

if (-not $DistPath) {
  $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  $projectRoot = Resolve-Path (Join-Path $scriptRoot "..")
  $DistPath = Join-Path $projectRoot "dist"
}

function Get-AssetJsCssFromHtml {
  param([string]$Html)
  $rx = [regex]::new('/assets/[^\s"''#?<>]+\.(?:js|css)\b', 'IgnoreCase')
  $out = New-Object System.Collections.Generic.List[string]
  foreach ($m in $rx.Matches($Html)) {
    $p = $m.Value
    if (-not $out.Contains($p)) { $out.Add($p) | Out-Null }
  }
  return ($out | Sort-Object)
}

function Get-OtherStaticFromHtml {
  param([string]$Html)
  $rx = [regex]::new('(?:href|src)\s*=\s*"(/(?:favicon\.svg|manifest\.webmanifest))"', 'IgnoreCase')
  $out = New-Object System.Collections.Generic.List[string]
  foreach ($m in $rx.Matches($Html)) {
    $p = $m.Groups[1].Value
    if (-not $out.Contains($p)) { $out.Add($p) | Out-Null }
  }
  return ($out | Sort-Object)
}

function Test-UrlOk {
  param([string]$Url, [string]$PathForTypeRules)
  $code = $null
  $ctype = ""
  $method = "Head"
  try {
    $h = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method Head -TimeoutSec 20 -Headers $commonHeaders
    $code = [int]$h.StatusCode
    $ctype = $h.Headers['Content-Type']
    if ($ctype -is [array]) { $ctype = $ctype[0] }
  } catch {
    $resp2 = $_.Exception.Response
    if ($resp2 -and $resp2.StatusCode) {
      $code = [int]$resp2.StatusCode
    } else {
      $code = -1
    }
  }

  if ($code -ne 200) {
    try {
      $g = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method Get -TimeoutSec 25 -Headers $commonHeaders
      $code = [int]$g.StatusCode
      $ctype = $g.Headers['Content-Type']
      if ($ctype -is [array]) { $ctype = $ctype[0] }
      $method = "Get(fallback)"
    } catch {
      $resp3 = $_.Exception.Response
      if ($resp3 -and $resp3.StatusCode) {
        $code = [int]$resp3.StatusCode
      } else {
        $code = -1
      }
      $method = "Get(fallback)"
    }
  }

  $ok = ($code -eq 200)
  if ($ok -and $ctype) {
    if ($PathForTypeRules -like '*.js' -and ($ctype -notmatch 'javascript')) { $ok = $false }
    elseif ($PathForTypeRules -like '*.css' -and ($ctype -notmatch 'css')) { $ok = $false }
  }

  return @{
    Ok = $ok
    Code = $code
    Ctype = $ctype
    Method = $method
  }
}

Write-Host "Fetching live $base/ ..."
try {
  $resp = Invoke-WebRequest -UseBasicParsing -Uri "$base/" -Method Get -TimeoutSec 25 -Headers $commonHeaders
} catch {
  throw "Failed to fetch $base/ - $($_.Exception.Message)"
}
if ($resp.StatusCode -ne 200) {
  throw "Live $base/ returned HTTP $($resp.StatusCode)."
}
$liveHtml = [string]$resp.Content

$liveJsCss = @(Get-AssetJsCssFromHtml -Html $liveHtml)
if ($liveJsCss.Count -eq 0) {
  throw "Live index.html has no /assets/*.js or /assets/*.css references. Nothing to verify."
}

$extra = @(Get-OtherStaticFromHtml -Html $liveHtml)
$toCheck = New-Object System.Collections.Generic.List[string]
foreach ($p in $liveJsCss) { $toCheck.Add($p) | Out-Null }
foreach ($p in $extra) {
  if (-not $toCheck.Contains($p)) { $toCheck.Add($p) | Out-Null }
}

if ($IncludeLocalIndexPaths) {
  $localIndex = Join-Path $DistPath "index.html"
  if (Test-Path $localIndex) {
    $localHtml = Get-Content -Raw -Path $localIndex
    foreach ($p in (Get-AssetJsCssFromHtml -Html $localHtml)) {
      if (-not $toCheck.Contains($p)) { $toCheck.Add($p) | Out-Null }
    }
  }
}

Write-Host ""
Write-Host "Live index references $($liveJsCss.Count) bundle URL(s) under /assets/:"
foreach ($p in $liveJsCss) { Write-Host "  $p" }
if ($extra.Count -gt 0) {
  Write-Host "Also checking static paths from live HTML:"
  foreach ($p in $extra) { Write-Host "  $p" }
}

Write-Host ""
Write-Host "HTTP checks against $base ..."
$bad = New-Object System.Collections.Generic.List[string]
foreach ($p in $toCheck) {
  $url = "$base$p"
  $r = Test-UrlOk -Url $url -PathForTypeRules $p
  $ct = if ($r.Ctype) { $r.Ctype } else { "-" }
  if ($r.Ok) {
    Write-Host ("  OK  {0,3}  {1,-8}  {2,-32}  {3}" -f $r.Code, $r.Method, $ct, $url)
  } else {
    Write-Host ("  BAD {0,3}  {1,-8}  {2,-32}  {3}" -f $r.Code, $r.Method, $ct, $url) -ForegroundColor Red
    $bad.Add("$($r.Code) $url") | Out-Null
  }
}

if ($bad.Count -gt 0) {
  Write-Host ""
  Write-Host "Verification FAILED: $($bad.Count) URL(s) not OK (404, wrong type, or unreachable)." -ForegroundColor Red
  foreach ($b in $bad) { Write-Host "  $b" -ForegroundColor Red }
  exit 1
}

Write-Host ""
Write-Host "Verification OK: live /assets bundles return 200 with expected content-type." -ForegroundColor Green
exit 0
