const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Commander Spellbook keeps the community-maintained infinite-combo database.
// Rather than hand-curating combo lists for power/bracket estimation, we keep
// a slim local index of their public /variants/ feed:
//
//   - boot: load the disk snapshot instantly (combo-index.json, gitignored)
//   - if the snapshot is missing or older than MAX_AGE_MS: refresh in the
//     background by paginating the API (100 variants per page, politely spaced)
//   - refresh also re-runs daily; any failure keeps the existing index
//
// Consumers read synchronously via peekComboIndex() — null until first load,
// so callers (deckAnalysis) fall back to the curated table during the gap.
// Unit tests can inject an index with __setTestIndex() for determinism.

const INDEX_PATH = path.join(__dirname, '..', 'combo-index.json');
const PAGE_URL = 'https://backend.commanderspellbook.com/variants/?limit=100';
const PAGE_DELAY_MS = 1000;     // ~1 page/sec — the feed 429s on bursts
const PAGE_JITTER_MS = 400;
const MAX_429_RETRIES = 20;     // per refresh, with capped backoff waits
const REQUEST_TIMEOUT_MS = 30000;
const MAX_PAGES = 3000;         // safety valve (~300k variants)
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let index = null;      // [{ id, cards: [display names] }] — only combos with >= 2 distinct cards
let indexLoadedAt = 0; // epoch ms of when the current index was refreshed
let snapshotComplete = false; // true once a refresh has paginated to the end
let resumeUrl = null;  // next page URL of an incomplete snapshot (for resuming)
let refreshing = false;
let refreshTimer = null;

// Reduce a fat API variant to the slim shape we store: distinct card names.
// Returns null for degenerate entries (fewer than 2 distinct cards).
function slimVariant(variant) {
  const sources = variant.uses || variant.cards || [];
  const seen = new Set();
  const cards = [];
  for (const use of sources) {
    const name =
      (use && use.card && use.card.name) ||
      (use && use.name) ||
      (typeof use === 'string' ? use : null);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push(name);
  }
  return cards.length >= 2 ? { id: variant.id, cards } : null;
}

// Synchronous peek for callers that must not await (estimatePowerLevel).
// Returns the index array or null when nothing has loaded yet.
function peekComboIndex() {
  return index;
}

function getLoadedAt() {
  return indexLoadedAt;
}

// Returns true when a snapshot was loaded from disk.
function loadFromDisk() {
  try {
    const parsed = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    if (Array.isArray(parsed.index) && parsed.index.length > 0) {
      index = parsed.index;
      indexLoadedAt = parsed.savedAt || 0;
      snapshotComplete = !!parsed.complete;
      resumeUrl = parsed.complete ? null : (parsed.nextUrl || PAGE_URL);
      return true;
    }
  } catch (err) {
    // Missing or corrupt snapshot — the refresh path rebuilds it.
  }
  return false;
}

function saveSnapshot() {
  fs.writeFileSync(
    INDEX_PATH,
    JSON.stringify({
      savedAt: indexLoadedAt,
      complete: snapshotComplete,
      nextUrl: resumeUrl,
      count: index.length,
      index,
    })
  );
}

const backoffMs = (attempt, retryAfterHeader) => {
  const headerSeconds = Number(retryAfterHeader);
  // Retry-After is seconds per HTTP spec; cap every path at 2 minutes.
  if (Number.isFinite(headerSeconds) && headerSeconds > 0) {
    return Math.min(headerSeconds * 1000, 120000);
  }
  return Math.min(30000 * 2 ** attempt, 120000); // 30s, 60s, 120s, capped
};

// Paginated fetch of the variants feed, keeping only the slim shape.
// Long-running by design (~450+ pages at ~1/sec) — always called in the
// background. Rate-limit aware: backs off on 429 and, if still blocked,
// persists the partial snapshot + next page URL so the NEXT attempt resumes
// where it stopped instead of restarting (the feed has no bulk export).
async function refresh() {
  if (refreshing) return;
  refreshing = true;

  // If nothing is in memory yet (direct refresh() calls, e.g. a one-off
  // script), load the on-disk snapshot first: it feeds the "only save when
  // better than what we have" guard and carries resume state for partial
  // snapshots — a failing refresh must never overwrite a fuller snapshot
  // with a thinner one.
  if (index === null) loadFromDisk();

  // Resume an incomplete snapshot; start clean when refreshing a complete one.
  let collected = [];
  let url = PAGE_URL;
  if (!snapshotComplete && index && index.length > 0 && resumeUrl) {
    collected = [...index];
    url = resumeUrl;
    console.log(`[comboDatabase] resuming refresh at ${collected.length} combos`);
  }
  const startingCount = index ? index.length : 0;
  let pages = 0;
  let rateLimitRetries = 0;

  try {
    while (url && pages < MAX_PAGES) {
      try {
        const response = await axios.get(url, {
          timeout: REQUEST_TIMEOUT_MS,
          headers: { Accept: 'application/json' },
        });
        const results = response.data.results || [];
        for (const variant of results) {
          const slim = slimVariant(variant);
          if (slim) collected.push(slim);
        }
        url = response.data.next || null;
        pages += 1;
        if (pages % 50 === 0) {
          console.log(`[comboDatabase] progress: ${collected.length} combos (page ${pages})`);
        }
        if (url) {
          await delay(PAGE_DELAY_MS + Math.floor(Math.random() * PAGE_JITTER_MS));
        }
      } catch (err) {
        const status = err.response && err.response.status;
        if (status === 429 && rateLimitRetries < MAX_429_RETRIES) {
          const wait = backoffMs(rateLimitRetries, err.response.headers && err.response.headers['retry-after']);
          rateLimitRetries += 1;
          console.warn(
            `[comboDatabase] rate limited, backing off ${Math.round(wait / 1000)}s ` +
            `(attempt ${rateLimitRetries}/${MAX_429_RETRIES}, at ${collected.length} combos)`
          );
          await delay(wait);
          continue; // retry the same page
        }
        throw err;
      }
    }

    if (collected.length === 0) throw new Error('feed returned no variants');

    // Finished (or hit MAX_PAGES): snapshot is complete.
    snapshotComplete = !url;
    resumeUrl = url;
    index = collected;
    indexLoadedAt = Date.now();
    saveSnapshot();
    console.log(
      `[comboDatabase] refresh ${snapshotComplete ? 'complete' : 'partial'}: ` +
      `${collected.length} combos across ${pages} pages (${INDEX_PATH})`
    );
  } catch (err) {
    console.error('[comboDatabase] refresh failed (keeping best-so-far index):', err.message);
    // Persist progress so the next attempt resumes instead of restarting.
    if (collected.length > startingCount) {
      snapshotComplete = false;
      resumeUrl = url;
      index = collected;
      indexLoadedAt = Date.now();
      try {
        saveSnapshot();
        console.log(`[comboDatabase] saved partial snapshot: ${collected.length} combos`);
      } catch (saveErr) {
        console.error('[comboDatabase] failed to save partial snapshot:', saveErr.message);
      }
    }
  } finally {
    refreshing = false;
  }
}

// Called once from server startup: instant snapshot load, background refresh
// when stale/missing, plus a daily refresh timer (unref'd so it never keeps
// the process alive on its own).
function prime() {
  const loaded = loadFromDisk();
  const age = loaded ? Date.now() - indexLoadedAt : Infinity;
  if (loaded) {
    console.log(
      `[comboDatabase] loaded ${index.length} combos from snapshot ` +
      `(${snapshotComplete ? 'complete' : 'partial'}, age ${Math.round(age / 3600000)}h)`
    );
  }
  // Stale OR partial snapshots both trigger a (resumable) background refresh.
  if (age > MAX_AGE_MS || !snapshotComplete) {
    refresh(); // fire-and-forget background refresh
  }
  if (!refreshTimer) {
    refreshTimer = setInterval(refresh, REFRESH_INTERVAL_MS);
    if (refreshTimer.unref) refreshTimer.unref();
  }
}

// Test hook: inject/replace the in-memory index; returns a cleanup function.
function __setTestIndex(testIndex) {
  index = testIndex;
  indexLoadedAt = Date.now();
  return () => {
    index = null;
    indexLoadedAt = 0;
  };
}

module.exports = {
  peekComboIndex,
  getLoadedAt,
  loadFromDisk,
  refresh,
  prime,
  slimVariant,
  __setTestIndex,
};
