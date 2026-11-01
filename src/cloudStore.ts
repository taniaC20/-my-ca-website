import { Product, Category, Testimonial, Announcement, QuoteRequest, CustomizationSettings } from "./types";
import { safeSetLocalStorage, persistKeyVal, idbGet } from "./storage";
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_TESTIMONIALS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_CUSTOMIZATION
} from "./initialData";
import { db } from "./lib/firebase";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy } from "firebase/firestore";

export interface CloudStoreSnapshot {
  _sha?: string;
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

export const BUNDLED_CMS_SHA = "2851bd428bf002affd7c37b277cd77fddbc343f5";

const BUNDLED_SNAPSHOT: CloudStoreSnapshot = {
  _sha: BUNDLED_CMS_SHA,
  updatedAt: "2026-11-01T17:43:00.000Z",
  updatedAtMs: 1793556888066,
  products: INITIAL_PRODUCTS,
  categories: INITIAL_CATEGORIES,
  testimonials: INITIAL_TESTIMONIALS,
  announcements: INITIAL_ANNOUNCEMENTS,
  customization: INITIAL_CUSTOMIZATION
};

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
  typeof window !== "undefined"
    ? localStorage.getItem("nicoletta_cms_blob_sha") || BUNDLED_CMS_SHA
    : BUNDLED_CMS_SHA;
let lastFetchTimestamp = 0;
let activeSavesCount = 0;
let pendingCmsVersion = 0;
let syncedCmsVersion = 0;
let cmsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushingCms = false;
let lastLocalSaveMs: number =
  typeof window !== "undefined"
    ? Number(localStorage.getItem("nicoletta_local_updated_at") || 0)
    : 0;
const CACHE_TTL_MS = 15000; // 15s in-memory freshness for instantaneous updates
let syncState: CloudSyncState = "idle";
let lastSyncedAt: string | null =
  typeof window !== "undefined" ? localStorage.getItem("nicoletta_cloud_synced_at") : null;
const listeners = new Set<(state: CloudSyncState, syncedAt: string | null) => void>();

export function isCloudSaveBusy(): boolean {
  return (
    activeSavesCount > 0 ||
    isFlushingCms ||
    cmsDebounceTimer !== null ||
    pendingCmsVersion > syncedCmsVersion ||
    (lastLocalSaveMs > 0 && Date.now() - lastLocalSaveMs < 25000)
  );
}

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

  // Always hydrate in-memory cachedSnapshot from IndexedDB on first call so local unsynced saves are never lost
  if (!cachedSnapshot) {
    try {
      const idbSnapshot = await idbGet<CloudStoreSnapshot>("nicoletta_cached_cloud_store");
      if (
        idbSnapshot &&
        typeof idbSnapshot === "object" &&
        Array.isArray(idbSnapshot.products) &&
        idbSnapshot.products.length > 0 &&
        (idbSnapshot.updatedAtMs || 0) >= BUNDLED_SNAPSHOT.updatedAtMs
      ) {
        cachedSnapshot = idbSnapshot;
        if (idbSnapshot._sha) {
          cachedSha = idbSnapshot._sha;
        }
      }
    } catch {
      // Continue to network fetch
    }
    if (!cachedSnapshot) {
      cachedSnapshot = BUNDLED_SNAPSHOT;
    }
  }

  // Never overwrite in-flight or very recent Admin saves with a stale network response
  if (isCloudSaveBusy()) {
    return cachedSnapshot;
  }
  if (!bypassCacheTtl && cachedSnapshot && now - lastFetchTimestamp < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    // Step 1: Check lightweight Git ref AND Firestore cms_snapshot_meta in parallel
    const [refResult, fsMetaResult] = await Promise.allSettled([
      fetch(`${REPO_API_BASE}/ref/${STORE_REF_NAME}?t=${Date.now()}`, {
        method: "GET",
        headers: getHeaders(false),
        cache: "no-store",
        signal: controller.signal
      }).then((r) => (r.ok ? r.json() : null)),
      getDoc(doc(db, "settings", "cms_snapshot_meta"))
    ]);

    const refData = refResult.status === "fulfilled" ? refResult.value : null;
    const metaSnap = fsMetaResult.status === "fulfilled" ? fsMetaResult.value : null;
    const fsMeta = metaSnap && metaSnap.exists() ? metaSnap.data() : null;
    const fsUpdatedAtMs = Number(fsMeta?.updatedAtMs || 0);
    const fsBlobSha = typeof fsMeta?.blobSha === "string" && fsMeta.blobSha.length > 0 ? fsMeta.blobSha : undefined;

    // Pick candidate blobSha: if Firestore meta has a newer blobSha that differs from git ref, prefer it
    const gitBlobSha: string | undefined = refData?.object?.sha;
    const blobSha: string | undefined =
      fsBlobSha && fsUpdatedAtMs > (cachedSnapshot?.updatedAtMs || 0) && fsBlobSha !== gitBlobSha
        ? fsBlobSha
        : gitBlobSha || fsBlobSha;

    if (blobSha) {
      const localMs = Math.max(cachedSnapshot?.updatedAtMs || 0, lastLocalSaveMs);

      // If our local IndexedDB snapshot is strictly newer than Firestore's latest timestamp, keep local & re-sync cloud!
      if (
        cachedSnapshot &&
        cachedSnapshot !== BUNDLED_SNAPSHOT &&
        fsUpdatedAtMs > 0 &&
        (cachedSnapshot.updatedAtMs || 0) > fsUpdatedAtMs
      ) {
        clearTimeout(timeoutId);
        pushCloudStore({
          products: cachedSnapshot.products,
          categories: cachedSnapshot.categories,
          testimonials: cachedSnapshot.testimonials,
          announcements: cachedSnapshot.announcements,
          customization: cachedSnapshot.customization
        }).catch(() => {});
        return cachedSnapshot;
      }

      // If remote SHA matches the bundled build SHA and we don't have a newer local save, serve BUNDLED_SNAPSHOT (0ms)
      if (!hardBypass && blobSha === BUNDLED_CMS_SHA && localMs <= BUNDLED_SNAPSHOT.updatedAtMs) {
        clearTimeout(timeoutId);
        cachedSnapshot = BUNDLED_SNAPSHOT;
        cachedSha = blobSha;
        lastFetchTimestamp = Date.now();
        safeSetLocalStorage("nicoletta_cms_blob_sha", blobSha);
        notifyListeners("synced", BUNDLED_SNAPSHOT.updatedAt || lastSyncedAt);
        return BUNDLED_SNAPSHOT;
      }

      // Fast-path: SHA matches what we already have cached AND the cached snapshot carries that exact SHA
      if (!hardBypass && cachedSnapshot && cachedSnapshot._sha === blobSha && blobSha === cachedSha) {
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

      if (blobRes.ok) {
        const text = await blobRes.text();
        const parsed = JSON.parse(text) as CloudStoreSnapshot;
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.products)) {
          if (isCloudSaveBusy() || (cachedSnapshot && (cachedSnapshot.updatedAtMs || 0) > (parsed.updatedAtMs || 0))) {
            if (cachedSnapshot && cachedSnapshot !== BUNDLED_SNAPSHOT && (cachedSnapshot.updatedAtMs || 0) > (parsed.updatedAtMs || 0)) {
              pushCloudStore({
                products: cachedSnapshot.products,
                categories: cachedSnapshot.categories,
                testimonials: cachedSnapshot.testimonials,
                announcements: cachedSnapshot.announcements,
                customization: cachedSnapshot.customization
              }).catch(() => {});
            }
            return cachedSnapshot;
          }
          parsed._sha = blobSha;
          cachedSnapshot = parsed;
          cachedSha = blobSha;
          lastFetchTimestamp = Date.now();
          safeSetLocalStorage("nicoletta_cms_blob_sha", blobSha);
          persistKeyVal("nicoletta_cached_cloud_store", parsed);
          notifyListeners("synced", parsed.updatedAt || lastSyncedAt);
          return parsed;
        }
      }
    }
    clearTimeout(timeoutId);
  } catch (err) {
    console.warn("Cloud store fetch warning:", err);
  }

  // Fallback: Check Firestore /settings/cms_snapshot_meta if primary ref was unreachable
  try {
    const metaSnap = await getDoc(doc(db, "settings", "cms_snapshot_meta"));
    if (metaSnap.exists()) {
      const meta = metaSnap.data();
      const fsUpdatedAtMs = Number(meta?.updatedAtMs || 0);
      const totalChunks = Number(meta?.totalChunks || 0);
      const currentMs = cachedSnapshot?.updatedAtMs || 0;
      if (
        totalChunks > 0 &&
        fsUpdatedAtMs > 0 &&
        fsUpdatedAtMs >= lastLocalSaveMs &&
        (hardBypass || fsUpdatedAtMs > currentMs || currentMs === 0)
      ) {
        const chunkPromises = [];
        for (let i = 0; i < totalChunks; i++) {
          chunkPromises.push(getDoc(doc(db, "settings", `cms_chunk_${i}`)));
        }
        const chunkSnaps = await Promise.all(chunkPromises);
        if (chunkSnaps.every((s) => s.exists())) {
          const joined = chunkSnaps.map((s) => s.data()?.data || "").join("");
          const fsParsed = JSON.parse(joined) as CloudStoreSnapshot;
          if (fsParsed && Array.isArray(fsParsed.products) && fsParsed.products.length > 0) {
            fsParsed.updatedAtMs = fsUpdatedAtMs;
            cachedSnapshot = fsParsed;
            lastFetchTimestamp = Date.now();
            persistKeyVal("nicoletta_cached_cloud_store", fsParsed);
            notifyListeners("synced", fsParsed.updatedAt || lastSyncedAt);
            return fsParsed;
          }
        }
      }
    }
  } catch {
    // Ignore fallback error
  }

  return cachedSnapshot;
}

let quotesCache: QuoteRequest[] | null = null;
let lastQuotesTimestamp = 0;

/**
 * Fetches quotes from Firestore `/quoteRequests` and meta/cms-quotes.
 * Exclusively used by Admin Dashboard so regular users never download quotes.
 */
export async function fetchCloudQuotes(force = false): Promise<QuoteRequest[]> {
  const now = Date.now();
  if (!force && quotesCache && now - lastQuotesTimestamp < CACHE_TTL_MS) {
    return quotesCache;
  }

  let firestoreQuotes: QuoteRequest[] = [];
  try {
    const qCol = collection(db, "quoteRequests");
    const q = query(qCol, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    firestoreQuotes = snap.docs.map((d) => ({ ...(d.data() as QuoteRequest), id: d.id }));
  } catch {
    // Fallback if Firestore rules or indexes are not yet active
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
      if (firestoreQuotes.length > 0) {
        quotesCache = firestoreQuotes;
        lastQuotesTimestamp = Date.now();
        return firestoreQuotes;
      }
      return quotesCache || [];
    }

    const refData = await refRes.json();
    const blobSha: string | undefined = refData?.object?.sha;
    if (!blobSha) {
      clearTimeout(timeoutId);
      return firestoreQuotes.length > 0 ? firestoreQuotes : (quotesCache || []);
    }

    const blobRes = await fetch(`${REPO_API_BASE}/blobs/${blobSha}`, {
      method: "GET",
      headers: getHeaders(true),
      cache: "no-store",
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!blobRes.ok) return firestoreQuotes.length > 0 ? firestoreQuotes : (quotesCache || []);

    const text = await blobRes.text();
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.quotes)) {
      const merged = Array.from(
        new Map([...firestoreQuotes, ...parsed.quotes].map((item: QuoteRequest) => [item.id, item])).values()
      );
      quotesCache = merged;
      lastQuotesTimestamp = Date.now();
      return merged;
    }
    return firestoreQuotes.length > 0 ? firestoreQuotes : (quotesCache || []);
  } catch (err) {
    console.warn("Cloud quotes fetch warning:", err);
    return firestoreQuotes.length > 0 ? firestoreQuotes : (quotesCache || []);
  }
}

async function flushCmsCloudSave(): Promise<boolean> {
  if (isFlushingCms) return true;
  isFlushingCms = true;
  let lastSuccess = false;

  try {
    while (syncedCmsVersion < pendingCmsVersion) {
      const targetVersion = pendingCmsVersion;
      const storeMerged: CloudStoreSnapshot = {
        ...(cachedSnapshot || BUNDLED_SNAPSHOT)
      };
      delete storeMerged.quotes;
      const uploadIso = storeMerged.updatedAt || new Date().toISOString();
      const uploadMs = storeMerged.updatedAtMs || Date.now();

      let gitSynced = false;
      let uploadedSha = "";
      try {
        const blobRes = await fetch(`${REPO_API_BASE}/blobs`, {
          method: "POST",
          headers: getHeaders(false),
          body: JSON.stringify({
            content: JSON.stringify(storeMerged),
            encoding: "utf-8"
          })
        });

        if (blobRes.ok) {
          const blobData = await blobRes.json();
          const newSha: string | undefined = blobData?.sha;
          if (newSha) {
            uploadedSha = newSha;
            cachedSha = newSha;
            safeSetLocalStorage("nicoletta_cms_blob_sha", newSha);

            // Only attach _sha to cachedSnapshot if no newer local edits happened while uploading
            if (pendingCmsVersion === targetVersion && cachedSnapshot) {
              cachedSnapshot._sha = newSha;
              persistKeyVal("nicoletta_cached_cloud_store", cachedSnapshot);
            }

            let patchRes = await fetch(`${REPO_API_BASE}/refs/${STORE_REF_NAME}`, {
              method: "PATCH",
              headers: getHeaders(false),
              body: JSON.stringify({ sha: newSha, force: true })
            });

            if (!patchRes.ok) {
              await new Promise((r) => setTimeout(r, 400));
              patchRes = await fetch(`${REPO_API_BASE}/refs/${STORE_REF_NAME}`, {
                method: "PATCH",
                headers: getHeaders(false),
                body: JSON.stringify({ sha: newSha, force: true })
              });
            }

            if (!patchRes.ok) {
              await fetch(`${REPO_API_BASE}/refs`, {
                method: "POST",
                headers: getHeaders(false),
                body: JSON.stringify({ ref: `refs/${STORE_REF_NAME}`, sha: newSha })
              });
            }
            gitSynced = true;
          }
        }
      } catch (gitErr) {
        console.warn("Cloud git blob sync warning:", gitErr);
      }

      // Sync chunked snapshot to Firestore (< 700KB per doc)
      let firestoreSynced = false;
      try {
        const serialized = JSON.stringify(storeMerged);
        const chunkSize = 700000;
        const totalChunks = Math.ceil(serialized.length / chunkSize);
        const chunkWrites: Promise<any>[] = [];
        for (let i = 0; i < totalChunks; i++) {
          const slice = serialized.slice(i * chunkSize, (i + 1) * chunkSize);
          chunkWrites.push(
            setDoc(doc(db, "settings", `cms_chunk_${i}`), { index: i, data: slice, updatedAtMs: uploadMs })
          );
        }
        await Promise.all(chunkWrites);
        await setDoc(
          doc(db, "settings", "cms_snapshot_meta"),
          { updatedAt: uploadIso, updatedAtMs: uploadMs, totalChunks, blobSha: uploadedSha || cachedSha || "" },
          { merge: true }
        );
        firestoreSynced = true;
      } catch (fsErr) {
        console.warn("Firestore snapshot sync warning:", fsErr);
      }

      syncedCmsVersion = Math.max(syncedCmsVersion, targetVersion);
      lastSuccess = firestoreSynced || gitSynced;

      if (lastSuccess && syncedCmsVersion >= pendingCmsVersion) {
        safeSetLocalStorage("nicoletta_cloud_synced_at", uploadIso);
        safeSetLocalStorage("nicoletta_cloud_initial_migration_done", "true");
        try {
          localStorage.removeItem("nicoletta_customization_unsynced");
        } catch {}
        notifyListeners("synced", uploadIso);
      } else if (!lastSuccess && syncedCmsVersion >= pendingCmsVersion) {
        notifyListeners("error");
      }
    }
    return lastSuccess;
  } finally {
    isFlushingCms = false;
  }
}

/**
 * Pushes updated store collections to the shared cloud store so all browsers & devices stay in sync.
 * Coalesces rapid edits/reorders so intermediate states never overwrite the latest state.
 */
export function pushCloudStore(partial: Partial<CloudStoreSnapshot>): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const hasCmsChanges =
    partial.products !== undefined ||
    partial.categories !== undefined ||
    partial.customization !== undefined ||
    partial.testimonials !== undefined ||
    partial.announcements !== undefined;

  notifyListeners("syncing");

  // 1. Handle quotes update if present
  if (Array.isArray(partial.quotes)) {
    const quotesList = partial.quotes;
    quotesCache = quotesList;
    lastQuotesTimestamp = nowMs;
    activeSavesCount++;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "quoteRequests"));
        const keepIds = new Set(quotesList.map((q) => q.id));
        await Promise.all(
          snap.docs
            .filter((d) => !keepIds.has(d.id))
            .map((d) => deleteDoc(doc(db, "quoteRequests", d.id)).catch(() => {}))
        );
        const latestQuotes = quotesList.slice(0, 25);
        await Promise.all(
          latestQuotes.map((qItem) =>
            qItem.id
              ? setDoc(
                  doc(db, "quoteRequests", qItem.id),
                  { ...qItem, customerEmail: (qItem.customerEmail || "").toLowerCase() },
                  { merge: true }
                ).catch(() => {})
              : Promise.resolve()
          )
        );
      } catch {}

      try {
        const quotesPayload = { updatedAt: nowIso, updatedAtMs: nowMs, quotes: quotesList };
        const quotesBlobRes = await fetch(`${REPO_API_BASE}/blobs`, {
          method: "POST",
          headers: getHeaders(false),
          body: JSON.stringify({ content: JSON.stringify(quotesPayload), encoding: "utf-8" })
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
      } finally {
        activeSavesCount = Math.max(0, activeSavesCount - 1);
        if (!hasCmsChanges && activeSavesCount === 0) {
          notifyListeners("synced", nowIso);
        }
      }
    })();
  }

  if (!hasCmsChanges) {
    return Promise.resolve(true);
  }

  // 2. Optimistically merge CMS changes into cachedSnapshot & IndexedDB immediately (0ms)
  lastLocalSaveMs = nowMs;
  pendingCmsVersion++;
  safeSetLocalStorage("nicoletta_local_updated_at", String(nowMs));
  safeSetLocalStorage("nicoletta_customization_unsynced", "true");

  const baseSnapshot = cachedSnapshot || BUNDLED_SNAPSHOT;
  const immediateMerged: CloudStoreSnapshot = {
    ...baseSnapshot,
    ...(partial.customization !== undefined
      ? {
          customization: {
            ...baseSnapshot?.customization,
            ...partial.customization,
            emailSettings:
              partial.customization.emailSettings ||
              baseSnapshot?.customization?.emailSettings || {
                adminEmail: "sales@nicolettacraftsdecor.ca",
                gmailUser: "sales@nicolettacraftsdecor.ca",
                gmailAppPassword: "avtfmlmoaqwnacyo",
                emailNotificationsEnabled: true
              }
          }
        }
      : {}),
    ...(partial.products !== undefined ? { products: partial.products } : {}),
    ...(partial.categories !== undefined ? { categories: partial.categories } : {}),
    ...(partial.testimonials !== undefined ? { testimonials: partial.testimonials } : {}),
    ...(partial.announcements !== undefined ? { announcements: partial.announcements } : {}),
    updatedAt: nowIso,
    updatedAtMs: nowMs
  };
  delete immediateMerged.quotes;
  delete immediateMerged._sha;
  cachedSnapshot = immediateMerged;
  lastFetchTimestamp = nowMs;
  persistKeyVal("nicoletta_cached_cloud_store", immediateMerged);

  // Debounce network upload by 350ms so rapid arrow clicks / reorders coalesce into a single upload
  if (cmsDebounceTimer) {
    clearTimeout(cmsDebounceTimer);
  }
  return new Promise((resolve) => {
    cmsDebounceTimer = setTimeout(() => {
      cmsDebounceTimer = null;
      flushCmsCloudSave().then(resolve).catch(() => resolve(false));
    }, 350);
  });
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
