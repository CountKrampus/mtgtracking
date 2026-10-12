# Enable DNS-over-HTTPS (DoH) on this PC
#
# Why: on this network, plain DNS (port 53) answers are being FORGED for some
# domains - facebook.com and kijiji.ca both get a fake sinkhole IP
# (18.204.152.241, HTTP 204, HTTPS refused) regardless of which server is
# queried. DoH runs inside TLS, so the forger cannot see or alter the answers.
#
# How to run: right-click this file -> "Run with PowerShell" (as administrator),
# or from an admin PowerShell:  powershell -ExecutionPolicy Bypass -File .\Enable-DNS-over-HTTPS.ps1

$ErrorActionPreference = 'Stop'

# 1. Require admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Administrator rights are required." -ForegroundColor Red
    Write-Host "Right-click this file -> Run with PowerShell, and choose 'Run as administrator' when prompted." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
}

# 2. Register Cloudflare and Google as DoH-capable resolvers (no plaintext fallback)
Write-Host "Registering DoH endpoints..." -ForegroundColor Cyan
Set-DnsClientDohServerAddress -ServerAddress '1.1.1.1' -DohTemplate 'https://cloudflare-dns.com/dns-query' -AllowFallbackToUdp $false -AutoUpgrade $true
Set-DnsClientDohServerAddress -ServerAddress '8.8.8.8' -DohTemplate 'https://dns.google/dns-query' -AllowFallbackToUdp $false -AutoUpgrade $true
Write-Host "  Cloudflare (1.1.1.1) and Google (8.8.8.8) registered for DoH." -ForegroundColor Green

# 3. Point the LAN adapter (the one holding this PC's LAN IP) at them
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -eq '192.168.2.115' } | Select-Object -First 1)
if (-not $lanIp) {
    Write-Host "Could not find the adapter holding 192.168.2.115 - aborting without changes." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}
$lanAlias = $lanIp.InterfaceAlias
Write-Host "Setting DNS on '$lanAlias' to 1.1.1.1 / 8.8.8.8 (DoH)..." -ForegroundColor Cyan
Set-DnsClientServerAddress -InterfaceAlias $lanAlias -ServerAddresses ('1.1.1.1', '8.8.8.8')

# 4. Flush stale caches (poisoned negative/positive entries)
Clear-DnsClientCache
Write-Host "DNS cache flushed." -ForegroundColor Green

# 5. Verify: facebook.com must now resolve to a REAL Meta IP (31.13.x / 157.240.x / 57.144.x), NOT 18.204.152.241
Write-Host "Verifying facebook.com resolution..." -ForegroundColor Cyan
$answer = (Resolve-DnsName facebook.com -Type A -ErrorAction Stop | Where-Object { $_.Type -eq 'A' }).IPAddress | Select-Object -First 1
Write-Host "  facebook.com -> $answer"
if ($answer -like '18.204.*') {
    Write-Host "STILL getting the forged answer - the DoH upgrade did not take effect yet. A reboot will force it." -ForegroundColor Red
} else {
    Write-Host "SUCCESS - real Meta IP. Facebook should load in your browser now." -ForegroundColor Green
}

Write-Host ""
Write-Host "Note: this fixes THIS PC. Other devices (phones/TVs) still use plain DNS" -ForegroundColor Yellow
Write-Host "through the router and can still be affected by the forged answers." -ForegroundColor Yellow
Read-Host "Press Enter to close"
