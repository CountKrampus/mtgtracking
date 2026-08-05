// Minimal IndexedDB wrapper for offline collection caching. Uses the native
// indexedDB API directly (no dependency) since the whole cards array is
// cached as a single record — there's no need for per-card queries here,
// just "give me the last known-good snapshot to show while offline."
const DB_NAME = 'mtg-tracker-offline';
const DB_VERSION = 2;
const STORE_NAME = 'collection';
const QUEUE_STORE_NAME = 'queue';
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
      if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        db.createObjectStore(QUEUE_STORE_NAME, { keyPath: 'id' });
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

export async function saveRequestToQueue(request) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
      tx.objectStore(QUEUE_STORE_NAME).put({
        id: request.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...request,
        createdAt: request.createdAt || Date.now()
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Failed to queue offline request:', err.message);
  }
}

export async function getQueuedRequests() {
  try {
    const db = await openDb();
    const queued = await new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE_NAME, 'readonly');
      const request = tx.objectStore(QUEUE_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return queued;
  } catch (err) {
    console.warn('Failed to read queued requests:', err.message);
    return [];
  }
}

export async function removeQueuedRequest(id) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
      tx.objectStore(QUEUE_STORE_NAME).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Failed to remove queued request:', err.message);
  }
}
