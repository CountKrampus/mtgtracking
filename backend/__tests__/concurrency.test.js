const { mapWithConcurrency, createStartRateLimiter } = require('../utils/concurrency');

describe('mapWithConcurrency', () => {
  test('processes all items and preserves input order in results', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = await mapWithConcurrency(items, 3, async (n) => n * 2);
    expect(results).toEqual(items.map((n) => n * 2));
  });

  test('never runs more than `limit` workers at once', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);

    await mapWithConcurrency(items, 4, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
    });

    expect(maxInFlight).toBeGreaterThan(1); // actually parallel
    expect(maxInFlight).toBeLessThanOrEqual(4); // but bounded
  });

  test('handles an empty item list', async () => {
    const results = await mapWithConcurrency([], 5, async () => 'x');
    expect(results).toEqual([]);
  });

  test('handles limit larger than item count', async () => {
    const results = await mapWithConcurrency([1, 2], 50, async (n) => n + 1);
    expect(results).toEqual([2, 3]);
  });

  test('a worker rejection propagates (callers must catch per item)', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      })
    ).rejects.toThrow('boom');
  });
});

describe('createStartRateLimiter', () => {
  test('spaces request starts by at least the minimum interval', async () => {
    const limitStart = createStartRateLimiter(40);
    const starts = [];

    await Promise.all(
      Array.from({ length: 4 }, async () => {
        await limitStart();
        starts.push(Date.now());
      })
    );

    starts.sort((a, b) => a - b);
    for (let i = 1; i < starts.length; i++) {
      // Timer precision can shave a ms or two; assert the spirit of the gap.
      expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(30);
    }
  });

  test('first call proceeds immediately', async () => {
    const limitStart = createStartRateLimiter(1000);
    const start = Date.now();
    await limitStart();
    expect(Date.now() - start).toBeLessThan(50);
  });
});
