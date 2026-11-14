import { ExpenseCategory, InventoryItem, ReceiptLineItemDraft, ReceiptScanResult } from "./businessTypes";

const ABBREVIATION_MAP: Array<[RegExp, string, ExpenseCategory, number]> = [
  [/subl\w*\s*(ppr|paper)/i, "Sublimation Paper", "Material", 110],
  [/subl\w*\s*tape|heat\s*tape/i, "Sublimation Tape", "Material", 100],
  [/subl\w*\s*ink/i, "Sublimation Ink", "Material", 80],
  [/parch\w*\s*(ppr|paper)/i, "Parchment Paper", "Material", 20],
  [/11\s*oz.*mug.*col|color.*mug/i, "Mugs (11oz Color-Changing)", "Material", 1],
  [/11\s*oz.*mug/i, "Mugs (11oz Blank)", "Material", 6],
  [/15\s*oz.*mug/i, "Mugs (15oz Blank)", "Material", 6],
  [/stack\w*.*mug|10\s*oz.*mug/i, "Stackable Mugs (10oz Pack of 2)", "Material", 2],
  [/20\s*oz.*(tmblr|tumbler)/i, "Tumbler (20oz Skinny)", "Material", 10],
  [/apron/i, "Apron - Pockets", "Material", 4],
  [/easy\s*subli/i, "EasySubli HTV", "Material", 5],
  [/vinyl|htv|cricut\s*vnl|smart\s*vinyl/i, "Vinyl", "Material", 15],
  [/trans\w*\s*tape/i, "Transfer Tape", "Material", 80],
  [/pipe\s*cl\w*|chenille|fuzzy\s*stick/i, "Pipe Cleaner Set", "Material", 5],
  [/silic\w*|glue\s*stick|hot\s*glue/i, "Silicon (Hot Glue)", "Material", 100],
  [/floral\s*tape|stem\s*tape/i, "Tape (Floral)", "Material", 50],
  [/wrap\w*\s*(ppr|paper)|bouquet\s*wrap/i, "Wrapping Paper (Bouquet)", "Material", 3],
  [/liston|ribbon|satin\s*rib/i, "Liston (Satin Ribbon)", "Material", 4],
  [/trace\s*(ppr|paper)|tissue\s*(ppr|paper)/i, "Packaging Trace Paper", "Packaging", 200],
  [/pkg\s*bag|gift\s*bag|shopping\s*bag|tote\s*bag/i, "Packaging Bag", "Packaging", 150],
  [/pkg\s*box|gift\s*box|mug\s*box|mailer\s*box/i, "Packaging Box", "Packaging", 6],
  [/shrink\s*wrap/i, "Shrink Wrap", "Packaging", 10],
  [/led\s*lamp|acrylic\s*lamp|night\s*light/i, "LED Lamp Base & Acrylic", "Material", 12],
  [/heart\s*puzz/i, "Heart Puzzle Blank", "Material", 12],
  [/glass\s*orn/i, "Glass Ornament Blank", "Material", 24],
  [/coaster/i, "Coasters", "Material", 8],
  [/key\s*chain.*sport|jersey\s*key/i, "Keychain - Sports Shirt Blank", "Material", 30],
  [/key\s*chain/i, "Keychain - Photo Blank", "Material", 30],
  [/chatgpt|openai|canva|adobe/i, "Subscription Service", "Subscriptions", 1]
];

export function expandReceiptItemName(rawName: string): {
  friendlyName: string;
  category: ExpenseCategory;
  suggestedPackQty: number;
} {
  const clean = (rawName || "")
    .replace(/^\d{5,14}\s+/, "") // Strip leading barcode/SKU
    .replace(/\s+[A-Z]$/, "") // Strip trailing tax code letter
    .trim();

  for (const [regex, friendlyName, category, suggestedPackQty] of ABBREVIATION_MAP) {
    if (regex.test(clean)) {
      return { friendlyName, category, suggestedPackQty };
    }
  }

  // Check if pack count is mentioned in the item name (e.g. "6PK", "12 PACK", "100CT", "50 PCS")
  const packMatch = clean.match(/\b(\d{1,4})\s*(?:pk|pack|ct|count|pcs|pc|sheets|sht|rolls)\b/i);
  const extractedPackQty = packMatch ? Math.max(1, Number(packMatch[1])) : 1;

  const isRefund = /refund|return|credit/i.test(clean);
  const isPkg = /bag|box|tissue|wrap|ribbon|shipping|mailer|label|sticker/i.test(clean);
  const isOffice = /staple|pen|folder|binder|bookcase|desk|scissors|tape\s*disp/i.test(clean);
  const isSub = /chatgpt|canva|adobe|shopify|subscription|membership/i.test(clean);
  const isEquip = /printer|press|cricut\s*maker|cricut\s*explore|heat\s*press|mug\s*press|lamp\s*tool/i.test(clean);

  const friendlyName =
    clean
      .replace(/\bPPR\b/gi, "Paper")
      .replace(/\bSUBL\b/gi, "Sublimation")
      .replace(/\bPKG\b/gi, "Packaging")
      .replace(/\bTMBLR\b/gi, "Tumbler")
      .replace(/\bORNMNT\b/gi, "Ornament")
      .replace(/\bVNL\b/gi, "Vinyl")
      .replace(/\bWHT\b/gi, "White")
      .replace(/\bBLK\b/gi, "Black")
      .replace(/\bASST\b/gi, "Assorted")
      .replace(/\bLRG\b/gi, "Large")
      .replace(/\bSML\b/gi, "Small")
      .replace(/\bMED\b/gi, "Medium")
      .trim() || "Receipt Item";

  return {
    friendlyName,
    category: isRefund
      ? "Refund"
      : isSub
      ? "Subscriptions"
      : isEquip
      ? "Equipment"
      : isPkg
      ? "Packaging"
      : isOffice
      ? "Office Supplies"
      : "Material",
    suggestedPackQty: extractedPackQty
  };
}

/**
 * Match a friendly or raw item name to existing inventory if possible
 */
export function matchInventoryItem(
  friendlyName: string,
  rawName: string,
  inventory: InventoryItem[]
): InventoryItem | undefined {
  const fLower = friendlyName.toLowerCase().trim();
  const rLower = rawName.toLowerCase().trim();

  // Exact match
  const exact = inventory.find(
    (inv) => inv.name.toLowerCase().trim() === fLower || inv.name.toLowerCase().trim() === rLower
  );
  if (exact) return exact;

  // Substring / keyword match
  return inventory.find((inv) => {
    const iName = inv.name.toLowerCase().trim();
    return (
      (iName.length >= 4 && fLower.includes(iName)) ||
      (fLower.length >= 4 && iName.includes(fLower))
    );
  });
}

/**
 * Normalize vendor name
 */
function detectVendorFromText(text: string, fileName?: string): string {
  const combined = `${text}\n${fileName || ""}`;
  const vendorPatterns: Array<[RegExp, string]> = [
    [/\bmichaels|micheals\b/i, "Michaels"],
    [/\bdollarama\b/i, "Dollarama"],
    [/\bamazon(?:\.ca|\.com)?|amzn\b/i, "Amazon"],
    [/\bshein\b/i, "Shein"],
    [/\bstaples\b/i, "Staples"],
    [/\bdollar\s*tree\b/i, "Dollar Tree"],
    [/\bwinners\b/i, "Winners"],
    [/\bhomesense\b/i, "HomeSense"],
    [/\bmarshalls\b/i, "Marshalls"],
    [/\bwalmart|wal-mart\b/i, "Walmart"],
    [/\bcanadian\s*tire\b/i, "Canadian Tire"],
    [/\bcricut\b/i, "Cricut"],
    [/\btemu\b/i, "Temu"],
    [/\baliexpress\b/i, "AliExpress"],
    [/\bbuck\s*or\s*(?:two|2)\b/i, "Buck or 2"],
    [/\buline\b/i, "Uline"],
    [/\bvistaprint\b/i, "VistaPrint"],
    [/\bcanva\b/i, "Canva"],
    [/\bchatgpt|openai\b/i, "ChatGPT"]
  ];

  for (const [regex, name] of vendorPatterns) {
    if (regex.test(combined)) return name;
  }

  // Fallback: check the first non-empty alphabetical line of the receipt
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && /[a-zA-Z]{3,}/.test(l));
  if (lines.length > 0) {
    const first = lines[0].replace(/[^a-zA-Z0-9\s&'-]/g, "").trim();
    if (first.length >= 3 && first.length <= 28 && !/\d{2}\.\d{2}/.test(first)) {
      return first;
    }
  }
  return "Michaels";
}

/**
 * Detect receipt date in YYYY-MM-DD format
 */
function detectDateFromText(text: string): string {
  // 1. ISO YYYY-MM-DD or YYYY/MM/DD
  const iso = text.match(/\b(202\d)[/-](0[1-9]|1[0-2])[/-](0[1-9]|[12]\d|3[01])\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // 2. MM/DD/YYYY or DD/MM/YYYY or MM-DD-YY
  const slash = text.match(/\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])[/-](202\d|2\d)\b/);
  if (slash) {
    const yr = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    const mm = slash[1].padStart(2, "0");
    const dd = slash[2].padStart(2, "0");
    return `${yr}-${mm}-${dd}`;
  }

  // 3. Month name: "Jan 15, 2026" or "15 May 2026" or "May 12, 2026"
  const monthNames: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12"
  };
  const namedMonth1 = text.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(202\d)\b/i
  );
  if (namedMonth1) {
    const mm = monthNames[namedMonth1[1].slice(0, 3).toLowerCase()] || "01";
    const dd = namedMonth1[2].padStart(2, "0");
    return `${namedMonth1[3]}-${mm}-${dd}`;
  }

  const namedMonth2 = text.match(
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?,?\s+(202\d)\b/i
  );
  if (namedMonth2) {
    const dd = namedMonth2[1].padStart(2, "0");
    const mm = monthNames[namedMonth2[2].slice(0, 3).toLowerCase()] || "01";
    return `${namedMonth2[3]}-${mm}-${dd}`;
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Detect payment method from receipt text
 */
function detectPaymentMethodFromText(text: string): string {
  const visaLast4 = text.match(/\bVISA\b[^\d\n]*(?:\*+|x+|\.+)?(\d{4})\b/i);
  if (visaLast4) return `VISA ${visaLast4[1]}`;
  if (/\bVISA\b/i.test(text)) return "VISA 7992";
  if (/\bMASTERCARD|MC\b/i.test(text)) return "Mastercard";
  if (/\bAMEX|AMERICAN\s*EXPRESS\b/i.test(text)) return "Amex";
  if (/\bINTERAC|DEBIT\b/i.test(text)) return "Debit / Interac";
  if (/\bPAYPAL\b/i.test(text)) return "PayPal";
  if (/\bCASH\b/i.test(text)) return "Cash";
  return "VISA 7992";
}

const IGNORE_LINE_REGEX =
  /^(?:sub\s*total|subtotal|total|order\s*total|grand\s*total|item\s*subtotal|shipping\s*&?\s*handling|free\s*shipping|estimated\s*tax|sales\s*tax|hst|gst|pst|qst|tax|vat|visa|mastercard|amex|debit|interac|cash|change|change\s*due|tender|amount\s*tendered|balance|balance\s*due|auth\s*#|approval|approved|aid:|tvr:|tsi:|terminal|merchant|trans(?:action)?|trace|ref\s*#|invoice|receipt|customer\s*copy|cardholder|thank\s*you|thanks\s*for|visit\s*us|survey|www\.|http|tel:|phone|store\s*#|cashier|register|associate|member|rewards|points|you\s*saved|total\s*savings|discount\s*total|coupon|promo|sold\s*by|shipped\s*by|delivery|arriving|track\s*package|view\s*order|order\s*#|placed\s*on|payment\s*method|billing\s*address|shipping\s*address|canada\s*post)/i;

const ADDRESS_OR_PHONE_REGEX =
  /(?:\b\d{3}[-.)\s]\d{3}[-.\s]\d{4}\b|\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b|\b(?:st|ave|rd|blvd|dr|hwy|suite|unit)\b.*,\s*[A-Z]{2}\b)/i;

export interface ParsedReceiptExtended extends ReceiptScanResult {
  subtotalAmount?: number;
  taxAmount?: number;
  receiptTotalAmount?: number;
}

/**
 * Comprehensive multi-format receipt text parser.
 * Extracts individual line items, prices, quantities, subtotal, tax, and total
 * from thermal store receipts (Michaels, Dollarama, Walmart, Staples) AND
 * online invoices/screenshots (Amazon, Shein, Temu, Cricut).
 */
export function parseReceiptText(
  rawText: string,
  fileName?: string,
  existingInventory: InventoryItem[] = []
): ParsedReceiptExtended {
  const cleanedText = (rawText || "")
    // Fix common OCR substitutions in prices: e.g. "$ 12,99" -> "$12.99", "S12.99" -> "$12.99"
    .replace(/\bS(\d{1,4}\.\d{2})\b/g, "$$$1")
    .replace(/(\$\s*\d{1,4}),(\d{2})\b/g, "$1.$2")
    .replace(/(\d{1,4})\s+\.\s*(\d{2})\b/g, "$1.$2");

  const vendor = detectVendorFromText(cleanedText, fileName);
  const date = detectDateFromText(cleanedText);
  const paymentMethod = detectPaymentMethodFromText(cleanedText);

  const rawLines = cleanedText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);

  let subtotalAmount: number | undefined;
  let taxAmount: number | undefined;
  let receiptTotalAmount: number | undefined;

  // First pass: detect subtotal, tax, and total at bottom of receipt
  for (const line of rawLines) {
    const priceMatches = [...line.matchAll(/(-?\d{1,5}\.\d{2})\b/g)];
    if (priceMatches.length === 0) continue;
    const lastPrice = Number(priceMatches[priceMatches.length - 1][1]);

    if (/\b(?:sub\s*total|subtotal|item\s*subtotal|merchandise\s*subtotal)\b/i.test(line)) {
      subtotalAmount = lastPrice;
    } else if (
      /\b(?:hst|gst|pst|qst|sales\s*tax|estimated\s*tax|tax\s*to\s*be\s*collected|\d+(?:\.\d+)?%\s*(?:hst|gst|tax)|\btax\b)\b/i.test(
        line
      )
    ) {
      if (lastPrice > 0 && lastPrice < 1000) {
        taxAmount = Number(((taxAmount || 0) + lastPrice).toFixed(2));
      }
    } else if (
      /(?:^|\b)(?:grand\s*total|order\s*total|total\s*purchase|total\s*cad|total\s*amount|total)\b/i.test(
        line
      ) &&
      !/\b(?:savings|discount|items|qty|sub|before\s*tax)\b/i.test(line)
    ) {
      if (lastPrice !== 0) {
        receiptTotalAmount = lastPrice;
      }
    }
  }

  const extractedItems: ReceiptLineItemDraft[] = [];
  let pendingItemName = "";
  let pendingQty = 1;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Check if this line is a standalone Quantity indicator (e.g. "Qty: 2" or "Quantity: 4")
    const standaloneQtyMatch = line.match(/^(?:qty|quantity)\s*[:=-]?\s*(\d{1,4})$/i);
    if (standaloneQtyMatch) {
      pendingQty = Math.max(1, Number(standaloneQtyMatch[1]) || 1);
      continue;
    }

    // Skip obvious non-item lines
    if (IGNORE_LINE_REGEX.test(line) || ADDRESS_OR_PHONE_REGEX.test(line)) {
      pendingItemName = "";
      continue;
    }

    // Skip date-only or time-only lines
    if (/^[\d/:\-\s]+(?:AM|PM)?$/i.test(line)) {
      continue;
    }

    // Check if this line is a quantity-at-unit-price line (e.g. "2 @ $1.50   3.00" or "3 @ 1.25")
    const qtyAtMatch = line.match(
      /^(\d{1,3})\s*(?:@|x|X|\*)\s*(?:CDN\$|CA\$|\$)?\s*(\d{1,4}\.\d{2})(?:\s+(?:CDN\$|CA\$|\$)?\s*(-?\d{1,5}\.\d{2}))?/
    );
    if (qtyAtMatch) {
      const qtyCount = Number(qtyAtMatch[1]) || 1;
      const unitP = Number(qtyAtMatch[2]) || 0;
      const lineTotal = qtyAtMatch[3] ? Number(qtyAtMatch[3]) : Number((qtyCount * unitP).toFixed(2));

      if (pendingItemName && lineTotal > 0) {
        addExtractedItem(pendingItemName, lineTotal, qtyCount);
        pendingItemName = "";
        pendingQty = 1;
        continue;
      } else {
        pendingQty = qtyCount;
      }
    }

    // Check if line has a price at the end:
    // Supports: "SUBL PPR 8.5X11   $43.69 H", "0400123456 MUG 11OZ  26.45", "CDN$ 55.41"
    const linePriceMatch = line.match(
      /^(.*?)(?:\s+(?:x|qty:?)\s*(\d{1,3}))?\s+(?:CDN\$|CA\$|US\$|\$)?\s*(-?\d{1,4}\.\d{2})\s*(?:[A-Z*]{1,3}|CAD)?$/i
    );

    if (linePriceMatch) {
      let namePart = linePriceMatch[1]
        .replace(/^(?:CDN\$|CA\$|US\$|\$)+/i, "")
        .replace(/[-–—:.$]+$/, "")
        .trim();
      const explicitQty = linePriceMatch[2] ? Number(linePriceMatch[2]) : pendingQty;
      const price = Number(linePriceMatch[3]);

      // Strip leading barcode / SKU numbers if followed by text
      namePart = namePart.replace(/^\d{5,14}\s+/, "").trim();

      // If namePart is empty or just a barcode/SKU, use pendingItemName from previous line!
      if ((!namePart || /^\d+$/.test(namePart) || /^price$/i.test(namePart)) && pendingItemName) {
        namePart = pendingItemName;
      }

      // Make sure namePart isn't a footer keyword
      if (
        namePart &&
        /[a-zA-Z]{2,}/.test(namePart) &&
        !IGNORE_LINE_REGEX.test(namePart) &&
        !isNaN(price) &&
        price !== 0 &&
        Math.abs(price) < 10000
      ) {
        addExtractedItem(namePart, price, explicitQty);
        pendingItemName = "";
        pendingQty = 1;
        continue;
      }
    }

    // Check if line is ONLY a price (common on Amazon / Shein / multi-line receipts where item name was on previous line)
    const standalonePriceMatch = line.match(
      /^(?:Price:\s*|Item\s*Price:\s*)?(?:CDN\$|CA\$|US\$|\$)\s*(-?\d{1,4}\.\d{2})\b/i
    );
    if (standalonePriceMatch && pendingItemName) {
      const price = Number(standalonePriceMatch[1]);
      if (!isNaN(price) && price !== 0) {
        addExtractedItem(pendingItemName, price, pendingQty);
        pendingItemName = "";
        pendingQty = 1;
        continue;
      }
    }

    // Check if line is a descriptive product title (without a price yet) — store as pendingItemName for the next line
    const cleanCandidate = line.replace(/^\d{5,14}\s+/, "").trim();
    if (
      cleanCandidate.length >= 3 &&
      cleanCandidate.length <= 120 &&
      /[a-zA-Z]{3,}/.test(cleanCandidate) &&
      !IGNORE_LINE_REGEX.test(cleanCandidate) &&
      !ADDRESS_OR_PHONE_REGEX.test(cleanCandidate) &&
      !/^(?:michaels|dollarama|amazon|shein|staples|walmart|winners|dollar\s*tree)$/i.test(
        cleanCandidate
      )
    ) {
      pendingItemName = cleanCandidate;
    }
  }

  function addExtractedItem(rawName: string, price: number, detectedQty = 1) {
    const exp = expandReceiptItemName(rawName);
    const matchedInv = matchInventoryItem(exp.friendlyName, rawName, existingInventory);
    const packQty =
      detectedQty > 1
        ? detectedQty
        : matchedInv
        ? matchedInv.bulkQty
        : exp.suggestedPackQty || 1;
    const category: ExpenseCategory =
      price < 0 ? "Refund" : (exp.category as ExpenseCategory);

    extractedItems.push({
      id: `scan_${Date.now()}_${extractedItems.length}`,
      rawName,
      friendlyName: matchedInv ? matchedInv.name : exp.friendlyName,
      category,
      price: Number(price.toFixed(2)),
      packQty,
      unitPrice: Number((price / packQty).toFixed(4)),
      syncToInventory: category === "Material" || category === "Packaging",
      matchedInventoryId: matchedInv?.id,
      inventoryCategory: matchedInv?.category || category
    });
  }

  // If no individual items matched but a Receipt Total was found on the receipt, create 1 item with the exact Receipt Total
  if (extractedItems.length === 0 && receiptTotalAmount && receiptTotalAmount !== 0) {
    const exp = expandReceiptItemName(vendor);
    extractedItems.push({
      id: `scan_${Date.now()}_0`,
      rawName: `${vendor} Receipt Total`,
      friendlyName: `${vendor} Supplies`,
      category: receiptTotalAmount < 0 ? "Refund" : exp.category,
      price: Number(receiptTotalAmount.toFixed(2)),
      packQty: 1,
      unitPrice: Number(receiptTotalAmount.toFixed(4)),
      syncToInventory: false
    });
  }

  const itemsSum = Number(
    extractedItems.reduce((sum, it) => sum + (Number(it.price) || 0), 0).toFixed(2)
  );
  const totalAmount = receiptTotalAmount || itemsSum;

  return {
    vendor,
    date,
    paymentMethod,
    totalAmount,
    subtotalAmount,
    taxAmount,
    receiptTotalAmount,
    isRefund: totalAmount < 0,
    items: extractedItems,
    rawText: cleanedText
  };
}

/**
 * Load an external script once in the browser
 */
const loadedScripts: Record<string, Promise<void>> = {};
function loadExternalScript(src: string): Promise<void> {
  if (loadedScripts[src]) return loadedScripts[src];
  loadedScripts[src] = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
  return loadedScripts[src];
}

/**
 * Compress and preprocess an image File into:
 * 1) A compact JPEG Data URL (< 350KB) for preview and API calls
 * 2) A high-contrast preprocessed canvas Data URL for accurate optical character recognition (OCR)
 */
export async function preprocessReceiptImage(file: File): Promise<{
  previewDataUrl: string;
  ocrDataUrl: string;
}> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode image"));
    el.src = rawDataUrl;
  });

  const maxDim = 1800;
  let width = img.width;
  let height = img.height;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  } else if (width < 900 && height < 900) {
    // Upscale small screenshots slightly so OCR reads tiny numbers clearly
    width = Math.round(width * 1.5);
    height = Math.round(height * 1.5);
  }

  // 1. Clean resized preview JPEG
  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = width;
  previewCanvas.height = height;
  const pCtx = previewCanvas.getContext("2d")!;
  pCtx.fillStyle = "#FFFFFF";
  pCtx.fillRect(0, 0, width, height);
  pCtx.drawImage(img, 0, 0, width, height);
  const previewDataUrl = previewCanvas.toDataURL("image/jpeg", 0.84);

  // 2. High-contrast grayscale sharpening for OCR accuracy on thermal receipts
  const ocrCanvas = document.createElement("canvas");
  ocrCanvas.width = width;
  ocrCanvas.height = height;
  const oCtx = ocrCanvas.getContext("2d")!;
  oCtx.fillStyle = "#FFFFFF";
  oCtx.fillRect(0, 0, width, height);
  oCtx.drawImage(img, 0, 0, width, height);

  try {
    const imageData = oCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Boost contrast so thermal ink stands out from paper background
      const contrasted = gray < 165 ? Math.max(0, (gray - 165) * 1.6 + 120) : Math.min(255, gray * 1.15);
      data[i] = contrasted;
      data[i + 1] = contrasted;
      data[i + 2] = contrasted;
    }
    oCtx.putImageData(imageData, 0, 0);
  } catch {
    // Fallback if canvas taint occurs
  }

  const ocrDataUrl = ocrCanvas.toDataURL("image/png");
  return { previewDataUrl, ocrDataUrl };
}

/**
 * Extract digital text (preserving horizontal lines) and a rendered page image from a PDF file
 */
export async function extractPdfReceiptContent(
  file: File,
  onProgress?: (status: string) => void
): Promise<{ text: string; pageImageDataUrl?: string }> {
  onProgress?.("Loading PDF reader...");
  await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) {
    throw new Error("PDF reader library failed to initialize");
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  let firstPageImage: string | undefined;

  const maxPages = Math.min(pdf.numPages, 3);
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    onProgress?.(`Reading PDF page ${pageNum} of ${maxPages}...`);
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group PDF text items by Y coordinate so items & prices on the same row stay on the same line
    const rows: Array<{ y: number; items: Array<{ x: number; str: string }> }> = [];
    for (const item of textContent.items as any[]) {
      const str = (item.str || "").trim();
      if (!str) continue;
      const x = item.transform ? item.transform[4] : 0;
      const y = item.transform ? item.transform[5] : 0;
      let row = rows.find((r) => Math.abs(r.y - y) < 5);
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push({ x, str });
    }

    // Sort top-to-bottom (PDF Y coordinate goes bottom-up), and left-to-right within each row
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      fullText += row.items.map((i) => i.str).join("   ") + "\n";
    }

    // Render page 1 to canvas for preview & fallback OCR if scanned PDF
    if (pageNum === 1) {
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      firstPageImage = canvas.toDataURL("image/jpeg", 0.85);
    }
  }

  return { text: fullText.trim(), pageImageDataUrl: firstPageImage };
}

/**
 * Run browser-based Optical Character Recognition (Tesseract.js v5) on a receipt image
 */
export async function runImageOcrInBrowser(
  imageDataUrl: string,
  onProgress?: (status: string) => void
): Promise<string> {
  onProgress?.("Loading OCR engine...");
  await loadExternalScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
  const Tesseract = (window as any).Tesseract;
  if (!Tesseract) {
    throw new Error("OCR engine could not be loaded");
  }

  const result = await Tesseract.recognize(imageDataUrl, "eng", {
    logger: (m: any) => {
      if (m && m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(`Reading receipt text (${Math.round(m.progress * 100)}%)...`);
      }
    }
  });

  return (result?.data?.text || "").trim();
}
