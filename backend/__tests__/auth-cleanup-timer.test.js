// Guards the Jest hang fix.
//
// middleware/auth.js registers a module-level setInterval that sweeps the
// userRateLimit map. A *referenced* interval keeps the Node event loop alive
// on its own, so any Jest worker that imports this module (i.e. nearly every
// route test) never exits after the last test. The timer must be unref'd —
// then the process can finish even while the interval is still scheduled.
process.env.JWT_SECRET = 'test-secret';

describe('auth middleware module-level rate-limit cleanup timer', () => {
  test("is registered and unref'd so importing middleware/auth cannot hold the event loop open", () => {
    jest.resetModules();

    // Capture every interval created while the module (and its transitive
    // dependencies) loads.
    const captured = [];
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    global.setInterval = (fn, ms) => {
      const handle = originalSetInterval(fn, ms);
      captured.push(handle);
      return handle;
    };

    try {
      require('../middleware/auth');
    } finally {
      global.setInterval = originalSetInterval;
    }

    try {
      // The rate-limit sweeper must actually be registered at import time.
      expect(captured.length).toBeGreaterThanOrEqual(1);

      // None of the intervals created at import time may reference the event
      // loop: hasRef() === false means Node can exit without waiting for them,
      // which is exactly what stops the Jest worker from hanging.
      for (const handle of captured) {
        expect(typeof handle.hasRef).toBe('function');
        expect(handle.hasRef()).toBe(false);
      }
    } finally {
      // Don't leave stray timers scheduled for the rest of this test file.
      for (const handle of captured) {
        originalClearInterval(handle);
      }
    }
  });

  test('module imports cleanly and still exports the auth middleware surface', () => {
    jest.resetModules();
    const auth = require('../middleware/auth');
    expect(typeof auth.verifyToken).toBe('function');
    expect(typeof auth.requireAuth).toBe('function');
    expect(typeof auth.checkMaintenanceMode).toBe('function');
    expect(typeof auth.userRateLimit).toBe('function');
  });
});
