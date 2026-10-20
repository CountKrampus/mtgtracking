// Small bounded-concurrency map helper. Bulk price updates used to process
// one card per loop iteration (500ms sleep + network each), which made a
// full-collection refresh take many minutes. Running a handful of lookups in
// flight keeps us polite to the pricing sources while cutting wall-clock time
// to roughly 1/N.
//
// JS is single-threaded, so `nextIndex++` between awaits is race-free.
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const runnerCount = Math.max(1, Math.min(limit, items.length));

  const runners = Array.from({ length: runnerCount }, async () => {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await worker(items[i], i);
    }
  });

  await Promise.all(runners);
  return results;
}

// Shared start-rate limiter: serializes request *starts* with a minimum gap
// while responses still overlap. Combined with mapWithConcurrency this keeps
// outbound traffic steady (no bursts) without paying the full round-trip
// time per card.
function createStartRateLimiter(minIntervalMs) {
  let nextStart = 0;
  let chain = Promise.resolve();
  return () => {
    chain = chain.then(async () => {
      const now = Date.now();
      // nextStart is an absolute timestamp: 0 means "never started", so only
      // wait when a previous start has actually been scheduled.
      if (nextStart > now) {
        await new Promise((resolve) => setTimeout(resolve, nextStart - now));
      }
      // Re-anchor to the actual start time so sleeps can't drift the gap below
      // minIntervalMs (and so the first call ever proceeds immediately).
      nextStart = Date.now() + minIntervalMs;
    });
    return chain;
  };
}

module.exports = { mapWithConcurrency, createStartRateLimiter };
