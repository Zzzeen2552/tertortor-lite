# autostart.ps1: keeps TERTORTOR reachable from the web without anyone typing a command (user 2026-11-09).
# Started at Windows login by "TERTORTOR.vbs" in the Startup folder (shell:startup), which runs this hidden.
# Every 30 s: Studio listening on 4331? if not, start it. tools/worker.mjs running? if not, start it.
# One watchdog at a time (named mutex). Logs: %LOCALAPPDATA%\TERTORTOR\.
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $env:LOCALAPPDATA "TERTORTOR"
New-Item -ItemType Directory -Force $logs | Out-Null
$mutex = New-Object System.Threading.Mutex($false, "Local\TERTORTOR-autostart")
if (-not $mutex.WaitOne(0)) { exit 0 }

function Note($m) { Add-Content (Join-Path $logs "autostart.log") ("{0:yyyy-MM-dd HH:mm:ss} {1}" -f (Get-Date), $m) }
function Start-Node($script, $name) {
  Start-Process -FilePath "node" -ArgumentList $script -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs "$name.log") -RedirectStandardError (Join-Path $logs "$name.err") | Out-Null
  Note "start $name"
}
function Running($pattern) {
  @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match $pattern }).Count -gt 0
}

Note "watchdog up ($root)"
while ($true) {
  if (-not (Get-NetTCPConnection -LocalPort 4331 -State Listen)) { Start-Node "tools/studio/server.mjs" "studio"; Start-Sleep 5 }
  if (-not (Running "tools[\\/]worker\.mjs")) { Start-Node "tools/worker.mjs" "worker" }
  Start-Sleep 30
}
