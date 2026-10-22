// High-capacity browser persistence layer combining localStorage + IndexedDB
// Prevents QuotaExceededError crashes when storing multiple high-res carousel/product images

const DB_NAME = "nicoletta_studio_db";
const DB_VERSION = 1;
const STORE_NAME = "keyval";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbSet<T>(key: string, value: T): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        db.close();
        resolve(req.result !== undefined ? (req.result as T) : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export function safeSetLocalStorage(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`LocalStorage quota warning for "${key}", freeing space and using IndexedDB:`, err);
    try {
      // Remove legacy or non-critical keys first to free up the 5MB localStorage quota
      const removableKeys = [
        "nicoletta_sample_data_cleared_v1",
        "nicoletta_quotes",
        "nicoletta_testimonials",
        "nicoletta_announcements"
      ].filter((k) => k !== key);
      for (const rk of removableKeys) {
        localStorage.removeItem(rk);
      }
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}

export function safeParseLocal<T>(key: string, fallback: T, validator?: (val: any) => boolean): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (validator && !validator(parsed)) return fallback;
    return parsed as T;
  } catch (err) {
    console.warn(`Failed to parse localStorage key "${key}", using fallback:`, err);
    return fallback;
  }
}

export function persistKeyVal<T>(key: string, data: T): void {
  try {
    const serialized = JSON.stringify(data);
    safeSetLocalStorage(key, serialized);
  } catch {
    // Ignore serialization errors
  }
  void idbSet(key, data);
}
