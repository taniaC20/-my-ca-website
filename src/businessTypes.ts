export type InventoryStatus =
  | "In stock"
  | "Temporarily unavailable"
  | "Re-purchase needed"
  | "Sold out";

export type ExpenseCategory =
  | "Material"
  | "Packaging"
  | "Marketing"
  | "Office Supplies"
  | "Subscriptions"
  | "Equipment"
  | "Other"
  | "Refund";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Material",
  "Packaging",
  "Marketing",
  "Office Supplies",
  "Subscriptions",
  "Equipment",
  "Other",
  "Refund"
];

export type SalesPlatform =
  | "Website"
  | "Marketplace"
  | "JP Baskets"
  | "Instagram"
  | "Facebook"
  | "Friend"
  | "In-Person Market"
  | "Custom Client";

export const SALES_PLATFORMS: string[] = [
  "Website",
  "Marketplace",
  "JP Baskets",
  "Instagram",
  "Facebook",
  "Friend",
  "In-Person Market",
  "Custom Client"
];

export type ProductCraftCategory =
  | "Sublimation"
  | "Vinyl"
  | "Pipe Cleaner Floral"
  | "Other";

export const PRODUCT_CRAFT_CATEGORIES: string[] = [
  "Sublimation",
  "Vinyl",
  "Pipe Cleaner Floral",
  "Other"
];

export interface InventoryItem {
  id: string;
  itemCode: string; // e.g., "INV-001"
  name: string;
  category: string; // e.g., "Sublimation", "Packaging", "Vinyl", "Floral", "Blanks", "General"
  bulkPrice: number; // Price paid for pack/bulk
  bulkQty: number; // #Items in pack/bulk
  unitPrice: number; // Calculated: bulkPrice / bulkQty
  stock: number; // Current units in stock
  minStock: number; // Reorder alert threshold
  status: InventoryStatus;
  notes?: string;
  updatedAt?: string;
}

export interface RecipeMaterialLine {
  id: string;
  inventoryItemId?: string;
  name: string;
  bulkPrice: number;
  bulkQty: number;
  unitPrice: number; // bulkPrice / bulkQty
  qtyUsed: number; // Quantity of this unit used per 1 finished product (default 1)
  lineCost: number; // unitPrice * qtyUsed
}

export interface ProductRecipe {
  id: string;
  name: string;
  category: string; // "Sublimation" | "Vinyl" | "Pipe Cleaner Floral" | "Other"
  websiteProductId?: string; // Optional link to website catalog Product.id
  materials: RecipeMaterialLine[];
  materialCost: number; // Sum of materials lineCost
  laborMinutes: number; // e.g., 20
  laborHours: number; // laborMinutes / 60 (e.g., 0.3333333333)
  laborCost: number; // laborHours * hourlyLaborRate
  advertisingCost: number; // default 0
  totalCost: number; // materialCost + laborCost + advertisingCost ("Item Cost" in Products/Income tabs)
  desiredProfitPct: number; // e.g., 0.15 for 15%, 0.25 for 25%
  calculatedPrice: number; // totalCost / (1 - desiredProfitPct) ("Final Sale Price" / "Calculated Price")
  actualPrice: number; // Actual selling price on website / market ("Price")
  profitPerItem: number; // actualPrice - totalCost
  notes?: string;
  updatedAt?: string;
}

export interface IncomeRecord {
  id: string;
  date: string; // YYYY-MM-DD
  recipeId?: string;
  websiteProductId?: string;
  websiteQuoteId?: string; // If synced from website QuoteRequest
  itemSold: string;
  platform: string; // Marketplace, JP Baskets, Instagram, Facebook, Friend, Website, etc.
  salePrice: number;
  itemCost: number; // Total Cost (Material + Labor + Ad) per item
  laborCostPerItem: number;
  profitPerItem: number; // salePrice - itemCost
  qty: number;
  totalLaborCost: number; // laborCostPerItem * qty
  discount: number; // Dollar discount (default 0)
  tip: number; // Dollar tip (default 0)
  totalIncome: number; // ((salePrice * qty) - discount) + tip
  totalProfit: number; // (((salePrice - itemCost) * qty) - discount) + tip
  notes?: string;
  inventoryDeducted?: boolean;
}

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string; // Vendor/Store or item description (e.g., "Michaels", "Amazon", "Dollarama")
  paymentMethod: string; // e.g., "VISA 7992"
  price: number; // Unit or receipt price (negative for Refund)
  qty: number;
  total: number; // price * qty
  notes?: string;
  receiptImageUrl?: string;
  syncedToInventory?: boolean;
  inventoryItemId?: string;
}

export interface ReceiptLineItemDraft {
  id: string;
  rawName: string;
  friendlyName: string;
  category: ExpenseCategory;
  price: number; // Total price paid for this line/pack
  packQty: number; // Number of units inside the pack (for unit cost calculation)
  unitPrice: number; // price / packQty
  syncToInventory: boolean;
  matchedInventoryId?: string; // If linked to an existing InventoryItem
  inventoryCategory?: string;
}

export interface ReceiptScanResult {
  vendor: string;
  date: string;
  paymentMethod: string;
  totalAmount: number;
  isRefund?: boolean;
  items: ReceiptLineItemDraft[];
  rawText?: string;
}

export interface BusinessSettings {
  hourlyLaborRate: number; // Default 16 ($16.00/hr)
  defaultProfitMargin: number; // Default 0.25 (25%)
  defaultPaymentMethod: string; // Default "VISA 7992"
  autoSyncWebsiteOrders: boolean;
  autoDeductInventory: boolean;
  geminiApiKey?: string;
}

export interface BusinessStoreSnapshot {
  updatedAt: string;
  updatedAtMs: number;
  settings: BusinessSettings;
  inventory: InventoryItem[];
  recipes: ProductRecipe[];
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
}

/**
 * Exact spreadsheet formula helpers
 */
export function computeInventoryStatus(
  stock: number,
  minStock = 5,
  currentStatus?: InventoryStatus
): InventoryStatus {
  if (currentStatus === "Temporarily unavailable") {
    return "Temporarily unavailable";
  }
  if (stock <= 0) return "Sold out";
  if (stock <= minStock) return "Re-purchase needed";
  return "In stock";
}

export function recalculateRecipe(
  recipe: Partial<ProductRecipe>,
  hourlyLaborRate = 16
): ProductRecipe {
  const materials: RecipeMaterialLine[] = (recipe.materials || []).map((m, idx) => {
    const bulkPrice = Number(m.bulkPrice) || 0;
    const bulkQty = Number(m.bulkQty) > 0 ? Number(m.bulkQty) : 1;
    const unitPrice = bulkPrice / bulkQty;
    const qtyUsed = m.qtyUsed !== undefined && Number(m.qtyUsed) > 0 ? Number(m.qtyUsed) : 1;
    const lineCost = unitPrice * qtyUsed;
    return {
      id: m.id || `mat_${idx}_${Date.now()}`,
      inventoryItemId: m.inventoryItemId,
      name: m.name || "Material",
      bulkPrice,
      bulkQty,
      unitPrice,
      qtyUsed,
      lineCost
    };
  });

  const computedMatCost = materials.reduce((sum, m) => sum + m.lineCost, 0);
  const materialCost =
    materials.length > 0 ? computedMatCost : Number(recipe.materialCost) || 0;

  const laborMinutes = Number(recipe.laborMinutes) || 0;
  const laborHours =
    recipe.laborHours !== undefined && laborMinutes === 0
      ? Number(recipe.laborHours)
      : laborMinutes / 60;

  const laborCost =
    recipe.laborCost !== undefined && materials.length === 0 && recipe.materialCost === undefined
      ? Number(recipe.laborCost)
      : laborHours * hourlyLaborRate;

  const advertisingCost = Number(recipe.advertisingCost) || 0;
  const totalCost =
    materials.length > 0 || materialCost > 0
      ? materialCost + laborCost + advertisingCost
      : Number(recipe.totalCost) || 0;

  const desiredProfitPct =
    recipe.desiredProfitPct !== undefined ? Number(recipe.desiredProfitPct) : 0.25;
  const denom = 1 - desiredProfitPct;
  const calculatedPrice = denom > 0 && totalCost > 0 ? totalCost / denom : totalCost;
  const actualPrice =
    recipe.actualPrice !== undefined ? Number(recipe.actualPrice) : Math.round(calculatedPrice);
  const profitPerItem = actualPrice > 0 && totalCost > 0 ? actualPrice - totalCost : 0;

  return {
    id: recipe.id || `rec_${Date.now()}`,
    name: recipe.name || "Untitled Product",
    category: recipe.category || "Sublimation",
    websiteProductId: recipe.websiteProductId,
    materials,
    materialCost,
    laborMinutes: laborMinutes || Math.round(laborHours * 60),
    laborHours,
    laborCost,
    advertisingCost,
    totalCost,
    desiredProfitPct,
    calculatedPrice,
    actualPrice,
    profitPerItem,
    notes: recipe.notes,
    updatedAt: new Date().toISOString()
  };
}

export function computeIncomeRow(input: {
  id?: string;
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
  inventoryDeducted?: boolean;
}): IncomeRecord {
  const salePrice = Number(input.salePrice) || 0;
  const itemCost = Number(input.itemCost) || 0;
  const laborCostPerItem = Number(input.laborCostPerItem) || 0;
  const qty = Number(input.qty) > 0 ? Number(input.qty) : 1;
  const discount = Number(input.discount) || 0;
  const tip = Number(input.tip) || 0;

  const profitPerItem = salePrice - itemCost;
  const totalLaborCost = laborCostPerItem * qty;
  const totalIncome = salePrice * qty - discount + tip;
  const totalProfit = (salePrice - itemCost) * qty - discount + tip;

  return {
    id: input.id || `inc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date: input.date || new Date().toISOString().slice(0, 10),
    recipeId: input.recipeId,
    websiteProductId: input.websiteProductId,
    websiteQuoteId: input.websiteQuoteId,
    itemSold: input.itemSold,
    platform: input.platform || "Marketplace",
    salePrice,
    itemCost,
    laborCostPerItem,
    profitPerItem,
    qty,
    totalLaborCost,
    discount,
    tip,
    totalIncome,
    totalProfit,
    notes: input.notes,
    inventoryDeducted: input.inventoryDeducted
  };
}
