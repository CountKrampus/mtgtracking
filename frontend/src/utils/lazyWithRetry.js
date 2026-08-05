// Utility to lazy-load with retry on failure (helps transient network errors or slow CDNs)
import React from 'react';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function lazyWithRetry(factory, { retries = 2, retryDelay = 500 } = {}) {
  return React.lazy(() => {
    let attempt = 0;

    const load = () => factory().catch(async (err) => {
      attempt += 1;
      // If we've exhausted retries, re-throw the error so React can handle it
      if (attempt > retries) throw err;

      // For chunk load failures or network failures we retry after a short delay
      // Check message for common chunk-load patterns, but retry for any error
      await wait(retryDelay * attempt);
      return load();
    });

    return load();
  });
}
