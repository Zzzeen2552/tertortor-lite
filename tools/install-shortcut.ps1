# Creates the TERTORTOR shortcut on this user's Desktop (target: tools\tertortor.cmd, icon: tools\tertortor.ico).
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\install-shortcut.ps1
$root = Split-Path -Parent $PSScriptRoot
$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'TERTORTOR LITE.lnk'
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
# target cmd.exe (not the .cmd itself): Windows only offers "Pin to taskbar/Start" for shortcuts to an .exe
$s.TargetPath = $env:ComSpec
$s.Arguments = '/c "' + (Join-Path $root 'tools\tertortor.cmd') + '"'
$s.WorkingDirectory = $root
$s.IconLocation = (Join-Path $root 'tools\tertortor.ico') + ',0'
$s.WindowStyle = 7
$s.Description = 'Buka TERTORTOR LITE (Studio lokal 4331)'
$s.Save()
Write-Output "Shortcut: $lnk"
