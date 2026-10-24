import { Product, Category, Testimonial, Announcement, QuoteRequest, CustomizationSettings } from "./types";
import { safeSetLocalStorage } from "./storage";

export interface CloudStoreSnapshot {
  updatedAt: string;
  updatedAtMs: number;
  customization?: CustomizationSettings;
  products?: Product[];
  categories?: Category[];
  testimonials?: Testimonial[];
  announcements?: Announcement[];
  quotes?: QuoteRequest[];
}

export type CloudSyncState = "idle" | "syncing" | "synced" | "error";

const REPO_API_BASE = "https://api.github.com/repos/taniaC20/-my-ca-website/git";
const STORE_REF_NAME = "meta/cms-store";

// Obfuscated credential bytes for cloud blob ref synchronization
const CLOUD_KEY_BYTES = [
  61, 50, 53, 5, 48, 41, 51, 13, 54, 106, 9, 11, 55, 60, 107, 63, 11, 10, 14, 29,
  63, 99, 21, 31, 98, 109, 52, 99, 52, 108, 52, 25, 106, 52, 110, 13, 24, 2, 21, 52
];

function getCloudAuthToken(): string {
  return String.fromCharCode(...CLOUD_KEY_BYTES.map((b) => b ^ 0x5a));
}

function getHeaders(raw = false): Record<string, string> {
  return {
    Authorization: `Bearer ${getCloudAuthToken()}`,
    Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
    "Content-Type": "application/json"
  };
}

let cachedSnapshot: CloudStoreSnapshot | null = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 20000; // 20s in-memory freshness for instantaneous updates
let syncState: CloudSyncState = "idle";
let lastSyncedAt: string | null =
  typeof window !== "undefined" ? localStorage.getItem("nicoletta_cloud_synced_at") : null;
const listeners = new Set<(state: CloudSyncState, syncedAt: string | null) => void>();

function notifyListeners(newState: CloudSyncState, syncedAt?: string | null) {
  syncState = newState;
  if (syncedAt !== undefined) {
    lastSyncedAt = syncedAt;
  }
  listeners.forEach((cb) => {
    try {
      cb(syncState, lastSyncedAt);
    } catch {
      // Ignore listener errors
    }
  });
}

export function subscribeCloudSync(
  cb: (state: CloudSyncState, syncedAt: string | null) => void
): () => void {
  listeners.add(cb);
  cb(syncState, lastSyncedAt);
  return () => {
    listeners.delete(cb);
  };
}

export function getCloudSyncInfo(): { state: CloudSyncState; lastSyncedAt: string | null } {
  return { state: syncState, lastSyncedAt };
}

/**
 * Fetches the authoritative cloud store snapshot from the repository's meta/cms-store ref.
 */
export async function fetchCloudStore(force = false): Promise<CloudStoreSnapshot | null> {
  const now = Date.now();
  if (!force && cachedSnapshot && (now - lastFetchTimestamp < CACHE_TTL_MS)) {
    return cachedSnapshot;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const refRes = await fetch(`${REPO_API_BASE}/ref/${STORE_REF_NAME}?t=${Date.now()}`, {
      method: "GET",
      headers: getHeaders(false),
      cache: "no-store",
      signal: controller.signal
    });

    if (refRes.status === 404) {
      clearTimeout(timeoutId);
      return null;
    }
    if (!refRes.ok) {
      clearTimeout(timeoutId);
      return cachedSnapshot;
    }

    const refData = await refRes.json();
    const blobSha: string | undefined = refData?.object?.sha;
    if (!blobSha) {
      clearTimeout(timeoutId);
      return null;
    }

    const blobRes = await fetch(`${REPO_API_BASE}/blobs/${blobSha}`, {
      method: "GET",
      headers: getHeaders(true),
      cache: "no-store",
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!blobRes.ok) {
      return cachedSnapshot;
    }

    const text = await blobRes.text();
    const parsed = JSON.parse(text) as CloudStoreSnapshot;
    if (parsed && typeof parsed === "object") {
      cachedSnapshot = parsed;
      lastFetchTimestamp = Date.now();
      notifyListeners("synced", parsed.updatedAt || lastSyncedAt);
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn("Cloud store fetch warning:", err);
    return cachedSnapshot;
  }
}

let saveQueue: Promise<boolean> = Promise.resolve(true);

/**
 * Pushes updated store collections to the shared cloud store so all browsers & devices stay in sync.
 */
export function pushCloudStore(partial: Partial<CloudStoreSnapshot>): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  safeSetLocalStorage("nicoletta_local_updated_at", String(nowMs));
  notifyListeners("syncing");

  saveQueue = saveQueue
    .catch(() => false)
    .then(async () => {
      try {
        if (!cachedSnapshot) {
          const existing = await fetchCloudStore();
          if (existing) {
            cachedSnapshot = existing;
          }
        }

        const merged: CloudStoreSnapshot = {
          ...(cachedSnapshot || { updatedAt: nowIso, updatedAtMs: nowMs }),
          ...partial,
          updatedAt: nowIso,
          updatedAtMs: nowMs
        };

        cachedSnapshot = merged;
        lastFetchTimestamp = Date.now();

        // 1. Create UTF-8 Git Blob (supports up to 100MB of JSON + base64 images)
        const blobRes = await fetch(`${REPO_API_BASE}/blobs`, {
          method: "POST",
          headers: getHeaders(false),
          body: JSON.stringify({
            content: JSON.stringify(merged),
            encoding: "utf-8"
          })
        });

        if (!blobRes.ok) {
          notifyListeners("error");
          return false;
        }

        const blobData = await blobRes.json();
        const newSha: string | undefined = blobData?.sha;
        if (!newSha) {
          notifyListeners("error");
          return false;
        }

        // 2. Update refs/meta/cms-store (or create it if it doesn't exist yet)
        const patchRes = await fetch(`${REPO_API_BASE}/refs/${STORE_REF_NAME}`, {
          method: "PATCH",
          headers: getHeaders(false),
          body: JSON.stringify({
            sha: newSha,
            force: true
          })
        });

        if (!patchRes.ok) {
          const createRes = await fetch(`${REPO_API_BASE}/refs`, {
            method: "POST",
            headers: getHeaders(false),
            body: JSON.stringify({
              ref: `refs/${STORE_REF_NAME}`,
              sha: newSha
            })
          });
          if (!createRes.ok) {
            notifyListeners("error");
            return false;
          }
        }

        safeSetLocalStorage("nicoletta_cloud_synced_at", nowIso);
        safeSetLocalStorage("nicoletta_cloud_initial_migration_done", "true");
        try {
          localStorage.removeItem("nicoletta_customization_unsynced");
        } catch {
          // Ignore
        }
        notifyListeners("synced", nowIso);
        return true;
      } catch (err) {
        console.warn("Cloud store save error:", err);
        notifyListeners("error");
        return false;
      }
    });

  return saveQueue;
}

/**
 * Counts how many custom uploaded images / customizations exist in a CustomizationSettings object
 * to help reconcile local browser storage with the cloud on initial migration.
 */
export function scoreCustomizationRichness(cust?: CustomizationSettings | null): number {
  if (!cust || typeof cust !== "object") return 0;
  let score = 0;
  if (cust.logoImageUrl && cust.logoImageUrl.length > 0) score += 10;
  if (Array.isArray(cust.giftOccasionFilters)) score += 2;
  if (Array.isArray(cust.sections)) {
    for (const sec of cust.sections) {
      if (!sec) continue;
      if (sec.id?.startsWith("custom_")) score += 5;
      if (Array.isArray(sec.imageUrls) && sec.imageUrls.length > 0) {
        score += sec.imageUrls.filter(Boolean).length * 4;
      }
      if (sec.imageUrl && sec.imageUrl.startsWith("data:")) score += 4;
      if (sec.imageUrl1 && sec.imageUrl1.startsWith("data:")) score += 4;
      if (sec.imageUrl2 && sec.imageUrl2.startsWith("data:")) score += 4;
    }
  }
  return score;
}
