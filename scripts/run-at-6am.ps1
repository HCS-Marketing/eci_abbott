# Waits until 6:00 AM then runs the ETL once.
# Usage: just double-click or run in a terminal you leave open overnight.

$target = (Get-Date).Date.AddHours(6)  # 6:00 AM today
if ((Get-Date) -ge $target) {
    $target = $target.AddDays(1)        # already past 6am — schedule for tomorrow
}

$wait = ($target - (Get-Date)).TotalSeconds
Write-Host "ETL scheduled for $target"
Write-Host "Waiting $([math]::Round($wait/3600, 1)) hours..."

Start-Sleep -Seconds $wait

Write-Host ""
Write-Host "=== Starting ETL at $(Get-Date) ==="
Set-Location "C:\Users\Usuario 1\Documents\abbott_eci"
node scripts\load-new-data.cjs both
Write-Host ""
Write-Host "=== ETL finished at $(Get-Date) ==="
