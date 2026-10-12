# Installs the mtg-tracker IP-change watchdog as an hourly scheduled task.
# Run once:  powershell -ExecutionPolicy Bypass -File ip-watch-install.ps1
$action  = New-ScheduledTaskAction -Execute 'node.exe' `
           -Argument '"D:\Card Tracker\mtg-tracker\ip-watch.js"'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName 'MTG Tracker IP Watch' -Action $action -Trigger $trigger -Settings $settings -Force
Write-Host "Installed. Runs hourly; log at D:\Card Tracker\mtg-tracker\ip-watch.log"
