# Launch Dropship Command for public access via a Cloudflare quick tunnel.
#
# Why PowerShell: a quick tunnel's URL changes every launch AND the tunnel hides
# the public hostname from the app, so NextAuth must be told its public origin
# via AUTH_URL or every redirect bounces to localhost. This script starts the
# tunnel first, reads the freshly-assigned URL from tunnel.log, then starts the
# app with AUTH_URL set to it — so login + redirects stay on the tunnel URL.

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
$log = Join-Path $PSScriptRoot "tunnel.log"
$cf  = Join-Path $PSScriptRoot "cloudflared.exe"
Remove-Item $log -ErrorAction SilentlyContinue

# Clean restart: stop any prior dropship app/worker/tunnel first so a re-launch
# (e.g. recovering a dropped tunnel) doesn't collide on :3000. The app must be
# restarted anyway because NextAuth needs AUTH_URL set to the NEW tunnel URL.
Write-Host "Clearing any previous dropship instance..."
Get-CimInstance Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*next*" -or $_.CommandLine -like "*workers/index*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-CimInstance Win32_Process -Filter "name='cloudflared.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*localhost:3000*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

Write-Host "Building the production app (the first launch is the slowest)..."
npm run build
if ($LASTEXITCODE -ne 0) { Read-Host "Build failed - see above. Press Enter to exit"; exit 1 }

# Start the tunnel first so we can learn the public URL it assigns.
Start-Process -FilePath $cf `
  -ArgumentList @("tunnel", "--url", "http://localhost:3000", "--logfile", $log) `
  -WindowStyle Minimized

Write-Host "Waiting for the tunnel URL..."
$url = $null
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value; break }
  }
}
if (-not $url) { Read-Host "Could not detect the tunnel URL - check tunnel.log. Press Enter to exit"; exit 1 }

# Tell NextAuth its public origin; child windows inherit this env var.
$env:AUTH_URL = $url

Write-Host ""
Write-Host "============================================================"
Write-Host "  Public URL:  $url"
Write-Host "  Log in with your owner email + password."
Write-Host "  (This URL changes each launch - it's also in tunnel.log.)"
Write-Host "============================================================"
Write-Host ""

Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "title Dropship app && npm run start"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "title Dropship worker && npm run worker"

Start-Sleep -Seconds 6
Start-Process $url   # open it in the default browser

Write-Host "App + worker + tunnel are running."
Read-Host "Press Enter here to STOP everything (app, worker, tunnel)"

Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object { $_.CommandLine -like "*next*" -or $_.CommandLine -like "*workers/index*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Stopped."
