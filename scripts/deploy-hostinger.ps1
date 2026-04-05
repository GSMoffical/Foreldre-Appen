param(
  [string]$RemotePath = "~/public_html",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\hostinger_ed25519_nopass",
  [switch]$SkipBuild,
  [switch]$DryRun,
  [switch]$TestConnection,
  [switch]$UsePasswordAuth
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$HostName = "82.25.113.207"
$Port = 65002
$UserName = "u366744973"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$DistPath = Join-Path $ProjectRoot "dist"

Write-Host "Deploy target: $UserName@$HostName`:$RemotePath (port $Port)"
Write-Host "SSH key: $KeyPath"
Write-Host "Auth mode: $(if ($UsePasswordAuth) { 'password' } else { 'ssh-key' })"

function Invoke-SshWithOutput {
  param(
    [string[]]$SshArgs
  )

  $output = & ssh @SshArgs 2>&1
  $code = $LASTEXITCODE
  return @{
    Output = $output
    ExitCode = $code
  }
}

if (-not $SkipBuild) {
  Write-Host "Building app..."
  npm run build
}

if (-not (Test-Path $DistPath)) {
  throw "dist folder not found. Run build first."
}
if (-not $UsePasswordAuth -and -not (Test-Path $KeyPath)) {
  throw "SSH key not found at $KeyPath. Create key first and add its .pub to Hostinger."
}

$sshMkdirCmd = "mkdir -p '$RemotePath'"
$scpCmd = "scp -i `"$KeyPath`" -P $Port -r `"$DistPath\*`" $UserName@$HostName`:$RemotePath"
if ($UsePasswordAuth) {
  $scpCmd = "scp -P $Port -r `"$DistPath\*`" $UserName@$HostName`:$RemotePath"
}

if ($DryRun) {
  Write-Host "DRY RUN: would run SSH mkdir check first."
  if ($UsePasswordAuth) {
    Write-Host "DRY RUN: would run -> sftp -P $Port -b <tmp-batch> $UserName@$HostName"
  } else {
    Write-Host "DRY RUN: would run -> sftp -i `"$KeyPath`" -P $Port -b <tmp-batch> $UserName@$HostName"
  }
  exit 0
}

Write-Host "Connecting to server (you may be asked for SSH password)..."
$sshArgs = @(
  "-p", "$Port",
  "-o", "ConnectTimeout=12",
  "-o", "StrictHostKeyChecking=accept-new",
  "$UserName@$HostName",
  "$sshMkdirCmd"
)
if ($UsePasswordAuth) {
  $sshArgs = @(
    "-p", "$Port",
    "-o", "ConnectTimeout=12",
    "-o", "StrictHostKeyChecking=accept-new",
    "$UserName@$HostName",
    "$sshMkdirCmd"
  )
} else {
  $sshArgs = @(
    "-p", "$Port",
    "-o", "ConnectTimeout=12",
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "BatchMode=yes",
    "-i", "$KeyPath",
    "$UserName@$HostName",
    "$sshMkdirCmd"
  )
}
$sshResult = Invoke-SshWithOutput -SshArgs $sshArgs
if ($sshResult.ExitCode -ne 0) {
  Write-Host ""
  Write-Host "Raw SSH error output:" -ForegroundColor Yellow
  if ($sshResult.Output) {
    $sshResult.Output | ForEach-Object { Write-Host $_ }
  } else {
    Write-Host "(no stderr output from ssh)"
  }
  throw "SSH connection failed (exit code $($sshResult.ExitCode)). Check host, port, firewall, and credentials."
}

if ($TestConnection) {
  Write-Host "SSH connection test OK."
  exit 0
}

Write-Host "Uploading dist files in one SFTP session..."
$batchFile = [System.IO.Path]::GetTempFileName()
try {
  $localDist = $DistPath -replace '\\', '/'
  $batch = @(
    "mkdir $RemotePath",
    "cd $RemotePath",
    "put -r $localDist/*"
  ) -join "`n"
  Set-Content -Path $batchFile -Value $batch -Encoding ascii

  if ($UsePasswordAuth) {
    sftp -o StrictHostKeyChecking=accept-new -P $Port -b "$batchFile" "$UserName@$HostName"
  } else {
    sftp -o StrictHostKeyChecking=accept-new -o BatchMode=yes -i "$KeyPath" -P $Port -b "$batchFile" "$UserName@$HostName"
  }
  if ($LASTEXITCODE -ne 0) {
    throw "SFTP upload failed (exit code $LASTEXITCODE)."
  }
} finally {
  Remove-Item -Path $batchFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Done. Site files uploaded to $RemotePath"
