// Minimal IndexedDB wrapper for offline collection caching. Uses the native
// indexedDB API directly (no dependency) since the whole cards array is
// cached as a single record — there's no need for per-card queries here,
// just "give me the last known-good snapshot to show while offline."
const DB_NAME = 'mtg-tracker-offline';
const DB_VERSION = 1;
const STORE_NAME = 'collection';
const CARDS_KEY = 'cards';

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCardsToCache(cards) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ cards, cachedAt: Date.now() }, CARDS_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    // Caching is best-effort — a failure here shouldn't break the app.
    console.warn('Failed to cache collection for offline use:', err.message);
  }
}

export async function getCachedCards() {
  try {
    const db = await openDb();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(CARDS_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result || null;
  } catch (err) {
    console.warn('Failed to read cached collection:', err.message);
    return null;
  }
}
