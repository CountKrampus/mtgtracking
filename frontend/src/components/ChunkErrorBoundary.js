import React from 'react';

class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Could log to remote error tracking here
    console.error('ChunkErrorBoundary caught error:', error, info);
  }

  handleReload = async () => {
    // Unregister service workers and clear caches to recover from stale-asset situations
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          try { await r.unregister(); } catch (e) { /* ignore */ }
        }
      }

      if (window.caches && window.caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) {
      console.warn('Error clearing service worker/caches during reload:', e);
    }

    // Hard reload the page to fetch fresh assets
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children || null;

    const message = this.state.error?.message || String(this.state.error);
    const isChunkLoadError = /Loading chunk|chunk failed|fetch|NetworkError|Unexpected token/i.test(message);

    return (
      <div className="p-6 bg-red-900 text-white rounded">
        <h2 className="text-lg font-semibold">Application load failed</h2>
        <p className="mt-2 text-sm text-white/90">{isChunkLoadError ? 'A code update was deployed and your browser has cached old files. A reload will fetch the latest version.' : 'An unexpected error occurred while loading this part of the app.'}</p>

        <div className="mt-4 flex gap-2">
          <button onClick={this.handleReload} className="px-3 py-1 bg-white text-black rounded">Reload and recover</button>
          <button onClick={() => window.location.href = '/'} className="px-3 py-1 border border-white text-white rounded">Go home</button>
        </div>

        <details className="mt-3 text-xs text-white/80">
          <summary>Technical details</summary>
          <pre className="whitespace-pre-wrap text-xs">{message}</pre>
        </details>
      </div>
    );
  }
}

export default ChunkErrorBoundary;
