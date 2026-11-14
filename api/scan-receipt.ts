import { GoogleGenAI, Type } from "@google/genai";
import { expandReceiptItemName, parseReceiptText } from "../src/receiptOcrEngine";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { imageDataUrl, rawText, fileName, apiKey } = req.body || {};
  const resolvedKey = (apiKey || process.env.GEMINI_API_KEY || "").trim();

  // 1. If Gemini API key is available and not placeholder, use Gemini 2.5 Flash Vision / Document OCR
  if (resolvedKey && resolvedKey !== "MY_GEMINI_API_KEY") {
    try {
      const ai = new GoogleGenAI({ apiKey: resolvedKey });
      const parts: any[] = [];

      if (imageDataUrl && typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:")) {
        const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          });
        }
      }

      const promptText = `You are an expert accounting & inventory receipt OCR assistant for "Nicoletta Crafts & Decor" (a custom sublimation, vinyl, engraving, and pipe-cleaner floral studio).
Extract the receipt details from this ${imageDataUrl ? "image/PDF" : "receipt text"}.
${rawText ? `\nReceipt Text:\n${rawText}\n` : ""}
Rules:
1. Identify the vendor/store name (e.g., Michaels, Dollarama, Amazon, Shein, Staples, Dollar Tree, Winners, Walmart).
2. Identify the receipt date in YYYY-MM-DD format (default to today's 2026 date if missing).
3. Identify the payment method (e.g., "VISA 7992" if Visa or unknown card).
4. Extract every individual line item purchased. Do NOT include Subtotal, Tax/HST, or Total as line items. For each line item:
   - "rawName": exact text on receipt (e.g. "3x PIPE CLEANERS 300PCS")
   - "friendlyName": human-friendly craft material name (e.g. "Pipe Cleaner Set", "Sublimation Paper", "Sublimation Tape", "Mugs (11oz Blank)", "Packaging Trace Paper")
   - "category": one of "Material", "Packaging", "Marketing", "Office Supplies", "Subscriptions", "Equipment", "Other", "Refund"
   - "qtyBought": how many packs/items of this line were bought (e.g. 3 if the customer bought 3 packs, or 1 if 1 pack)
   - "packQty": how many individual pieces/sheets/units are inside 1 pack (e.g. 300 for a 300-piece pack of pipe cleaners, 6 for a 6-pack of mugs, 100 for a 100-sheet pack, or 1 if single piece)
   - "price": total line price paid for all packs bought on this line (use negative number if refund/return)`;

      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vendor: { type: Type.STRING },
              date: { type: Type.STRING },
              paymentMethod: { type: Type.STRING },
              totalAmount: { type: Type.NUMBER },
              taxAmount: { type: Type.NUMBER },
              isRefund: { type: Type.BOOLEAN },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    rawName: { type: Type.STRING },
                    friendlyName: { type: Type.STRING },
                    category: { type: Type.STRING },
                    qtyBought: { type: Type.NUMBER },
                    price: { type: Type.NUMBER },
                    packQty: { type: Type.NUMBER }
                  },
                  required: ["rawName", "friendlyName", "category", "qtyBought", "price", "packQty"]
                }
              }
            },
            required: ["vendor", "date", "paymentMethod", "totalAmount", "items"]
          }
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        const enrichedItems = parsed.items.map((it: any, idx: number) => {
          const exp = expandReceiptItemName(it.rawName || it.friendlyName || "Item");
          const qtyBought = Math.max(1, Number(it.qtyBought) || 1);
          const packQty =
            Number(it.packQty) > 1
              ? Number(it.packQty)
              : exp.hasExplicitPackQty
              ? exp.suggestedPackQty
              : Number(it.packQty) > 0
              ? Number(it.packQty)
              : exp.suggestedPackQty;
          const totalPieces = qtyBought * packQty;
          const price = Number(it.price) || 0;
          return {
            id: `scan_${Date.now()}_${idx}`,
            rawName: it.rawName || it.friendlyName || "Receipt Item",
            friendlyName: it.friendlyName || exp.friendlyName,
            category: it.category || exp.category,
            qtyBought,
            price,
            packQty,
            unitPrice: Number((price / totalPieces).toFixed(4)),
            syncToInventory:
              (it.category || exp.category) === "Material" ||
              (it.category || exp.category) === "Packaging"
          };
        });

        return res.status(200).json({
          success: true,
          method: "gemini-vision",
          result: {
            vendor: parsed.vendor || "Michaels",
            date: parsed.date || new Date().toISOString().slice(0, 10),
            paymentMethod: parsed.paymentMethod || "VISA 7992",
            totalAmount:
              Number(parsed.totalAmount) ||
              enrichedItems.reduce((s: number, i: any) => s + i.price, 0),
            taxAmount: Number(parsed.taxAmount) || undefined,
            isRefund: Boolean(parsed.isRefund),
            items: enrichedItems
          }
        });
      }
    } catch (aiErr: any) {
      console.warn("Gemini receipt scan fallback triggered:", aiErr?.message || aiErr);
    }
  }

  // 2. Multi-format receipt parser on extracted OCR / PDF text
  if (rawText && typeof rawText === "string" && rawText.trim().length > 0) {
    const parsedResult = parseReceiptText(rawText, fileName);
    return res.status(200).json({
      success: true,
      method: "smart-parser",
      result: parsedResult
    });
  }

  return res.status(200).json({
    success: false,
    requiresClientOcr: true,
    error: "No Gemini API key configured on server; use browser OCR."
  });
}
