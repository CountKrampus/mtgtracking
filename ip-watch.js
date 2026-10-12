// MTG Tracker - ISP IP change watchdog (Windows scheduled task payload)
//
// Since mtgtracker.store's A record points at this connection's dynamic IP
// (156.34.81.236 as of setup), an ISP reassignment silently breaks the site.
// This script:
//   1. Reads the current public IP (ipify).
//   2. Reads the IP the domain currently resolves to.
//   3. If they differ (and the public IP looks valid), updates the A record
//      via Namecheap's DDNS API - IF you have created a Dynamic DNS password
//      in the Namecheap panel and saved it to %USERPROFILE%\.mtg-ip-watch
//      as:  DDNS_PASSWORD=<your dynamic dns password>
//   4. Otherwise, warns via a popup/notification and writes a log line.
//
// Log: %PROJECT_DIR%\ip-watch.log
// Requires: Windows PowerShell 5+ and Node.js (already installed).

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DOMAIN = 'mtgtracker.store';
const HOST = '@';                   // root record; use 'www' for www subdomain
const PROJECT_DIR = __dirname;
const LOG = path.join(PROJECT_DIR, 'ip-watch.log');
const CRED_FILE = path.join(process.env.USERPROFILE || '', '.mtg-ip-watch');

const log = (msg) => {
  try { fs.appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`); } catch (e) {}
};

// Namecheap DDNS requires whitelisting the calling IP - which is circular,
// so enable "Dynamic DNS for <ip>"-free mode: their API accepts ANY source IP
// when the password is set? In practice Namecheap whitelists automatically for
// DDNS calls made with the correct password from any IP once DDNS is enabled.
function namecheapUpdate(password, currentIp) {
  const url = `https://dynamicdns.park-your-domain.com/update?host=${HOST}&domain=${DOMAIN}&password=${encodeURIComponent(password)}&ip=${currentIp}`;
  // Namecheap returns HTTP 200 even on auth failure - success is signaled by
  // <ErrCount>0</ErrCount> in the XML body, not the status code.
  const r = spawnSync('powershell', ['-Command',
    `$Response = Invoke-WebRequest -Uri '${url}' -UseBasicParsing -TimeoutSec 20; $Body = $Response.Content; if ($Body -match '<ErrCount>\\s*0\\s*</ErrCount>') { 'DDNS_OK' } else { $Err = [regex]::Match($Body, '<Err1>(.*?)</Err1>').Groups[1].Value; Write-Error "Namecheap DDNS error: $Err"; exit 1 }`],
    { encoding: 'utf8', timeout: 30000 });
  if (r.status === 0 && r.stdout.trim() === 'DDNS_OK') return true;
  log(`Namecheap DDNS rejected update: ${(r.stderr || '').trim() || 'unknown error'}`);
  return false;
}

function notify(title, msg) {
  try {
    execSync(`powershell -Command "New-BurntToastNotification -Text '${title}','${msg}'" 2>nul`, { timeout: 10000 });
  } catch {
    // BurntToast not installed -> fall back to a message box
    try {
      execSync(`powershell -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${msg}','${title}')"`,
        { timeout: 600000, stdio: 'ignore' }); // blocking popup
    } catch (e) { log('notify fallback failed: ' + e.message); }
  }
}

(async () => {
  // current public IP
  let publicIp;
  try {
    publicIp = execSync('powershell -Command "(Invoke-RestMethod -Uri \'https://api.ipify.org?format=json\' -TimeoutSec 15).ip"',
      { encoding: 'utf8', timeout: 30000 }).trim();
  } catch (e) { log('ipify fetch failed: ' + e.message); process.exit(0); }

  // what the domain resolves to right now
  let dnsIp;
  try {
    dnsIp = execSync(`nslookup ${DOMAIN} 2>nul | findstr /R "Address.*[0-9]" | findstr /V "192.168 127.0"`,
      { encoding: 'utf8', shell: true }).match(/(\d+\.\d+\.\d+\.\d+)/)?.[1];
  } catch (e) { /* DNS down at all -> treat as drift */ }

  if (publicIp === dnsIp) {
    log(`OK ${DOMAIN}=${dnsIp} matches public ${publicIp}`);
    process.exit(0);
  }

  log(`DRIFT: public=${publicIp} dns=${dnsIp || '(unresolvable)'}`);

  // try auto-fix with Namecheap DDNS if a password is configured
  let creds = null;
  try {
    creds = Object.fromEntries(
      fs.readFileSync(CRED_FILE, 'utf8').split(/\r?\n/).map(l => [l.split('=')[0], l.split('=').slice(1).join('=')])
    );
  } catch { /* no creds file yet */ }

  if (creds?.DDNS_PASSWORD) {
    const ok = namecheapUpdate(creds.DDNS_PASSWORD, publicIp);
    if (ok) log(`FIXED: A record for ${DOMAIN} -> ${publicIp} via Namecheap DDNS`);
    else log('FIX FAILED: Namecheap DDNS update returned non-200 (check password / DDNS enabled)');
  } else {
    log('No DDNS password configured (create %USERPROFILE%\\.mtg-ip-watch with DDNS_PASSWORD=...); manual fix needed');
  }

  notify(
    'MTG Tracker: IP changed',
    `Your IP is now ${publicIp}` + (dnsIp ? ` but ${DOMAIN} still points to ${dnsIp}.` : ' and the domain does not resolve.') +
    ((creds?.DDNS_PASSWORD ? '' : ' DDNS password not configured - update the A record at Namecheap or add %USERPROFILE%\\.mtg-ip-watch.'))
  );
})();
