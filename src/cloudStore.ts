import { Product, Category, Testimonial, Announcement, QuoteRequest, CustomizationSettings } from "./types";
import { safeSetLocalStorage, persistKeyVal, idbGet } from "./storage";

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
const QUOTES_REF_NAME = "meta/cms-quotes";

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
let cachedSha: string | null =
  typeof window !== "undefined" ? localStorage.getItem("nicoletta_cms_blob_sha") : null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 15000; // 15s in-memory freshness for instantaneous updates
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
 * Uses conditional SHA caching: checks the 150-byte git ref first; if the SHA hasn't changed,
 * immediately serves the cached snapshot with 0 download latency.
 */
export async function fetchCloudStore(bypassCacheTtl = false, hardBypass = false): Promise<CloudStoreSnapshot | null> {
  const now = Date.now();
  if (!bypassCacheTtl && cachedSnapshot && now - lastFetchTimestamp < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  // Attempt to restore from IndexedDB if in-memory cache is empty
  if (!cachedSnapshot) {
    try {
      const idbSnapshot = await idbGet<CloudStoreSnapshot>("nicoletta_cached_cloud_store");
      if (
        idbSnapshot &&
        typeof idbSnapshot === "object" &&
        Array.isArray(idbSnapshot.products) &&
        idbSnapshot.products.length > 0
      ) {
        cachedSnapshot = idbSnapshot;
      }
    } catch {
      // Continue to network fetch
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    // Step 1: Lightweight ref check (~150 bytes, ~120ms)
    const refRes = await fetch(`${REPO_API_BASE}/ref/${STORE_REF_NAME}?t=${Date.now()}`, {
      method: "GET",
      headers: getHeaders(false),
      cache: "no-store",
      signal: controller.signal
    });

    if (refRes.status === 404) {
      clearTimeout(timeoutId);
      return cachedSnapshot;
    }
    if (!refRes.ok) {
      clearTimeout(timeoutId);
      return cachedSnapshot;
    }

    const refData = await refRes.json();
    const blobSha: string | undefined = refData?.object?.sha;
    if (!blobSha) {
      clearTimeout(timeoutId);
      return cachedSnapshot;
    }

    // Fast-path: SHA matches what we already have cached!
    if (!hardBypass && cachedSnapshot && blobSha === cachedSha) {
      clearTimeout(timeoutId);
      lastFetchTimestamp = Date.now();
      notifyListeners("synced", cachedSnapshot.updatedAt || lastSyncedAt);
      return cachedSnapshot;
    }

    // Step 2: Fetch updated blob content
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
      cachedSha = blobSha;
      lastFetchTimestamp = Date.now();
      safeSetLocalStorage("nicoletta_cms_blob_sha", blobSha);
      persistKeyVal("nicoletta_cached_cloud_store", parsed);
      notifyListeners("synced", parsed.updatedAt || lastSyncedAt);
      return parsed;
    }
    return cachedSnapshot;
  } catch (err) {
    console.warn("Cloud store fetch warning:", err);
    return cachedSnapshot;
  }
}

let quotesCache: QuoteRequest[] | null = null;
let lastQuotesTimestamp = 0;

/**
 * Fetches quotes from meta/cms-quotes.
 * Exclusively used by Admin Dashboard so regular users never download quotes.
 */
export async function fetchCloudQuotes(force = false): Promise<QuoteRequest[]> {
  const now = Date.now();
  if (!force && quotesCache && now - lastQuotesTimestamp < CACHE_TTL_MS) {
    return quotesCache;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const refRes = await fetch(`${REPO_API_BASE}/ref/${QUOTES_REF_NAME}?t=${Date.now()}`, {
      method: "GET",
      headers: getHeaders(false),
      cache: "no-store",
      signal: controller.signal
    });

    if (!refRes.ok) {
      clearTimeout(timeoutId);
      return quotesCache || [];
    }

    const refData = await refRes.json();
    const blobSha: string | undefined = refData?.object?.sha;
    if (!blobSha) {
      clearTimeout(timeoutId);
      return quotesCache || [];
    }

    const blobRes = await fetch(`${REPO_API_BASE}/blobs/${blobSha}`, {
      method: "GET",
      headers: getHeaders(true),
      cache: "no-store",
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!blobRes.ok) return quotesCache || [];

    const text = await blobRes.text();
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.quotes)) {
      quotesCache = parsed.quotes;
      lastQuotesTimestamp = Date.now();
      return parsed.quotes;
    }
    return quotesCache || [];
  } catch (err) {
    console.warn("Cloud quotes fetch warning:", err);
    return quotesCache || [];
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

        // 1. If quotes are being updated, push them to meta/cms-quotes
        if (Array.isArray(partial.quotes)) {
          const quotesPayload = {
            updatedAt: nowIso,
            updatedAtMs: nowMs,
            quotes: partial.quotes
          };
          quotesCache = partial.quotes;
          lastQuotesTimestamp = Date.now();

          try {
            const quotesBlobRes = await fetch(`${REPO_API_BASE}/blobs`, {
              method: "POST",
              headers: getHeaders(false),
              body: JSON.stringify({
                content: JSON.stringify(quotesPayload),
                encoding: "utf-8"
              })
            });

            if (quotesBlobRes.ok) {
              const qBlobData = await quotesBlobRes.json();
              const qSha = qBlobData?.sha;
              if (qSha) {
                const pRes = await fetch(`${REPO_API_BASE}/refs/${QUOTES_REF_NAME}`, {
                  method: "PATCH",
                  headers: getHeaders(false),
                  body: JSON.stringify({ sha: qSha, force: true })
                });
                if (!pRes.ok) {
                  await fetch(`${REPO_API_BASE}/refs`, {
                    method: "POST",
                    headers: getHeaders(false),
                    body: JSON.stringify({ ref: `refs/${QUOTES_REF_NAME}`, sha: qSha })
                  });
                }
              }
            }
          } catch (qErr) {
            console.warn("Quotes cloud save warning:", qErr);
          }
        }

        // 2. Prepare CMS store (products, categories, customization, announcements, testimonials)
        const storeMerged: CloudStoreSnapshot = {
          ...(cachedSnapshot || { updatedAt: nowIso, updatedAtMs: nowMs }),
          ...(partial.customization !== undefined ? { customization: partial.customization } : {}),
          ...(partial.products !== undefined ? { products: partial.products } : {}),
          ...(partial.categories !== undefined ? { categories: partial.categories } : {}),
          ...(partial.testimonials !== undefined ? { testimonials: partial.testimonials } : {}),
          ...(partial.announcements !== undefined ? { announcements: partial.announcements } : {}),
          updatedAt: nowIso,
          updatedAtMs: nowMs
        };
        // Exclude quotes from cms-store payload to keep it lean and fast
        delete storeMerged.quotes;

        cachedSnapshot = storeMerged;
        lastFetchTimestamp = Date.now();
        persistKeyVal("nicoletta_cached_cloud_store", storeMerged);

        // Create UTF-8 Git Blob for cms-store
        const blobRes = await fetch(`${REPO_API_BASE}/blobs`, {
          method: "POST",
          headers: getHeaders(false),
          body: JSON.stringify({
            content: JSON.stringify(storeMerged),
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

        cachedSha = newSha;
        safeSetLocalStorage("nicoletta_cms_blob_sha", newSha);

        // Update refs/meta/cms-store
        const patchRes = await fetch(`${REPO_API_BASE}/refs/${STORE_REF_NAME}`, {
          method: "PATCH",
          headers: getHeaders(false),
          body: JSON.stringify({
            sha: newSha,
            force: true
          })
        });

        if (!patchRes.ok) {
          await fetch(`${REPO_API_BASE}/refs`, {
            method: "POST",
            headers: getHeaders(false),
            body: JSON.stringify({
              ref: `refs/${STORE_REF_NAME}`,
              sha: newSha
            })
          });
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
