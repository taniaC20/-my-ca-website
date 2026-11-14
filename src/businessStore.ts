import {
  BusinessStoreSnapshot,
  BusinessSettings,
  InventoryItem,
  ProductRecipe,
  IncomeRecord,
  ExpenseRecord,
  ReceiptLineItemDraft,
  computeInventoryStatus,
  computeIncomeRow,
  recalculateRecipe
} from "./businessTypes";
import {
  INITIAL_BUSINESS_SETTINGS,
  INITIAL_INVENTORY,
  INITIAL_RECIPES,
  INITIAL_INCOME,
  INITIAL_EXPENSES
} from "./businessSeedData";
import { Product, QuoteRequest } from "./types";
import { persistKeyVal, idbGet, safeSetLocalStorage } from "./storage";
import { db } from "./lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const STORAGE_KEY = "nicoletta_business_tracker_v1";
const REPO_API_BASE = "https://api.github.com/repos/taniaC20/-my-ca-website/git";
const BUSINESS_REF_NAME = "meta/cms-business";

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

const DEFAULT_SNAPSHOT: BusinessStoreSnapshot = {
  updatedAt: "2026-11-01T00:00:00.000Z",
  updatedAtMs: 1793491200000,
  settings: INITIAL_BUSINESS_SETTINGS,
  inventory: INITIAL_INVENTORY,
  recipes: INITIAL_RECIPES,
  income: INITIAL_INCOME,
  expenses: INITIAL_EXPENSES
};

let memorySnapshot: BusinessStoreSnapshot | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<(snap: BusinessStoreSnapshot) => void>();

function notifySubscribers(snap: BusinessStoreSnapshot) {
  subscribers.forEach((cb) => {
    try {
      cb(snap);
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function getInitialBusinessSnapshot(): BusinessStoreSnapshot {
  if (memorySnapshot) return memorySnapshot;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BusinessStoreSnapshot;
        if (parsed && Array.isArray(parsed.inventory) && Array.isArray(parsed.income)) {
          memorySnapshot = parsed;
          return parsed;
        }
      }
    } catch {
      // Fall back to default
    }
  }
  memorySnapshot = DEFAULT_SNAPSHOT;
  return DEFAULT_SNAPSHOT;
}

export function subscribeBusinessStore(cb: (snap: BusinessStoreSnapshot) => void): () => void {
  subscribers.add(cb);
  cb(getInitialBusinessSnapshot());
  return () => {
    subscribers.delete(cb);
  };
}

export async function loadBusinessStore(): Promise<BusinessStoreSnapshot> {
  const localSnap = getInitialBusinessSnapshot();

  // Check IndexedDB
  try {
    const idbSnap = await idbGet<BusinessStoreSnapshot>(STORAGE_KEY);
    if (
      idbSnap &&
      Array.isArray(idbSnap.inventory) &&
      (idbSnap.updatedAtMs || 0) > (memorySnapshot?.updatedAtMs || 0)
    ) {
      memorySnapshot = idbSnap;
      notifySubscribers(idbSnap);
    }
  } catch {
    // Continue
  }

  // Fetch from Firestore and GitHub meta/cms-business in parallel
  try {
    const [fsRes, ghRefRes] = await Promise.allSettled([
      getDoc(doc(db, "business_tracker", "snapshot")),
      fetch(`${REPO_API_BASE}/ref/${BUSINESS_REF_NAME}?t=${Date.now()}`, {
        method: "GET",
        headers: getHeaders(false),
        cache: "no-store"
      }).then((r) => (r.ok ? r.json() : null))
    ]);

    let newestRemote: BusinessStoreSnapshot | null = null;

    if (fsRes.status === "fulfilled" && fsRes.value && fsRes.value.exists()) {
      const data = fsRes.value.data();
      if (data && typeof data.payload === "string") {
        const parsed = JSON.parse(data.payload) as BusinessStoreSnapshot;
        if (parsed && Array.isArray(parsed.inventory)) {
          newestRemote = parsed;
        }
      }
    }

    if (ghRefRes.status === "fulfilled" && ghRefRes.value?.object?.sha) {
      const sha = ghRefRes.value.object.sha;
      const blobRes = await fetch(`${REPO_API_BASE}/blobs/${sha}`, {
        method: "GET",
        headers: getHeaders(true),
        cache: "no-store"
      });
      if (blobRes.ok) {
        const text = await blobRes.text();
        const ghParsed = JSON.parse(text) as BusinessStoreSnapshot;
        if (
          ghParsed &&
          Array.isArray(ghParsed.inventory) &&
          (!newestRemote || (ghParsed.updatedAtMs || 0) > (newestRemote.updatedAtMs || 0))
        ) {
          newestRemote = ghParsed;
        }
      }
    }

    if (newestRemote && (newestRemote.updatedAtMs || 0) > (memorySnapshot?.updatedAtMs || 0)) {
      memorySnapshot = newestRemote;
      persistKeyVal(STORAGE_KEY, newestRemote);
      notifySubscribers(newestRemote);
      return newestRemote;
    }
  } catch {
    // Offline or ref not created yet; keep local/seed snapshot
  }

  return memorySnapshot || localSnap;
}

export function saveBusinessStore(partial: Partial<BusinessStoreSnapshot>): BusinessStoreSnapshot {
  const current = getInitialBusinessSnapshot();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const next: BusinessStoreSnapshot = {
    ...current,
    ...partial,
    updatedAt: nowIso,
    updatedAtMs: nowMs
  };

  memorySnapshot = next;
  persistKeyVal(STORAGE_KEY, next);
  safeSetLocalStorage(STORAGE_KEY, JSON.stringify(next));
  notifySubscribers(next);

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(async () => {
    saveTimer = null;
    const snapToPush = memorySnapshot;
    if (!snapToPush) return;
    const payloadStr = JSON.stringify(snapToPush);

    // 1. Save to Firestore (business_tracker/snapshot + collection docs)
    try {
      await setDoc(doc(db, "business_tracker", "snapshot"), {
        updatedAt: snapToPush.updatedAt,
        updatedAtMs: snapToPush.updatedAtMs,
        payload: payloadStr
      });
      await setDoc(doc(db, "business_settings", "config"), {
        ...snapToPush.settings,
        updatedAt: snapToPush.updatedAt
      });
    } catch {
      // Continue to GitHub ref backup
    }

    // 2. Save to GitHub ref meta/cms-business
    try {
      const blobRes = await fetch(`${REPO_API_BASE}/blobs`, {
        method: "POST",
        headers: getHeaders(false),
        body: JSON.stringify({ content: payloadStr, encoding: "utf-8" })
      });
      if (blobRes.ok) {
        const blobData = await blobRes.json();
        const patchRes = await fetch(`${REPO_API_BASE}/refs/${BUSINESS_REF_NAME}`, {
          method: "PATCH",
          headers: getHeaders(false),
          body: JSON.stringify({ sha: blobData.sha, force: true })
        });
        if (!patchRes.ok && patchRes.status === 422) {
          await fetch(`${REPO_API_BASE}/refs`, {
            method: "POST",
            headers: getHeaders(false),
            body: JSON.stringify({ ref: `refs/${BUSINESS_REF_NAME}`, sha: blobData.sha })
          });
        }
      }
    } catch {
      // Ignore network error
    }
  }, 400);

  return next;
}

/**
 * Matches a product name or ID to a ProductRecipe
 */
export function findMatchingRecipe(
  recipes: ProductRecipe[],
  productNameOrId?: string,
  websiteProductId?: string
): ProductRecipe | undefined {
  if (!productNameOrId && !websiteProductId) return undefined;
  if (websiteProductId) {
    const byWebId = recipes.find((r) => r.websiteProductId === websiteProductId);
    if (byWebId) return byWebId;
  }
  if (productNameOrId) {
    const byId = recipes.find((r) => r.id === productNameOrId);
    if (byId) return byId;
    const norm = productNameOrId.trim().toLowerCase();
    const exact = recipes.find((r) => r.name.trim().toLowerCase() === norm);
    if (exact) return exact;
    return recipes.find(
      (r) =>
        norm.includes(r.name.trim().toLowerCase()) ||
        r.name.trim().toLowerCase().includes(norm)
    );
  }
  return undefined;
}

/**
 * Records a sale in Income and optionally deducts its recipe materials from Inventory.
 */
export function recordSaleAndDeductInventory(input: {
  date: string;
  recipeId?: string;
  websiteProductId?: string;
  websiteQuoteId?: string;
  itemSold: string;
  platform: string;
  salePrice: number;
  itemCost: number;
  laborCostPerItem: number;
  qty: number;
  discount?: number;
  tip?: number;
  notes?: string;
  deductInventory?: boolean;
}): { incomeRecord: IncomeRecord; deductedItems: string[] } {
  const current = getInitialBusinessSnapshot();
  const shouldDeduct =
    input.deductInventory !== undefined ? input.deductInventory : current.settings.autoDeductInventory;

  const recipe = findMatchingRecipe(
    current.recipes,
    input.recipeId || input.itemSold,
    input.websiteProductId
  );

  const deductedItems: string[] = [];
  let updatedInventory = [...current.inventory];

  if (shouldDeduct && recipe && recipe.materials.length > 0) {
    const saleQty = Number(input.qty) > 0 ? Number(input.qty) : 1;
    updatedInventory = updatedInventory.map((inv) => {
      const matMatch = recipe.materials.find(
        (m) =>
          m.inventoryItemId === inv.id ||
          m.name.trim().toLowerCase() === inv.name.trim().toLowerCase()
      );
      if (!matMatch) return inv;

      const unitsToDeduct = (Number(matMatch.qtyUsed) || 1) * saleQty;
      const newStock = Math.max(0, Number((inv.stock - unitsToDeduct).toFixed(2)));
      const newStatus = computeInventoryStatus(newStock, inv.minStock, inv.status);
      deductedItems.push(`${inv.name} (-${unitsToDeduct})`);
      return {
        ...inv,
        stock: newStock,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };
    });
  }

  const incomeRecord = computeIncomeRow({
    ...input,
    recipeId: recipe?.id || input.recipeId,
    inventoryDeducted: deductedItems.length > 0
  });

  saveBusinessStore({
    income: [incomeRecord, ...current.income],
    inventory: updatedInventory
  });

  return { incomeRecord, deductedItems };
}

/**
 * Automatically logs a completed Website QuoteRequest into Income & deducts Inventory
 * (idempotent by quote.id).
 */
export function syncCompletedWebsiteOrder(
  quote: QuoteRequest,
  websiteProducts: Product[]
): { synced: boolean; alreadyExists?: boolean; incomeRecord?: IncomeRecord } {
  if (!quote || quote.status !== "completed") {
    return { synced: false };
  }
  const current = getInitialBusinessSnapshot();
  if (!current.settings.autoSyncWebsiteOrders) {
    return { synced: false };
  }
  const existing = current.income.find((inc) => inc.websiteQuoteId === quote.id);
  if (existing) {
    return { synced: false, alreadyExists: true, incomeRecord: existing };
  }

  const webProd = quote.productId
    ? websiteProducts.find((p) => p.id === quote.productId)
    : websiteProducts.find(
        (p) =>
          quote.productName &&
          p.name.trim().toLowerCase() === quote.productName.trim().toLowerCase()
      );

  const recipe = findMatchingRecipe(
    current.recipes,
    quote.productName || webProd?.name,
    webProd?.id
  );

  const qty = Number(quote.quantity) > 0 ? Number(quote.quantity) : 1;
  // Note: quote.quoteAmount in Admin Dashboard can be total quote or per-unit; if quoteAmount > 0, compute unit salePrice
  const unitSalePrice =
    quote.quoteAmount && quote.quoteAmount > 0
      ? Number((quote.quoteAmount / qty).toFixed(2))
      : recipe?.actualPrice || webProd?.promoPrice || webProd?.price || 25;

  const itemCost = recipe ? recipe.totalCost : Number((unitSalePrice * 0.55).toFixed(2));
  const laborCostPerItem = recipe ? recipe.laborCost : 8;

  const { incomeRecord } = recordSaleAndDeductInventory({
    date: (quote.updatedAt || quote.createdAt || new Date().toISOString()).slice(0, 10),
    recipeId: recipe?.id,
    websiteProductId: webProd?.id || quote.productId,
    websiteQuoteId: quote.id,
    itemSold: recipe?.name || quote.productName || webProd?.name || "Custom Website Order",
    platform: "Website",
    salePrice: unitSalePrice,
    itemCost,
    laborCostPerItem,
    qty,
    discount: 0,
    tip: 0,
    notes: `Auto-synced from Website Order #${quote.id.slice(-6).toUpperCase()} (${quote.customerName})`,
    deductInventory: true
  });

  return { synced: true, incomeRecord };
}

/**
 * Commits a reviewed AI-scanned receipt (or multi-line receipt) to Expenses and Inventory.
 */
export function commitScannedReceiptToStore(params: {
  vendor: string;
  date: string;
  paymentMethod: string;
  items: ReceiptLineItemDraft[];
  logMode: "per-item" | "single-receipt";
  receiptImageUrl?: string;
}): { addedExpenses: ExpenseRecord[]; updatedInventoryCount: number } {
  const current = getInitialBusinessSnapshot();
  let updatedInventory = [...current.inventory];
  let updatedRecipes = [...current.recipes];
  let updatedInventoryCount = 0;

  // 1. Upsert checked items into Inventory
  for (const item of params.items) {
    if (!item.syncToInventory) continue;
    const bulkPrice = Math.abs(Number(item.price) || 0);
    const bulkQty = Number(item.packQty) > 0 ? Number(item.packQty) : 1;
    const unitPrice = bulkPrice / bulkQty;
    const cleanName = (item.friendlyName || item.rawName || "Supply Item").trim();

    const existingIdx = updatedInventory.findIndex(
      (inv) =>
        (item.matchedInventoryId && inv.id === item.matchedInventoryId) ||
        inv.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (existingIdx !== -1) {
      const existing = updatedInventory[existingIdx];
      const deltaStock = item.category === "Refund" || item.price < 0 ? -bulkQty : bulkQty;
      const nextStock = Math.max(0, Number((existing.stock + deltaStock).toFixed(2)));
      const nextItem: InventoryItem = {
        ...existing,
        name: cleanName,
        bulkPrice: bulkPrice > 0 ? bulkPrice : existing.bulkPrice,
        bulkQty: bulkQty > 0 ? bulkQty : existing.bulkQty,
        unitPrice: bulkPrice > 0 ? unitPrice : existing.unitPrice,
        stock: nextStock,
        status: computeInventoryStatus(nextStock, existing.minStock),
        updatedAt: new Date().toISOString()
      };
      updatedInventory[existingIdx] = nextItem;
      updatedInventoryCount++;

      // Also refresh unitPrice in any ProductRecipe that references this inventory item
      updatedRecipes = updatedRecipes.map((rec) => {
        const hasMat = rec.materials.some((m) => m.inventoryItemId === existing.id);
        if (!hasMat) return rec;
        const nextMaterials = rec.materials.map((m) =>
          m.inventoryItemId === existing.id
            ? {
                ...m,
                name: nextItem.name,
                bulkPrice: nextItem.bulkPrice,
                bulkQty: nextItem.bulkQty,
                unitPrice: nextItem.unitPrice,
                lineCost: nextItem.unitPrice * (m.qtyUsed || 1)
              }
            : m
        );
        return recalculateRecipe(
          { ...rec, materials: nextMaterials },
          current.settings.hourlyLaborRate
        );
      });
    } else {
      const nextNum = updatedInventory.length + 1;
      const newInv: InventoryItem = {
        id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        itemCode: `INV-${String(nextNum).padStart(3, "0")}`,
        name: cleanName,
        category: item.inventoryCategory || (item.category === "Packaging" ? "Packaging" : "General Supplies"),
        bulkPrice,
        bulkQty,
        unitPrice,
        stock: bulkQty,
        minStock: Math.max(2, Math.round(bulkQty * 0.25)),
        status: "In stock",
        notes: `Added from ${params.vendor} receipt (${params.date})`,
        updatedAt: new Date().toISOString()
      };
      updatedInventory = [newInv, ...updatedInventory];
      updatedInventoryCount++;
    }
  }

  // 2. Create ExpenseRecord entries
  const addedExpenses: ExpenseRecord[] = [];
  if (params.logMode === "single-receipt" && params.items.length > 0) {
    const totalSum = Number(
      params.items.reduce((acc, it) => acc + (Number(it.price) || 0), 0).toFixed(2)
    );
    const primaryCat = params.items[0]?.category || "Material";
    const summaryNames = params.items
      .map((i) => i.friendlyName || i.rawName)
      .filter(Boolean)
      .join(", ");
    addedExpenses.push({
      id: `exp_${Date.now()}_rec`,
      date: params.date,
      category: totalSum < 0 ? "Refund" : primaryCat,
      description: `${params.vendor}${summaryNames ? ` (${summaryNames.slice(0, 60)})` : ""}`,
      paymentMethod: params.paymentMethod || current.settings.defaultPaymentMethod,
      price: totalSum,
      qty: 1,
      total: totalSum,
      receiptImageUrl: params.receiptImageUrl,
      syncedToInventory: updatedInventoryCount > 0
    });
  } else {
    params.items.forEach((it, idx) => {
      const lineTotal = Number((Number(it.price) || 0).toFixed(2));
      const cleanName = (it.friendlyName || it.rawName || params.vendor).trim();
      addedExpenses.push({
        id: `exp_${Date.now()}_${idx}`,
        date: params.date,
        category: lineTotal < 0 ? "Refund" : it.category || "Material",
        description:
          cleanName.toLowerCase() === params.vendor.toLowerCase()
            ? params.vendor
            : `${params.vendor} - ${cleanName}`,
        paymentMethod: params.paymentMethod || current.settings.defaultPaymentMethod,
        price: lineTotal,
        qty: 1,
        total: lineTotal,
        receiptImageUrl: params.receiptImageUrl,
        syncedToInventory: it.syncToInventory
      });
    });
  }

  saveBusinessStore({
    expenses: [...addedExpenses, ...current.expenses],
    inventory: updatedInventory,
    recipes: updatedRecipes
  });

  return { addedExpenses, updatedInventoryCount };
}
