# Kumite/OS installer — Windows.
# Usage:  iwr -useb https://kumiteos.vercel.app/install.ps1 | iex
#
# Resolves x64 Windows, downloads the matching zip from the cloud
# redirect, extracts to %LOCALAPPDATA%\kumiteos\app\, launches the
# binary, and opens http://localhost:4747 in the default browser.
# Tournament state lives at %LOCALAPPDATA%\kumiteos\data — re-running
# the installer only replaces the binary + web assets.

$ErrorActionPreference = "Stop"

$Cloud       = if ($env:KUMITEOS_CLOUD) { $env:KUMITEOS_CLOUD } else { "https://kumiteos.vercel.app" }
$InstallRoot = Join-Path $env:LOCALAPPDATA "kumiteos"
$AppDir      = Join-Path $InstallRoot "app"
$Target      = "win-x64"

# Sanity-check arch.
if ($env:PROCESSOR_ARCHITECTURE -notin @("AMD64","x86_64")) {
  Write-Error "Unsupported architecture: $($env:PROCESSOR_ARCHITECTURE). Open $Cloud/download for manual options."
  exit 1
}

Write-Host "==> Installing kumiteos ($Target) -> $AppDir"
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null

$Tmp = New-Item -ItemType Directory -Path (Join-Path $env:TEMP "kumiteos-$(Get-Random)")
$Zip = Join-Path $Tmp "kumiteos.zip"

Write-Host "==> Downloading from $Cloud/api/downloads/$Target"
try {
  Invoke-WebRequest -UseBasicParsing -Uri "$Cloud/api/downloads/$Target" -OutFile $Zip
} catch {
  Write-Error "Download failed: $_. The release might not be published yet — check $Cloud/download."
  exit 1
}

Write-Host "==> Extracting"
Expand-Archive -Path $Zip -DestinationPath $Tmp -Force
$Extracted = Get-ChildItem -Path $Tmp -Directory | Where-Object { $_.Name -like "kumiteos-*" } | Select-Object -First 1
if (-not $Extracted) {
  Write-Error "Unexpected zip layout. Aborting."
  exit 1
}

# Replace binary + web. Data lives outside $AppDir.
Get-ChildItem -Path $AppDir -Force | Where-Object { $_.Name -in @("kumiteos.exe","web","version.json") } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path (Join-Path $Extracted.FullName "*") -Destination $AppDir -Recurse -Force
Remove-Item -Recurse -Force $Tmp

# Make sure $AppDir is on the user-scope PATH so `kumiteos` works
# from any new PowerShell or cmd window. Idempotent: only writes if
# the directory isn't already in the user PATH.
$User = [Environment]::GetEnvironmentVariable("PATH", "User")
if (-not $User) { $User = "" }
$entries = $User -split ";" | Where-Object { $_ -ne "" }
if (-not ($entries -contains $AppDir)) {
  $next = ($entries + @($AppDir)) -join ";"
  [Environment]::SetEnvironmentVariable("PATH", $next, "User")
  Write-Host "==> Added $AppDir to your user PATH (open a new PowerShell)."
}
# Also extend the current session so `kumiteos` works immediately.
$env:PATH = "$($env:PATH);$AppDir"

# Refuse to double-launch.
$busy = Get-NetTCPConnection -LocalPort 4747 -ErrorAction SilentlyContinue
if ($busy) {
  Write-Host "==> Port 4747 already in use — looks like kumiteos is already running."
  Write-Host "    Open http://localhost:4747 in your browser."
  exit 0
}

Write-Host "==> Launching"
$env:KARATE_CLOUD_URL = $Cloud
Start-Process -FilePath (Join-Path $AppDir "kumiteos.exe") `
  -WorkingDirectory $InstallRoot `
  -RedirectStandardOutput (Join-Path $InstallRoot "kumiteos.log") `
  -RedirectStandardError  (Join-Path $InstallRoot "kumiteos.err") `
  -WindowStyle Hidden
Start-Sleep -Seconds 1

Start-Process "http://localhost:4747"

@"

==> kumiteos is running.
    Web UI:    http://localhost:4747
    Logs:      $InstallRoot\kumiteos.log
    Data dir:  $InstallRoot\data
    Binary:    $AppDir\kumiteos.exe

Paste your 6-digit access code in the lock screen.
LAN guests can open  http://<this-machine-ip>:4747  in their browsers.

Useful commands (from any new PowerShell):
    kumiteos          launch the server again
    kumiteos update   pull the latest version

NOTE: If SmartScreen blocked the first launch, click "More info" -> "Run anyway".
"@ | Write-Host
