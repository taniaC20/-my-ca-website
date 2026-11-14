import React, { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  Package,
  Calculator,
  Receipt,
  PieChart,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  Upload,
  Sparkles,
  Search,
  Download,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  Layers,
  Clock,
  ShoppingBag,
  FileText,
  Sliders,
  Eye
} from "lucide-react";
import { Product, QuoteRequest } from "../types";
import {
  BusinessStoreSnapshot,
  InventoryItem,
  InventoryStatus,
  ProductRecipe,
  RecipeMaterialLine,
  IncomeRecord,
  ExpenseRecord,
  ExpenseCategory,
  EXPENSE_CATEGORIES,
  SALES_PLATFORMS,
  PRODUCT_CRAFT_CATEGORIES,
  ReceiptLineItemDraft,
  computeInventoryStatus,
  recalculateRecipe,
  computeIncomeRow
} from "../businessTypes";
import {
  extractPdfReceiptContent,
  parseReceiptText,
  preprocessReceiptImage,
  runImageOcrInBrowser
} from "../receiptOcrEngine";
import {
  getInitialBusinessSnapshot,
  loadBusinessStore,
  saveBusinessStore,
  subscribeBusinessStore,
  recordSaleAndDeductInventory,
  commitScannedReceiptToStore,
  syncCompletedWebsiteOrder
} from "../businessStore";

interface BusinessTrackerProps {
  websiteProducts: Product[];
  websiteQuotes: QuoteRequest[];
  onUpdateWebsiteProducts: (products: Product[]) => void;
}

type TrackerSubTab =
  | "summary"
  | "expenses"
  | "inventory"
  | "item-pricing"
  | "products"
  | "income";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

function fmtMoney(val: number | undefined | null, decimals = 2): string {
  const n = Number(val) || 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-CA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
}

/**
 * Interactive SVG Bar Chart Component
 */
const InteractiveBarChart: React.FC<{
  title: string;
  subtitle?: string;
  data: Array<{ label: string; value: number; secondaryValue?: number; color?: string }>;
  primaryColor?: string;
  secondaryColor?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
}> = ({
  title,
  subtitle,
  data,
  primaryColor = "#936037",
  secondaryColor = "#10b981",
  primaryLabel = "Amount",
  secondaryLabel
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const maxVal = Math.max(
    1,
    ...data.map((d) => Math.max(Math.abs(d.value), Math.abs(d.secondaryValue || 0)))
  );

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <h4 className="font-serif font-bold text-stone-900 text-base">{title}</h4>
          {subtitle && <p className="text-[11px] text-stone-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold">
          <span className="flex items-center gap-1 text-stone-700">
            <span className="w-2.5 h-2.5 rounded-xs inline-block" style={{ backgroundColor: primaryColor }} />
            {primaryLabel}
          </span>
          {secondaryLabel && (
            <span className="flex items-center gap-1 text-stone-700">
              <span className="w-2.5 h-2.5 rounded-xs inline-block" style={{ backgroundColor: secondaryColor }} />
              {secondaryLabel}
            </span>
          )}
        </div>
      </div>

      <div className="relative h-56 flex items-end gap-2 pt-8 pb-6 px-2 border-b border-stone-200">
        {/* Horizontal reference lines */}
        <div className="absolute inset-x-0 top-8 bottom-6 flex flex-col justify-between pointer-events-none">
          {[1, 0.75, 0.5, 0.25, 0].map((pct, i) => (
            <div key={i} className="border-b border-dashed border-stone-100 w-full flex items-center">
              <span className="text-[9px] text-stone-400 font-mono -mt-3">
                {fmtMoney(maxVal * pct, 0)}
              </span>
            </div>
          ))}
        </div>

        {data.map((d, idx) => {
          const hPct = Math.max(2, Math.round((Math.abs(d.value) / maxVal) * 100));
          const hSecPct =
            d.secondaryValue !== undefined
              ? Math.max(2, Math.round((Math.abs(d.secondaryValue) / maxVal) * 100))
              : 0;
          const isNeg = d.value < 0;
          const barColor = d.color || (isNeg ? "#ef4444" : primaryColor);

          return (
            <div
              key={idx}
              className="relative flex-1 h-full flex flex-col justify-end items-center group z-10"
              onMouseEnter={() => setHoverIdx(idx)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              {hoverIdx === idx && (
                <div className="absolute -top-7 bg-stone-900 text-white text-[10px] font-mono py-1 px-2 rounded-md shadow-lg whitespace-nowrap z-20 pointer-events-none">
                  <span className="font-bold">{d.label}:</span> {fmtMoney(d.value)}
                  {d.secondaryValue !== undefined && ` | ${secondaryLabel}: ${fmtMoney(d.secondaryValue)}`}
                </div>
              )}
              <div className="w-full flex items-end justify-center gap-1 h-full">
                <div
                  className="w-full max-w-[28px] rounded-t-md transition-all duration-200 group-hover:opacity-90"
                  style={{
                    height: `${d.value === 0 ? 2 : hPct}%`,
                    backgroundColor: barColor,
                    opacity: d.value === 0 ? 0.2 : 1
                  }}
                />
                {d.secondaryValue !== undefined && (
                  <div
                    className="w-full max-w-[20px] rounded-t-md transition-all duration-200 group-hover:opacity-90"
                    style={{
                      height: `${d.secondaryValue === 0 ? 2 : hSecPct}%`,
                      backgroundColor: secondaryColor,
                      opacity: d.secondaryValue === 0 ? 0.2 : 1
                    }}
                  />
                )}
              </div>
              <span
                className="absolute -bottom-5 text-[9px] font-bold text-stone-600 truncate max-w-[68px] text-center"
                title={d.label}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Interactive SVG Area / Line Chart Component (supports single or dual series & negative values)
 */
const InteractiveAreaChart: React.FC<{
  title: string;
  subtitle?: string;
  labels: string[];
  series1: number[];
  series1Label: string;
  series1Color?: string;
  series2?: number[];
  series2Label?: string;
  series2Color?: string;
}> = ({
  title,
  subtitle,
  labels,
  series1,
  series1Label,
  series1Color = "#936037",
  series2,
  series2Label,
  series2Color = "#059669"
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const allVals = [...series1, ...(series2 || []), 0];
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const span = Math.max(1, maxVal - minVal);

  const width = 640;
  const height = 200;
  const padX = 42;
  const padY = 22;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const toX = (i: number) =>
    labels.length <= 1 ? padX + plotW / 2 : padX + (i / (labels.length - 1)) * plotW;
  const toY = (v: number) => padY + plotH - ((v - minVal) / span) * plotH;
  const zeroY = toY(0);

  const pts1 = series1.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const area1 = `${toX(0)},${zeroY} ${pts1} ${toX(series1.length - 1)},${zeroY}`;

  const pts2 = series2 ? series2.map((v, i) => `${toX(i)},${toY(v)}`).join(" ") : "";
  const area2 = series2
    ? `${toX(0)},${zeroY} ${pts2} ${toX(series2.length - 1)},${zeroY}`
    : "";

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="font-serif font-bold text-stone-900 text-base">{title}</h4>
          {subtitle && <p className="text-[11px] text-stone-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold">
          <span className="flex items-center gap-1 text-stone-700">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: series1Color }} />
            {series1Label}
          </span>
          {series2 && series2Label && (
            <span className="flex items-center gap-1 text-stone-700">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: series2Color }} />
              {series2Label}
            </span>
          )}
        </div>
      </div>

      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-52 overflow-visible">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
            const val = minVal + span * (1 - t);
            const y = padY + t * plotH;
            return (
              <g key={idx}>
                <line
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke="#e7e5e4"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
                <text x={4} y={y + 3} fontSize={9} fill="#78716c" fontFamily="monospace">
                  {fmtMoney(val, 0)}
                </text>
              </g>
            );
          })}

          {/* Zero baseline if negative numbers exist */}
          {minVal < 0 && (
            <line
              x1={padX}
              y1={zeroY}
              x2={width - padX}
              y2={zeroY}
              stroke="#a8a29e"
              strokeWidth={1.2}
            />
          )}

          {/* Area & Line 1 */}
          <polygon points={area1} fill={series1Color} fillOpacity={0.14} />
          <polyline
            fill="none"
            stroke={series1Color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pts1}
          />

          {/* Area & Line 2 */}
          {series2 && (
            <>
              <polygon points={area2} fill={series2Color} fillOpacity={0.12} />
              <polyline
                fill="none"
                stroke={series2Color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pts2}
              />
            </>
          )}

          {/* Data Points & Hover Targets */}
          {labels.map((lbl, i) => {
            const x = toX(i);
            const y1 = toY(series1[i] || 0);
            const y2 = series2 ? toY(series2[i] || 0) : null;
            return (
              <g
                key={i}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                className="cursor-pointer"
              >
                <rect x={x - 18} y={padY} width={36} height={plotH} fill="transparent" />
                <circle
                  cx={x}
                  cy={y1}
                  r={hoverIdx === i ? 5 : 3.5}
                  fill="#ffffff"
                  stroke={series1Color}
                  strokeWidth={2.2}
                />
                {y2 !== null && (
                  <circle
                    cx={x}
                    cy={y2}
                    r={hoverIdx === i ? 5 : 3.5}
                    fill="#ffffff"
                    stroke={series2Color}
                    strokeWidth={2.2}
                  />
                )}
                <text
                  x={x}
                  y={height - 4}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontWeight="bold"
                  fill="#57534e"
                >
                  {lbl}
                </text>
              </g>
            );
          })}
        </svg>

        {hoverIdx !== null && (
          <div className="mt-1 bg-stone-900 text-white text-[11px] font-mono py-1.5 px-3 rounded-lg flex items-center justify-between">
            <span className="font-bold text-amber-300">{labels[hoverIdx]}</span>
            <div className="flex items-center gap-4">
              <span>
                {series1Label}: <strong>{fmtMoney(series1[hoverIdx])}</strong>
              </span>
              {series2 && series2Label && (
                <span>
                  {series2Label}: <strong>{fmtMoney(series2[hoverIdx])}</strong>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const BusinessTracker: React.FC<BusinessTrackerProps> = ({
  websiteProducts,
  websiteQuotes,
  onUpdateWebsiteProducts
}) => {
  const [store, setStore] = useState<BusinessStoreSnapshot>(() => getInitialBusinessSnapshot());
  const [subTab, setSubTab] = useState<TrackerSubTab>("summary");
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<string>("all"); // "all" or "01".."12"
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  useEffect(() => {
    const unsub = subscribeBusinessStore((snap) => setStore(snap));
    loadBusinessStore().catch(() => {});
    return unsub;
  }, []);

  // Auto-sync any completed website quotes when BusinessTracker mounts or websiteQuotes changes
  useEffect(() => {
    if (!store.settings.autoSyncWebsiteOrders) return;
    const completedQuotes = websiteQuotes.filter(
      (q) =>
        q.status === "completed" &&
        q.type !== "contact" &&
        !(q.productName || "").toLowerCase().startsWith("contact message")
    );
    for (const cq of completedQuotes) {
      const res = syncCompletedWebsiteOrder(cq, websiteProducts);
      if (res.synced && res.incomeRecord) {
        showToast(`Synced completed website order (${res.incomeRecord.itemSold}) to Income & Inventory!`);
      }
    }
  }, [websiteQuotes, websiteProducts, store.settings.autoSyncWebsiteOrders]);

  // ============================================================================
  // 1. SUMMARY & CHARTS COMPUTATIONS
  // ============================================================================
  const yearIncome = useMemo(
    () => store.income.filter((r) => r.date.startsWith(String(selectedYear))),
    [store.income, selectedYear]
  );
  const yearExpenses = useMemo(
    () => store.expenses.filter((r) => r.date.startsWith(String(selectedYear))),
    [store.expenses, selectedYear]
  );

  const filteredIncome = useMemo(
    () =>
      selectedMonth === "all"
        ? yearIncome
        : yearIncome.filter((r) => r.date.slice(5, 7) === selectedMonth),
    [yearIncome, selectedMonth]
  );
  const filteredExpenses = useMemo(
    () =>
      selectedMonth === "all"
        ? yearExpenses
        : yearExpenses.filter((r) => r.date.slice(5, 7) === selectedMonth),
    [yearExpenses, selectedMonth]
  );

  const summaryKpis = useMemo(() => {
    const totalIncome = filteredIncome.reduce((s, r) => s + (Number(r.totalIncome) || 0), 0);
    const totalExpense = filteredExpenses.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const totalProfit = filteredIncome.reduce((s, r) => s + (Number(r.totalProfit) || 0), 0);
    const totalLaborCost = filteredIncome.reduce((s, r) => s + (Number(r.totalLaborCost) || 0), 0);
    const netIncome = totalIncome - totalExpense;
    const profitPlusLabor = totalProfit + totalLaborCost;
    return {
      totalIncome,
      totalExpense,
      totalProfit,
      totalLaborCost,
      netIncome,
      profitPlusLabor
    };
  }, [filteredIncome, filteredExpenses]);

  // Monthly matrices (Jan..Dec) for selectedYear
  const monthlyBreakdown = useMemo(() => {
    const platforms = Array.from(
      new Set([
        ...SALES_PLATFORMS,
        ...yearIncome.map((r) => r.platform || "Marketplace")
      ])
    );

    const incomeByPlatformMonth: Record<string, number[]> = {};
    platforms.forEach((p) => {
      incomeByPlatformMonth[p] = Array(12).fill(0);
    });
    const totalIncomeByMonth = Array(12).fill(0);
    const profitByMonth = Array(12).fill(0);
    const laborByMonth = Array(12).fill(0);

    yearIncome.forEach((r) => {
      const mIdx = parseInt(r.date.slice(5, 7), 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        const plat = r.platform || "Marketplace";
        if (!incomeByPlatformMonth[plat]) {
          incomeByPlatformMonth[plat] = Array(12).fill(0);
        }
        incomeByPlatformMonth[plat][mIdx] += Number(r.totalIncome) || 0;
        totalIncomeByMonth[mIdx] += Number(r.totalIncome) || 0;
        profitByMonth[mIdx] += Number(r.totalProfit) || 0;
        laborByMonth[mIdx] += Number(r.totalLaborCost) || 0;
      }
    });

    const expenseByCatMonth: Record<string, number[]> = {};
    EXPENSE_CATEGORIES.forEach((c) => {
      expenseByCatMonth[c] = Array(12).fill(0);
    });
    const totalExpenseByMonth = Array(12).fill(0);

    yearExpenses.forEach((e) => {
      const mIdx = parseInt(e.date.slice(5, 7), 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        const cat = e.category || "Material";
        if (!expenseByCatMonth[cat]) {
          expenseByCatMonth[cat] = Array(12).fill(0);
        }
        expenseByCatMonth[cat][mIdx] += Number(e.total) || 0;
        totalExpenseByMonth[mIdx] += Number(e.total) || 0;
      }
    });

    const netIncomeByMonth = totalIncomeByMonth.map((inc, i) => inc - totalExpenseByMonth[i]);
    const profitPlusLCByMonth = profitByMonth.map((p, i) => p + laborByMonth[i]);

    // Filter active platforms (ones with sales or standard 6 from sheet)
    const activePlatforms = platforms.filter(
      (p) =>
        ["Website", "Marketplace", "JP Baskets", "Instagram", "Facebook", "Friend"].includes(p) ||
        incomeByPlatformMonth[p]?.some((v) => v !== 0)
    );

    return {
      activePlatforms,
      incomeByPlatformMonth,
      totalIncomeByMonth,
      expenseByCatMonth,
      totalExpenseByMonth,
      netIncomeByMonth,
      profitByMonth,
      laborByMonth,
      profitPlusLCByMonth
    };
  }, [yearIncome, yearExpenses]);

  const topProductsData = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; profitPlusLabor: number; qty: number }>();
    filteredIncome.forEach((r) => {
      const key = r.itemSold.trim();
      const curr = map.get(key) || { name: key, revenue: 0, profitPlusLabor: 0, qty: 0 };
      curr.revenue += Number(r.totalIncome) || 0;
      curr.profitPlusLabor += (Number(r.totalProfit) || 0) + (Number(r.totalLaborCost) || 0);
      curr.qty += Number(r.qty) || 1;
      map.set(key, curr);
    });
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [filteredIncome]);

  // ============================================================================
  // 2. EXPENSES & AI RECEIPT SCANNER STATE
  // ============================================================================
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCatFilter, setExpenseCatFilter] = useState<string>("all");
  const [manualExpForm, setManualExpForm] = useState<{
    date: string;
    category: ExpenseCategory;
    description: string;
    paymentMethod: string;
    price: string;
    qty: string;
    syncToInventory: boolean;
    selectedInventoryId: string;
    newMaterialName: string;
    packQty: string;
  }>({
    date: new Date().toISOString().slice(0, 10),
    category: "Material",
    description: "",
    paymentMethod: store.settings.defaultPaymentMethod || "VISA 7992",
    price: "",
    qty: "1",
    syncToInventory: false,
    selectedInventoryId: "__NEW__",
    newMaterialName: "",
    packQty: "1"
  });

  // AI Receipt Scanner states
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scanProgressStatus, setScanProgressStatus] = useState<string>("");
  const [receiptRawText, setReceiptRawText] = useState("");
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string>("");
  const [receiptDraftVendor, setReceiptDraftVendor] = useState("Michaels");
  const [receiptDraftDate, setReceiptDraftDate] = useState(new Date().toISOString().slice(0, 10));
  const [receiptDraftPayment, setReceiptDraftPayment] = useState("VISA 7992");
  const [receiptLogMode, setReceiptLogMode] = useState<"per-item" | "single-receipt">("per-item");
  const [receiptDraftItems, setReceiptDraftItems] = useState<ReceiptLineItemDraft[]>([]);
  const [receiptDetectedTax, setReceiptDetectedTax] = useState<number | undefined>(undefined);
  const [receiptDetectedTotal, setReceiptDetectedTotal] = useState<number | undefined>(undefined);
  const [showReceiptReview, setShowReceiptReview] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState(store.settings.geminiApiKey || "");
  const [showApiKeyConfig, setShowApiKeyConfig] = useState(false);

  const processReceiptFile = async (file: File) => {
    setIsScanningReceipt(true);
    setScanProgressStatus("Preparing receipt...");

    try {
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      let previewUrl = "";
      let ocrImageUrl = "";
      let extractedText = "";

      if (isPdf) {
        const pdfContent = await extractPdfReceiptContent(file, setScanProgressStatus);
        extractedText = pdfContent.text;
        previewUrl = pdfContent.pageImageDataUrl || "";
        ocrImageUrl = pdfContent.pageImageDataUrl || "";

        // If the PDF is a scanned image (very little digital text), run OCR on the rendered PDF page
        if (extractedText.replace(/\s+/g, "").length < 15 && ocrImageUrl) {
          extractedText = await runImageOcrInBrowser(ocrImageUrl, setScanProgressStatus);
        }
      } else {
        setScanProgressStatus("Optimizing receipt image...");
        const processed = await preprocessReceiptImage(file);
        previewUrl = processed.previewDataUrl;
        ocrImageUrl = processed.ocrDataUrl;
      }

      setReceiptPreviewUrl(previewUrl);

      // 1. Try Gemini Vision API if a Gemini key is configured
      const activeKey = (geminiKeyInput || store.settings.geminiApiKey || "").trim();
      let apiHandled = false;

      if (activeKey && activeKey !== "MY_GEMINI_API_KEY") {
        setScanProgressStatus("Analyzing receipt with Gemini Vision AI...");
        try {
          const res = await fetch("/api/scan-receipt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageDataUrl: previewUrl,
              rawText: extractedText,
              fileName: file.name,
              apiKey: activeKey
            })
          });
          const data = await res.json();
          if (data && data.success && data.result && Array.isArray(data.result.items) && data.result.items.length > 0) {
            setReceiptDraftVendor(data.result.vendor || "Michaels");
            setReceiptDraftDate(data.result.date || new Date().toISOString().slice(0, 10));
            setReceiptDraftPayment(data.result.paymentMethod || "VISA 7992");
            setReceiptDraftItems(data.result.items);
            setReceiptDetectedTax(data.result.taxAmount);
            setReceiptDetectedTotal(data.result.totalAmount);
            setShowReceiptReview(true);
            apiHandled = true;
            showToast(
              `Receipt scanned (${data.result.items.length} item(s) detected)! Review & rename below.`
            );
          }
        } catch {
          // Fall back to automatic browser OCR
        }
      }

      // 2. Automatic Browser OCR + Multi-format Receipt Parser (works with 0 external keys)
      if (!apiHandled) {
        if (!extractedText && ocrImageUrl) {
          extractedText = await runImageOcrInBrowser(ocrImageUrl, setScanProgressStatus);
        }
        if (extractedText) {
          setReceiptRawText(extractedText);
        }

        setScanProgressStatus("Detecting items & costs...");
        const parsed = parseReceiptText(extractedText, file.name, store.inventory);

        setReceiptDraftVendor(parsed.vendor || "Michaels");
        setReceiptDraftDate(parsed.date || new Date().toISOString().slice(0, 10));
        setReceiptDraftPayment(parsed.paymentMethod || "VISA 7992");
        setReceiptDetectedTax(parsed.taxAmount);
        setReceiptDetectedTotal(parsed.receiptTotalAmount || parsed.totalAmount);

        if (parsed.items.length > 0) {
          setReceiptDraftItems(parsed.items);
          setShowReceiptReview(true);
          showToast(
            `Receipt scanned! Detected ${parsed.items.length} item(s) from ${parsed.vendor}. Review & rename below.`
          );
        } else {
          // Even if the image was too blurry to read individual prices, open the review table with 1 editable row so the user isn't stuck
          setReceiptDraftItems([
            {
              id: `scan_${Date.now()}_0`,
              rawName: file.name,
              friendlyName: `${parsed.vendor} Supplies`,
              category: "Material",
              price: parsed.totalAmount || 0,
              packQty: 1,
              unitPrice: parsed.totalAmount || 0,
              syncToInventory: true
            }
          ]);
          setShowReceiptReview(true);
          showToast(
            "Receipt opened for review — please verify the item name and price below."
          );
        }
      }
    } catch (err: any) {
      showToast(`Could not read receipt file: ${err?.message || "Please try another image or paste text"}`);
    } finally {
      setIsScanningReceipt(false);
      setScanProgressStatus("");
    }
  };

  const handleReceiptFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await processReceiptFile(file);
  };

  const handleScanReceiptText = async (sampleText?: string) => {
    const textToUse = sampleText !== undefined ? sampleText : receiptRawText;
    if (!textToUse.trim()) {
      showToast("Paste receipt lines or upload a receipt image/PDF first.");
      return;
    }
    setIsScanningReceipt(true);
    setScanProgressStatus("Parsing receipt items & prices...");
    try {
      const parsed = parseReceiptText(textToUse, undefined, store.inventory);
      setReceiptDraftVendor(parsed.vendor || "Michaels");
      setReceiptDraftDate(parsed.date || new Date().toISOString().slice(0, 10));
      setReceiptDraftPayment(parsed.paymentMethod || "VISA 7992");
      setReceiptDetectedTax(parsed.taxAmount);
      setReceiptDetectedTotal(parsed.receiptTotalAmount || parsed.totalAmount);
      setReceiptDraftItems(parsed.items);
      setShowReceiptReview(true);
      showToast(`Parsed ${parsed.items.length} receipt line item(s)! Review & rename below.`);
    } catch {
      showToast("Error parsing receipt text.");
    } finally {
      setIsScanningReceipt(false);
      setScanProgressStatus("");
    }
  };

  const handleCommitScannedReceipt = () => {
    if (receiptDraftItems.length === 0) return;
    const { addedExpenses, updatedInventoryCount } = commitScannedReceiptToStore({
      vendor: receiptDraftVendor || "Michaels",
      date: receiptDraftDate || new Date().toISOString().slice(0, 10),
      paymentMethod: receiptDraftPayment || "VISA 7992",
      items: receiptDraftItems,
      logMode: receiptLogMode,
      receiptImageUrl: receiptPreviewUrl || undefined
    });
    setShowReceiptReview(false);
    setReceiptDraftItems([]);
    setReceiptRawText("");
    setReceiptPreviewUrl("");
    showToast(
      `Saved ${addedExpenses.length} expense record(s) and synced ${updatedInventoryCount} item(s) to Inventory!`
    );
  };

  const handleAddManualExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const rawPrice = Number(manualExpForm.price);
    const qty = Number(manualExpForm.qty) || 1;
    if (!manualExpForm.description.trim() || isNaN(rawPrice)) {
      showToast("Please enter a vendor/description and valid price.");
      return;
    }
    const finalPrice =
      manualExpForm.category === "Refund" && rawPrice > 0 ? -rawPrice : rawPrice;

    if (manualExpForm.syncToInventory) {
      const packQty = Math.max(1, Number(manualExpForm.packQty) || 1);
      const matchedInv =
        manualExpForm.selectedInventoryId && manualExpForm.selectedInventoryId !== "__NEW__"
          ? store.inventory.find((x) => x.id === manualExpForm.selectedInventoryId)
          : undefined;
      const finalMaterialName = matchedInv
        ? matchedInv.name
        : manualExpForm.newMaterialName.trim() || manualExpForm.description.trim();

      commitScannedReceiptToStore({
        vendor: manualExpForm.description.trim(),
        date: manualExpForm.date,
        paymentMethod: manualExpForm.paymentMethod || "VISA 7992",
        logMode: "single-receipt",
        items: [
          {
            id: `man_${Date.now()}`,
            rawName: manualExpForm.description.trim(),
            friendlyName: finalMaterialName,
            matchedInventoryId: matchedInv?.id,
            category: manualExpForm.category,
            qtyBought: qty,
            price: finalPrice,
            packQty,
            unitPrice: finalPrice / (qty * packQty),
            syncToInventory: true
          }
        ]
      });
      showToast(
        `Expense logged & added ${qty * packQty} pieces (${qty} pack(s) × ${packQty} pcs) to Inventory!`
      );
    } else {
      const newExp: ExpenseRecord = {
        id: `exp_${Date.now()}`,
        date: manualExpForm.date,
        category: manualExpForm.category,
        description: manualExpForm.description.trim(),
        paymentMethod: manualExpForm.paymentMethod || "VISA 7992",
        price: finalPrice,
        qty,
        total: Number((finalPrice * qty).toFixed(2))
      };
      saveBusinessStore({
        expenses: [newExp, ...store.expenses]
      });
      showToast("Expense added!");
    }

    setManualExpForm({
      ...manualExpForm,
      description: "",
      price: "",
      qty: "1",
      syncToInventory: false,
      selectedInventoryId: "__NEW__",
      newMaterialName: "",
      packQty: "1"
    });
  };

  // ============================================================================
  // 3. INVENTORY STATE
  // ============================================================================
  const [invSearch, setInvSearch] = useState("");
  const [invStatusFilter, setInvStatusFilter] = useState<string>("all");
  const [editingInvItem, setEditingInvItem] = useState<InventoryItem | null>(null);
  const [isAddingInv, setIsAddingInv] = useState(false);
  const [invForm, setInvForm] = useState<{
    itemCode: string;
    name: string;
    category: string;
    bulkPrice: string;
    bulkQty: string;
    stock: string;
    minStock: string;
    status: InventoryStatus;
    notes: string;
  }>({
    itemCode: "",
    name: "",
    category: "Sublimation Blanks",
    bulkPrice: "",
    bulkQty: "1",
    stock: "10",
    minStock: "4",
    status: "In stock",
    notes: ""
  });

  const handleSaveInventoryItem = (e: React.FormEvent) => {
    e.preventDefault();
    const bulkPrice = Number(invForm.bulkPrice) || 0;
    const bulkQty = Number(invForm.bulkQty) > 0 ? Number(invForm.bulkQty) : 1;
    const unitPrice = bulkPrice / bulkQty;
    const stock = Number(invForm.stock) || 0;
    const minStock = Number(invForm.minStock) || 4;
    const status = computeInventoryStatus(stock, minStock, invForm.status);

    let nextInventory: InventoryItem[];
    if (editingInvItem) {
      nextInventory = store.inventory.map((it) =>
        it.id === editingInvItem.id
          ? {
              ...it,
              itemCode: invForm.itemCode || it.itemCode,
              name: invForm.name.trim(),
              category: invForm.category.trim(),
              bulkPrice,
              bulkQty,
              unitPrice,
              stock,
              minStock,
              status,
              notes: invForm.notes,
              updatedAt: new Date().toISOString()
            }
          : it
      );
    } else {
      const nextCode =
        invForm.itemCode.trim() || `INV-${String(store.inventory.length + 1).padStart(3, "0")}`;
      const newItem: InventoryItem = {
        id: `inv_${Date.now()}`,
        itemCode: nextCode,
        name: invForm.name.trim(),
        category: invForm.category.trim(),
        bulkPrice,
        bulkQty,
        unitPrice,
        stock,
        minStock,
        status,
        notes: invForm.notes,
        updatedAt: new Date().toISOString()
      };
      nextInventory = [newItem, ...store.inventory];
    }

    saveBusinessStore({ inventory: nextInventory });
    setEditingInvItem(null);
    setIsAddingInv(false);
    showToast(editingInvItem ? "Inventory item updated!" : "New raw material added to Inventory!");
  };

  const handleAdjustStock = (id: string, delta: number) => {
    const nextInventory = store.inventory.map((it) => {
      if (it.id !== id) return it;
      const nextStock = Math.max(0, Number((it.stock + delta).toFixed(2)));
      return {
        ...it,
        stock: nextStock,
        status: computeInventoryStatus(nextStock, it.minStock),
        updatedAt: new Date().toISOString()
      };
    });
    saveBusinessStore({ inventory: nextInventory });
  };

  // ============================================================================
  // 4. ITEM PRICING & RECIPE CALCULATOR STATE
  // ============================================================================
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(
    store.recipes[0]?.id || "rec_11oz_mug_1s"
  );

  const activeRecipe = useMemo(
    () => store.recipes.find((r) => r.id === selectedRecipeId) || store.recipes[0],
    [store.recipes, selectedRecipeId]
  );

  const handleUpdateActiveRecipe = (patch: Partial<ProductRecipe>) => {
    if (!activeRecipe) return;
    const updated = recalculateRecipe(
      { ...activeRecipe, ...patch },
      store.settings.hourlyLaborRate
    );
    const nextRecipes = store.recipes.map((r) => (r.id === activeRecipe.id ? updated : r));
    saveBusinessStore({ recipes: nextRecipes });
  };

  const handleAddMaterialToRecipe = (invId?: string) => {
    if (!activeRecipe) return;
    const invItem = invId ? store.inventory.find((i) => i.id === invId) : store.inventory[0];
    const newMat: RecipeMaterialLine = {
      id: `mat_${Date.now()}`,
      inventoryItemId: invItem?.id,
      name: invItem?.name || "Custom Material",
      bulkPrice: invItem?.bulkPrice || 10,
      bulkQty: invItem?.bulkQty || 1,
      unitPrice: invItem ? invItem.bulkPrice / invItem.bulkQty : 10,
      qtyUsed: 1,
      lineCost: invItem ? invItem.bulkPrice / invItem.bulkQty : 10
    };
    handleUpdateActiveRecipe({
      materials: [...activeRecipe.materials, newMat]
    });
  };

  const handleCreateNewRecipe = () => {
    const newRec = recalculateRecipe(
      {
        id: `rec_${Date.now()}`,
        name: "New Custom Craft Recipe",
        category: "Sublimation",
        laborMinutes: 20,
        desiredProfitPct: 0.25,
        actualPrice: 25,
        materials: []
      },
      store.settings.hourlyLaborRate
    );
    saveBusinessStore({ recipes: [newRec, ...store.recipes] });
    setSelectedRecipeId(newRec.id);
    showToast("Created new product recipe!");
  };

  const handleDeleteRecipe = (recipeId: string) => {
    const target = store.recipes.find((r) => r.id === recipeId);
    if (!target) return;
    if (!window.confirm(`Delete product recipe "${target.name}"?`)) return;

    const nextRecipes = store.recipes.filter((r) => r.id !== recipeId);
    saveBusinessStore({ recipes: nextRecipes });

    if (selectedRecipeId === recipeId) {
      setSelectedRecipeId(nextRecipes[0]?.id || "");
    }
    showToast(`Deleted recipe "${target.name}".`);
  };

  const handleSyncRecipePriceToWebsite = (rec: ProductRecipe) => {
    const targetWebProd = rec.websiteProductId
      ? websiteProducts.find((p) => p.id === rec.websiteProductId)
      : websiteProducts.find((p) => p.name.trim().toLowerCase() === rec.name.trim().toLowerCase());

    if (!targetWebProd) {
      showToast("Link this recipe to a Website Catalog Craft first using the dropdown.");
      return;
    }

    const nextProds = websiteProducts.map((p) =>
      p.id === targetWebProd.id ? { ...p, price: Number(rec.actualPrice.toFixed(2)) } : p
    );
    onUpdateWebsiteProducts(nextProds);
    showToast(`Synced ${rec.name} price (${fmtMoney(rec.actualPrice)}) to Website Catalog!`);
  };

  // ============================================================================
  // 5. INCOME & SALES TRACKER STATE
  // ============================================================================
  const [incomeSearch, setIncomeSearch] = useState("");
  const [incomePlatformFilter, setIncomePlatformFilter] = useState("all");
  const [saleForm, setSaleForm] = useState<{
    date: string;
    selectedProductKey: string; // recipeId or "CUSTOM_OTHER"
    customItemName: string;
    platform: string;
    salePrice: string;
    itemCost: string;
    laborCostPerItem: string;
    qty: string;
    discount: string;
    tip: string;
    deductInventory: boolean;
  }>(() => {
    const firstRec = store.recipes[0];
    return {
      date: new Date().toISOString().slice(0, 10),
      selectedProductKey: firstRec?.id || "CUSTOM_OTHER",
      customItemName: "",
      platform: "Marketplace",
      salePrice: String(firstRec?.actualPrice || 25),
      itemCost: String(Number((firstRec?.totalCost || 13.04).toFixed(4))),
      laborCostPerItem: String(Number((firstRec?.laborCost || 5.33).toFixed(4))),
      qty: "1",
      discount: "0",
      tip: "0",
      deductInventory: true
    };
  });

  const handleSelectSaleProduct = (key: string) => {
    if (key === "CUSTOM_OTHER") {
      setSaleForm((prev) => ({
        ...prev,
        selectedProductKey: "CUSTOM_OTHER",
        customItemName: "Other",
        salePrice: "25",
        itemCost: "10",
        laborCostPerItem: "8"
      }));
      return;
    }

    // Check if it's a recipeId or websiteProductId
    const rec = store.recipes.find((r) => r.id === key);
    if (rec) {
      setSaleForm((prev) => ({
        ...prev,
        selectedProductKey: key,
        customItemName: rec.name,
        salePrice: String(rec.actualPrice || Number(rec.calculatedPrice.toFixed(2)) || 25),
        itemCost: String(Number(rec.totalCost.toFixed(4))),
        laborCostPerItem: String(Number(rec.laborCost.toFixed(4)))
      }));
      return;
    }

    const webProd = websiteProducts.find((p) => p.id === key);
    if (webProd) {
      setSaleForm((prev) => ({
        ...prev,
        selectedProductKey: key,
        customItemName: webProd.name,
        salePrice: String(webProd.promoPrice || webProd.price || 25),
        itemCost: String(Number(((webProd.price || 25) * 0.5).toFixed(2))),
        laborCostPerItem: "8"
      }));
    }
  };

  const handleLogSale = (e: React.FormEvent) => {
    e.preventDefault();
    const rec = store.recipes.find((r) => r.id === saleForm.selectedProductKey);
    const webProd = websiteProducts.find((p) => p.id === saleForm.selectedProductKey);
    const itemSold =
      saleForm.selectedProductKey === "CUSTOM_OTHER"
        ? saleForm.customItemName.trim() || "Other"
        : rec?.name || webProd?.name || saleForm.customItemName || "Craft Item";

    const { incomeRecord, deductedItems } = recordSaleAndDeductInventory({
      date: saleForm.date,
      recipeId: rec?.id,
      websiteProductId: rec?.websiteProductId || webProd?.id,
      itemSold,
      platform: saleForm.platform,
      salePrice: Number(saleForm.salePrice) || 0,
      itemCost: Number(saleForm.itemCost) || 0,
      laborCostPerItem: Number(saleForm.laborCostPerItem) || 0,
      qty: Number(saleForm.qty) || 1,
      discount: Number(saleForm.discount) || 0,
      tip: Number(saleForm.tip) || 0,
      deductInventory: saleForm.deductInventory
    });

    showToast(
      deductedItems.length > 0
        ? `Logged sale (${fmtMoney(incomeRecord.totalIncome)}) & deducted ${deductedItems.length} raw material(s) from Inventory!`
        : `Logged sale: ${incomeRecord.itemSold} (${fmtMoney(incomeRecord.totalIncome)})!`
    );
  };

  const handleUpdateLaborRate = (newRate: number) => {
    if (isNaN(newRate) || newRate <= 0) return;
    const updatedRecipes = store.recipes.map((r) =>
      r.materials.length > 0 ? recalculateRecipe(r, newRate) : r
    );
    saveBusinessStore({
      settings: { ...store.settings, hourlyLaborRate: newRate },
      recipes: updatedRecipes
    });
    showToast(`Updated hourly labor rate to $${newRate.toFixed(2)}/hr across all recipes!`);
  };

  const exportCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    const escapeCell = (c: string | number) => {
      const s = String(c ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const csv = [headers.map(escapeCell).join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Feedback Banner */}
      {toastMsg && (
        <div className="bg-emerald-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between text-xs font-medium animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-emerald-200 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header & 6-Tab Spreadsheet Switcher */}
      <div className="bg-stone-900 text-white p-5 md:p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold block">
              Nicoletta Crafts &amp; Decor • Studio ERP &amp; Accounting
            </span>
            <h2 className="font-serif font-bold text-xl md:text-2xl text-white mt-0.5">
              Business, Recipe &amp; Inventory Tracker
            </h2>
            <p className="text-xs text-stone-300 mt-0.5">
              Live 6-tab spreadsheet engine synced with Firebase Cloud Firestore &amp; Website Orders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-stone-800 border border-stone-700 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-stone-300">Labor Rate:</span>
              <span className="font-mono font-bold text-white">${store.settings.hourlyLaborRate}/hr</span>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-stone-800 border border-stone-700 text-white text-xs font-bold rounded-xl px-3 py-2 cursor-pointer focus:outline-none"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2027}>2027</option>
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-stone-800 border border-stone-700 text-white text-xs font-bold rounded-xl px-3 py-2 cursor-pointer focus:outline-none"
            >
              <option value="all">Full Year ({selectedYear})</option>
              {MONTH_LABELS.map((m, idx) => {
                const val = String(idx + 1).padStart(2, "0");
                return (
                  <option key={val} value={val}>
                    {m} {selectedYear}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* 6 Spreadsheet Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-stone-800">
          {[
            { id: "summary", label: "1. Summary & Charts", icon: PieChart },
            { id: "income", label: `2. Income (${store.income.length})`, icon: DollarSign },
            { id: "expenses", label: `3. Expenses & Receipt AI (${store.expenses.length})`, icon: Receipt },
            { id: "inventory", label: `4. Inventory (${store.inventory.length})`, icon: Package },
            { id: "item-pricing", label: "5. Item Pricing Calculator", icon: Calculator },
            { id: "products", label: `6. Products Table (${store.recipes.length})`, icon: ShoppingBag }
          ].map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id as TrackerSubTab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  active
                    ? "bg-brand-primary text-white shadow-xs"
                    : "bg-stone-800/80 text-stone-300 hover:bg-stone-800 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==========================================================================
          TAB 1: SUMMARY & CHARTS (Annual Overview)
         ========================================================================== */}
      {subTab === "summary" && (
        <div className="space-y-6 animate-fade-in">
          {/* 5 KPI Cards matching Summary Tab */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="bg-stone-50 border border-stone-200 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                Total Income (Revenue)
              </span>
              <p className="font-serif font-bold text-2xl text-stone-900 mt-1">
                {fmtMoney(summaryKpis.totalIncome)}
              </p>
              <span className="text-[10px] text-emerald-700 font-medium">
                {filteredIncome.length} sales recorded
              </span>
            </div>

            <div className="bg-stone-50 border border-stone-200 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                Total Expense
              </span>
              <p className="font-serif font-bold text-2xl text-stone-900 mt-1">
                {fmtMoney(summaryKpis.totalExpense)}
              </p>
              <span className="text-[10px] text-stone-500">
                {filteredExpenses.length} expense entries
              </span>
            </div>

            <div
              className={`border p-4 rounded-2xl ${
                summaryKpis.netIncome >= 0
                  ? "bg-emerald-50/60 border-emerald-200"
                  : "bg-red-50/60 border-red-200"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 block">
                Net Income (Cash Flow)
              </span>
              <p
                className={`font-serif font-bold text-2xl mt-1 ${
                  summaryKpis.netIncome >= 0 ? "text-emerald-800" : "text-red-700"
                }`}
              >
                {fmtMoney(summaryKpis.netIncome)}
              </p>
              <span className="text-[10px] text-stone-500">Total Income − Total Expense</span>
            </div>

            <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block">
                Product Profit
              </span>
              <p className="font-serif font-bold text-2xl text-amber-950 mt-1">
                {fmtMoney(summaryKpis.totalProfit)}
              </p>
              <span className="text-[10px] text-amber-800">
                Net margin after materials &amp; labor
              </span>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">
                Profit + Labour (Take-Home)
              </span>
              <p className="font-serif font-bold text-2xl text-emerald-950 mt-1">
                {fmtMoney(summaryKpis.profitPlusLabor)}
              </p>
              <span className="text-[10px] text-emerald-800">
                Includes {fmtMoney(summaryKpis.totalLaborCost)} labor earned
              </span>
            </div>
          </div>

          {/* 7 Interactive Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Chart 1: Income per Platform/Client */}
            <InteractiveBarChart
              title="1. Income per Platform / Client"
              subtitle={`Gross revenue breakdown by sales channel (${selectedYear})`}
              primaryLabel="Total Income"
              primaryColor="#936037"
              data={monthlyBreakdown.activePlatforms.map((plat) => ({
                label: plat,
                value: monthlyBreakdown.incomeByPlatformMonth[plat].reduce((a, b) => a + b, 0)
              }))}
            />

            {/* Chart 2: Total Income by Month */}
            <InteractiveAreaChart
              title="2. Total Income by Month"
              subtitle={`Monthly gross sales revenue trend (${selectedYear})`}
              labels={MONTH_LABELS}
              series1={monthlyBreakdown.totalIncomeByMonth}
              series1Label="Gross Income"
              series1Color="#936037"
            />

            {/* Chart 3: Expense per Category */}
            <InteractiveBarChart
              title="3. Expense per Category"
              subtitle={`Total spending across studio categories (${selectedYear})`}
              primaryLabel="Category Spend"
              primaryColor="#d97706"
              data={EXPENSE_CATEGORIES.map((cat) => ({
                label: cat,
                value: monthlyBreakdown.expenseByCatMonth[cat].reduce((a, b) => a + b, 0),
                color: cat === "Refund" ? "#10b981" : "#d97706"
              }))}
            />

            {/* Chart 4: Total Expense by Month */}
            <InteractiveAreaChart
              title="4. Total Expense by Month"
              subtitle={`Monthly studio material & operational expenses (${selectedYear})`}
              labels={MONTH_LABELS}
              series1={monthlyBreakdown.totalExpenseByMonth}
              series1Label="Total Expense"
              series1Color="#dc2626"
            />

            {/* Chart 5: Net Income by Month */}
            <InteractiveAreaChart
              title="5. Net Income by Month (Income − Expense)"
              subtitle={`Monthly net cash flow (${selectedYear})`}
              labels={MONTH_LABELS}
              series1={monthlyBreakdown.netIncomeByMonth}
              series1Label="Net Income"
              series1Color="#2563eb"
            />

            {/* Chart 6: Profit & Labor Earned by Month */}
            <InteractiveAreaChart
              title="6. Profit & Labour Cost Earned by Month"
              subtitle="Product Profit vs Combined Take-Home (Profit + Labour Cost)"
              labels={MONTH_LABELS}
              series1={monthlyBreakdown.profitPlusLCByMonth}
              series1Label="Profit + Labour"
              series1Color="#059669"
              series2={monthlyBreakdown.profitByMonth}
              series2Label="Pure Profit"
              series2Color="#936037"
            />
          </div>

          {/* Chart 7: Top-Selling & Most Profitable Products */}
          <InteractiveBarChart
            title="7. Top-Selling & Most Profitable Products"
            subtitle="Comparison of Gross Revenue vs Take-Home (Profit + Labor) by Product"
            primaryLabel="Gross Revenue"
            primaryColor="#936037"
            secondaryLabel="Profit + Labor"
            secondaryColor="#059669"
            data={topProductsData.map((p) => ({
              label: p.name.length > 16 ? p.name.slice(0, 15) + "…" : p.name,
              value: p.revenue,
              secondaryValue: p.profitPlusLabor
            }))}
          />

          {/* Monthly Breakdown Tables (Jan-Dec + Total) */}
          <div className="space-y-6">
            {/* Table A: Income by Channel */}
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                <h4 className="font-serif font-bold text-stone-900 text-sm">
                  Annual Income Breakdown by Platform ({selectedYear})
                </h4>
                <span className="text-[11px] font-mono font-bold text-emerald-800">
                  Annual Total: {fmtMoney(monthlyBreakdown.totalIncomeByMonth.reduce((a, b) => a + b, 0))}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 text-stone-600 font-bold text-[10px] uppercase">
                      <th className="py-2.5 px-3 sticky left-0 bg-stone-100">Income Channel</th>
                      {MONTH_LABELS.map((m) => (
                        <th key={m} className="py-2.5 px-2.5 text-right font-mono">
                          {m}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-right font-mono bg-amber-50 text-amber-950">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {monthlyBreakdown.activePlatforms.map((plat) => {
                      const rowVals = monthlyBreakdown.incomeByPlatformMonth[plat] || Array(12).fill(0);
                      const rowTotal = rowVals.reduce((a, b) => a + b, 0);
                      return (
                        <tr key={plat} className="hover:bg-stone-50">
                          <td className="py-2 px-3 font-bold text-stone-800 sticky left-0 bg-white">
                            {plat}
                          </td>
                          {rowVals.map((v, i) => (
                            <td
                              key={i}
                              className={`py-2 px-2.5 text-right font-mono ${
                                v > 0 ? "text-stone-900 font-semibold" : "text-stone-300"
                              }`}
                            >
                              {fmtMoney(v, 0)}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right font-mono font-bold bg-amber-50/40 text-stone-900">
                            {fmtMoney(rowTotal)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-stone-900 text-white font-bold">
                      <td className="py-2.5 px-3 sticky left-0 bg-stone-900">Total Income</td>
                      {monthlyBreakdown.totalIncomeByMonth.map((v, i) => (
                        <td key={i} className="py-2.5 px-2.5 text-right font-mono">
                          {fmtMoney(v, 0)}
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-right font-mono text-amber-300">
                        {fmtMoney(monthlyBreakdown.totalIncomeByMonth.reduce((a, b) => a + b, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table B: Expenses by Category */}
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                <h4 className="font-serif font-bold text-stone-900 text-sm">
                  Annual Expense Breakdown by Category ({selectedYear})
                </h4>
                <span className="text-[11px] font-mono font-bold text-red-700">
                  Annual Total: {fmtMoney(monthlyBreakdown.totalExpenseByMonth.reduce((a, b) => a + b, 0))}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 text-stone-600 font-bold text-[10px] uppercase">
                      <th className="py-2.5 px-3 sticky left-0 bg-stone-100">Expense Category</th>
                      {MONTH_LABELS.map((m) => (
                        <th key={m} className="py-2.5 px-2.5 text-right font-mono">
                          {m}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-right font-mono bg-amber-50 text-amber-950">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const rowVals = monthlyBreakdown.expenseByCatMonth[cat] || Array(12).fill(0);
                      const rowTotal = rowVals.reduce((a, b) => a + b, 0);
                      return (
                        <tr key={cat} className="hover:bg-stone-50">
                          <td className="py-2 px-3 font-bold text-stone-800 sticky left-0 bg-white">
                            {cat}
                          </td>
                          {rowVals.map((v, i) => (
                            <td
                              key={i}
                              className={`py-2 px-2.5 text-right font-mono ${
                                v < 0
                                  ? "text-emerald-700 font-semibold"
                                  : v > 0
                                  ? "text-stone-900 font-semibold"
                                  : "text-stone-300"
                              }`}
                            >
                              {fmtMoney(v)}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right font-mono font-bold bg-amber-50/40 text-stone-900">
                            {fmtMoney(rowTotal)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-stone-900 text-white font-bold">
                      <td className="py-2.5 px-3 sticky left-0 bg-stone-900">Total Expense</td>
                      {monthlyBreakdown.totalExpenseByMonth.map((v, i) => (
                        <td key={i} className="py-2.5 px-2.5 text-right font-mono">
                          {fmtMoney(v)}
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-right font-mono text-amber-300">
                        {fmtMoney(monthlyBreakdown.totalExpenseByMonth.reduce((a, b) => a + b, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table C: Monthly Profitability Summary */}
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-4 bg-stone-50 border-b border-stone-200">
                <h4 className="font-serif font-bold text-stone-900 text-sm">
                  Monthly Profitability &amp; Labour Summary ({selectedYear})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 text-stone-600 font-bold text-[10px] uppercase">
                      <th className="py-2.5 px-3 sticky left-0 bg-stone-100">Metric</th>
                      {MONTH_LABELS.map((m) => (
                        <th key={m} className="py-2.5 px-2.5 text-right font-mono">
                          {m}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-right font-mono bg-emerald-50 text-emerald-950">
                        Annual Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    <tr>
                      <td className="py-2 px-3 font-bold text-stone-800 sticky left-0 bg-white">
                        Net Income (Cash Flow)
                      </td>
                      {monthlyBreakdown.netIncomeByMonth.map((v, i) => (
                        <td
                          key={i}
                          className={`py-2 px-2.5 text-right font-mono font-semibold ${
                            v < 0 ? "text-red-600" : v > 0 ? "text-emerald-700" : "text-stone-300"
                          }`}
                        >
                          {fmtMoney(v)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono font-bold bg-stone-50">
                        {fmtMoney(monthlyBreakdown.netIncomeByMonth.reduce((a, b) => a + b, 0))}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-stone-800 sticky left-0 bg-white">
                        Product Profit
                      </td>
                      {monthlyBreakdown.profitByMonth.map((v, i) => (
                        <td
                          key={i}
                          className={`py-2 px-2.5 text-right font-mono ${
                            v !== 0 ? "text-stone-900 font-semibold" : "text-stone-300"
                          }`}
                        >
                          {fmtMoney(v)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono font-bold bg-stone-50">
                        {fmtMoney(monthlyBreakdown.profitByMonth.reduce((a, b) => a + b, 0))}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-stone-800 sticky left-0 bg-white">
                        Labour Cost Earned
                      </td>
                      {monthlyBreakdown.laborByMonth.map((v, i) => (
                        <td
                          key={i}
                          className={`py-2 px-2.5 text-right font-mono ${
                            v !== 0 ? "text-stone-900 font-semibold" : "text-stone-300"
                          }`}
                        >
                          {fmtMoney(v)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono font-bold bg-stone-50">
                        {fmtMoney(monthlyBreakdown.laborByMonth.reduce((a, b) => a + b, 0))}
                      </td>
                    </tr>
                    <tr className="bg-emerald-950 text-white font-bold">
                      <td className="py-2.5 px-3 sticky left-0 bg-emerald-950">
                        Profit + LC (Total Take-Home)
                      </td>
                      {monthlyBreakdown.profitPlusLCByMonth.map((v, i) => (
                        <td key={i} className="py-2.5 px-2.5 text-right font-mono">
                          {fmtMoney(v)}
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-300">
                        {fmtMoney(monthlyBreakdown.profitPlusLCByMonth.reduce((a, b) => a + b, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 2: INCOME & SALES TRACKER
         ========================================================================== */}
      {subTab === "income" && (
        <div className="space-y-6 animate-fade-in">
          {/* Log Sale Form */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-serif font-bold text-stone-900 text-base flex items-center gap-2">
                  <Plus className="h-4 w-4 text-brand-primary" /> Log New Sale (Website, Marketplace, Social, or Custom)
                </h4>
                <p className="text-xs text-stone-500">
                  Select a product to auto-fill Sale Price, Item Cost &amp; Labor Cost, and automatically deduct recipe materials from Inventory.
                </p>
              </div>
            </div>

            <form onSubmit={handleLogSale} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Sale Date</label>
                <input
                  type="date"
                  value={saleForm.date}
                  onChange={(e) => setSaleForm({ ...saleForm, date: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded-lg p-2"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-stone-700 block mb-1">
                  Product Sold (Recipe / Website Catalog Dropdown)
                </label>
                <select
                  value={saleForm.selectedProductKey}
                  onChange={(e) => handleSelectSaleProduct(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-lg p-2 font-semibold"
                >
                  <optgroup label="Spreadsheet Product Recipes (Auto-fills Cost & Labor)">
                    {store.recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — Price: {fmtMoney(r.actualPrice)} | Cost: {fmtMoney(r.totalCost)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Website Catalog Products">
                    {websiteProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        [Website] {p.name} — {fmtMoney(p.promoPrice || p.price)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="One-Off / Custom Item">
                    <option value="CUSTOM_OTHER">Other (Custom One-Off Item)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Platform / Client</label>
                <input
                  list="sales-platforms-list"
                  value={saleForm.platform}
                  onChange={(e) => setSaleForm({ ...saleForm, platform: e.target.value })}
                  placeholder="Marketplace, JP Baskets, Website..."
                  className="w-full bg-white border border-stone-300 rounded-lg p-2"
                  required
                />
                <datalist id="sales-platforms-list">
                  {SALES_PLATFORMS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              {saleForm.selectedProductKey === "CUSTOM_OTHER" && (
                <div className="sm:col-span-2">
                  <label className="font-bold text-stone-700 block mb-1">Custom Item Name</label>
                  <input
                    type="text"
                    value={saleForm.customItemName}
                    onChange={(e) => setSaleForm({ ...saleForm, customItemName: e.target.value })}
                    placeholder="e.g. Custom Wedding Gift Box"
                    className="w-full bg-white border border-stone-300 rounded-lg p-2"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-stone-700 block mb-1">Sale Price ($/unit)</label>
                <input
                  type="number"
                  step="0.01"
                  value={saleForm.salePrice}
                  onChange={(e) => setSaleForm({ ...saleForm, salePrice: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded-lg p-2 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Item Cost ($/unit)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={saleForm.itemCost}
                  onChange={(e) => setSaleForm({ ...saleForm, itemCost: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded-lg p-2 font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Labour Cost / Item ($)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={saleForm.laborCostPerItem}
                  onChange={(e) => setSaleForm({ ...saleForm, laborCostPerItem: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded-lg p-2 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={saleForm.qty}
                    onChange={(e) => setSaleForm({ ...saleForm, qty: e.target.value })}
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Discount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={saleForm.discount}
                    onChange={(e) => setSaleForm({ ...saleForm, discount: e.target.value })}
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Tip ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={saleForm.tip}
                    onChange={(e) => setSaleForm({ ...saleForm, tip: e.target.value })}
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              {/* Live Formula Preview & Submit */}
              <div className="sm:col-span-2 lg:col-span-4 pt-2 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
                {(() => {
                  const preview = computeIncomeRow({
                    date: saleForm.date,
                    itemSold: "Preview",
                    platform: saleForm.platform,
                    salePrice: Number(saleForm.salePrice) || 0,
                    itemCost: Number(saleForm.itemCost) || 0,
                    laborCostPerItem: Number(saleForm.laborCostPerItem) || 0,
                    qty: Number(saleForm.qty) || 1,
                    discount: Number(saleForm.discount) || 0,
                    tip: Number(saleForm.tip) || 0
                  });
                  return (
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5 font-semibold text-stone-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saleForm.deductInventory}
                          onChange={(e) =>
                            setSaleForm({ ...saleForm, deductInventory: e.target.checked })
                          }
                          className="rounded text-brand-primary"
                        />
                        Auto-deduct recipe materials from Inventory
                      </label>
                      <span className="font-mono text-stone-600">
                        Total Income: <strong className="text-stone-900">{fmtMoney(preview.totalIncome)}</strong>
                      </span>
                      <span className="font-mono text-stone-600">
                        Total Labour: <strong className="text-stone-900">{fmtMoney(preview.totalLaborCost)}</strong>
                      </span>
                      <span className="font-mono text-stone-600">
                        Total Profit:{" "}
                        <strong className={preview.totalProfit >= 0 ? "text-emerald-700" : "text-red-600"}>
                          {fmtMoney(preview.totalProfit)}
                        </strong>
                      </span>
                    </div>
                  );
                })()}

                <button
                  type="submit"
                  className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2.5 px-5 rounded-xl text-xs cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="h-4 w-4" /> Record Sale in Income
                </button>
              </div>
            </form>
          </div>

          {/* Income Table */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={incomeSearch}
                    onChange={(e) => setIncomeSearch(e.target.value)}
                    placeholder="Search item sold or platform..."
                    className="pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <select
                  value={incomePlatformFilter}
                  onChange={(e) => setIncomePlatformFilter(e.target.value)}
                  className="bg-white border border-stone-300 rounded-lg py-1.5 px-2.5 text-xs font-semibold"
                >
                  <option value="all">All Platforms</option>
                  {monthlyBreakdown.activePlatforms.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() =>
                  exportCsv(
                    `nicoletta-income-${selectedYear}.csv`,
                    [
                      "Date",
                      "Item Sold",
                      "Platform/Client",
                      "Sale Price",
                      "Item Cost",
                      "Labour Cost /Item",
                      "Profit / Item",
                      "Qty",
                      "Total Labour Cost",
                      "Discount",
                      "Tip",
                      "Total Income",
                      "Total Profit"
                    ],
                    filteredIncome.map((r) => [
                      r.date,
                      r.itemSold,
                      r.platform,
                      r.salePrice,
                      r.itemCost,
                      r.laborCostPerItem,
                      r.profitPerItem,
                      r.qty,
                      r.totalLaborCost,
                      r.discount || "",
                      r.tip || "",
                      r.totalIncome,
                      r.totalProfit
                    ])
                  )
                }
                className="bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export Income CSV
              </button>
            </div>

            <div className="overflow-x-auto max-h-[540px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-stone-100 text-stone-600 font-bold text-[10px] uppercase sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Item Sold</th>
                    <th className="py-2.5 px-3">Platform/Client</th>
                    <th className="py-2.5 px-2.5 text-right">Sale Price</th>
                    <th className="py-2.5 px-2.5 text-right">Item Cost</th>
                    <th className="py-2.5 px-2.5 text-right">Labour/Item</th>
                    <th className="py-2.5 px-2.5 text-right">Profit/Item</th>
                    <th className="py-2.5 px-2 text-center">Qty</th>
                    <th className="py-2.5 px-2.5 text-right">Total Labour</th>
                    <th className="py-2.5 px-2 text-right">Disc.</th>
                    <th className="py-2.5 px-2 text-right">Tip</th>
                    <th className="py-2.5 px-3 text-right bg-amber-50 text-amber-950">Total Income</th>
                    <th className="py-2.5 px-3 text-right bg-emerald-50 text-emerald-950">Total Profit</th>
                    <th className="py-2.5 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredIncome
                    .filter((r) => {
                      if (incomePlatformFilter !== "all" && r.platform !== incomePlatformFilter)
                        return false;
                      if (!incomeSearch.trim()) return true;
                      const q = incomeSearch.toLowerCase();
                      return (
                        r.itemSold.toLowerCase().includes(q) ||
                        r.platform.toLowerCase().includes(q) ||
                        r.date.includes(q)
                      );
                    })
                    .map((r) => (
                      <tr key={r.id} className="hover:bg-stone-50">
                        <td className="py-2 px-3 font-mono text-stone-600 whitespace-nowrap">{r.date}</td>
                        <td className="py-2 px-3 font-bold text-stone-900">{r.itemSold}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 bg-stone-100 border border-stone-200 rounded-full text-[10px] font-bold text-stone-700">
                            {r.platform}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono">{fmtMoney(r.salePrice)}</td>
                        <td className="py-2 px-2.5 text-right font-mono text-stone-500">
                          {fmtMoney(r.itemCost)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-stone-500">
                          {fmtMoney(r.laborCostPerItem)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-stone-700">
                          {fmtMoney(r.profitPerItem)}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-bold">{r.qty}</td>
                        <td className="py-2 px-2.5 text-right font-mono">{fmtMoney(r.totalLaborCost)}</td>
                        <td className="py-2 px-2 text-right font-mono text-red-600">
                          {r.discount ? fmtMoney(r.discount) : "—"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-emerald-700">
                          {r.tip ? fmtMoney(r.tip) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold bg-amber-50/40 text-stone-900">
                          {fmtMoney(r.totalIncome)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-bold bg-emerald-50/40 ${
                            r.totalProfit >= 0 ? "text-emerald-800" : "text-red-600"
                          }`}
                        >
                          {fmtMoney(r.totalProfit)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete sale record "${r.itemSold}" (${r.date})?`)) {
                                saveBusinessStore({
                                  income: store.income.filter((x) => x.id !== r.id)
                                });
                              }
                            }}
                            className="text-stone-400 hover:text-red-600 p-1 cursor-pointer"
                            title="Delete sale"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 3: EXPENSES & AI RECEIPT SCANNER
         ========================================================================== */}
      {subTab === "expenses" && (
        <div className="space-y-6 animate-fade-in">
          {/* AI Receipt Scanner Card */}
          <div className="bg-gradient-to-br from-amber-50/90 via-white to-stone-50 border-2 border-amber-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                  <Sparkles className="h-3 w-3 text-amber-700" /> AI Receipt Scanner &amp; Inventory Upsert
                </span>
                <h4 className="font-serif font-bold text-stone-900 text-lg mt-1">
                  Scan or Upload Receipt (Michaels, Dollarama, Amazon, Shein, Staples)
                </h4>
                <p className="text-xs text-stone-600">
                  Upload a photo/PDF of a receipt or paste order lines. Review and rename abbreviated items before saving to Expenses &amp; Inventory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowApiKeyConfig(!showApiKeyConfig)}
                className="text-[11px] font-bold text-stone-600 hover:text-stone-900 underline cursor-pointer"
              >
                {showApiKeyConfig ? "Hide AI Key Settings" : "Configure Gemini Vision Key"}
              </button>
            </div>

            {showApiKeyConfig && (
              <div className="bg-white border border-stone-200 rounded-xl p-3.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-stone-700">Gemini API Key (Optional):</span>
                <input
                  type="password"
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder="AIzaSy... (uses server GEMINI_API_KEY + smart parser by default)"
                  className="flex-1 min-w-[240px] border border-stone-300 rounded-lg px-2.5 py-1.5 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    saveBusinessStore({
                      settings: { ...store.settings, geminiApiKey: geminiKeyInput.trim() }
                    });
                    showToast("Saved Gemini API key for Receipt Vision OCR!");
                  }}
                  className="bg-stone-900 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  Save Key
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Upload Photo/PDF */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer?.files?.[0];
                  if (file) processReceiptFile(file);
                }}
                className="lg:col-span-5 flex flex-col justify-between bg-white border-2 border-dashed border-amber-300 rounded-xl p-4 text-center space-y-3"
              >
                <div className="space-y-1">
                  <Upload className="h-7 w-7 text-amber-700 mx-auto" />
                  <p className="font-bold text-stone-800 text-xs">
                    Upload or Drop Receipt Photo / PDF
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Automatically reads &amp; detects items and prices from JPG, PNG, WEBP, or PDF receipts
                  </p>
                  {isScanningReceipt && scanProgressStatus && (
                    <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg py-1.5 px-3 animate-pulse">
                      {scanProgressStatus}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <label className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer transition-colors inline-flex items-center gap-1.5 shadow-xs">
                    <Upload className="h-3.5 w-3.5" />
                    <span>
                      {isScanningReceipt
                        ? scanProgressStatus || "Scanning Receipt..."
                        : "Choose Receipt Image / PDF"}
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf,.pdf"
                      onChange={handleReceiptFileUpload}
                      className="hidden"
                      disabled={isScanningReceipt}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const sample = `Michaels\n2026-05-25\nSUBL PPR 8.5X11 43.69\n15OZ WHITE MUGS 6PK 34.50\nSUBL TAPE ROLL 16.09\nPKG TRACE PAPER 23.00`;
                      setReceiptRawText(sample);
                      handleScanReceiptText(sample);
                    }}
                    className="bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold py-2 px-3 rounded-xl text-xs cursor-pointer transition-colors"
                  >
                    Try Sample Receipt
                  </button>
                </div>
              </div>

              {/* Paste Receipt Text / Order Summary */}
              <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700">
                    Detected / Pasted Receipt Text (Editable)
                  </label>
                  <span className="text-[10px] text-stone-400">
                    Auto-populated when you upload a photo/PDF, or paste lines directly
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={receiptRawText}
                  onChange={(e) => setReceiptRawText(e.target.value)}
                  placeholder={`Michaels\nSUBL PPR 8.5X11 43.69\n11OZ MUG 6PK 26.45\nPKG TRACE PAPER 23.00`}
                  className="w-full border border-stone-300 rounded-lg p-2.5 text-xs font-mono"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleScanReceiptText()}
                    disabled={isScanningReceipt}
                    className="bg-stone-900 hover:bg-stone-800 text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span>Parse &amp; Review Items</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Review & Rename Staging Table */}
            {showReceiptReview && (
              <div className="bg-white border-2 border-emerald-600 rounded-2xl p-4 md:p-5 space-y-4 animate-fade-in shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-200">
                  <div>
                    <h5 className="font-serif font-bold text-stone-900 text-base flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" /> Review, Rename &amp; Sync Scanned Receipt Items
                    </h5>
                    <p className="text-[11px] text-stone-500">
                      Rename receipt abbreviations (e.g. &ldquo;SUBL PPR&rdquo; &rarr; &ldquo;Sublimation Paper&rdquo;), set pack count (#Items) to calculate exact Unit Price, and toggle Inventory sync.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReceiptReview(false)}
                    className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Receipt Header Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Store / Vendor</label>
                    <input
                      type="text"
                      value={receiptDraftVendor}
                      onChange={(e) => setReceiptDraftVendor(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg p-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Receipt Date</label>
                    <input
                      type="date"
                      value={receiptDraftDate}
                      onChange={(e) => setReceiptDraftDate(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg p-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Payment Method</label>
                    <input
                      type="text"
                      value={receiptDraftPayment}
                      onChange={(e) => setReceiptDraftPayment(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg p-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Expense Logging Mode</label>
                    <select
                      value={receiptLogMode}
                      onChange={(e) => setReceiptLogMode(e.target.value as "per-item" | "single-receipt")}
                      className="w-full border border-stone-300 rounded-lg p-2 font-semibold"
                    >
                      <option value="per-item">Log each item as a row</option>
                      <option value="single-receipt">Log 1 combined receipt row</option>
                    </select>
                  </div>
                </div>

                {/* Line Items Editable Table */}
                <div className="overflow-x-auto">
                  <datalist id="inventory-material-names-list">
                    {store.inventory.map((inv) => (
                      <option key={inv.id} value={inv.name} />
                    ))}
                  </datalist>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-100 text-stone-600 font-bold text-[10px] uppercase">
                        <th className="py-2 px-2">Raw Receipt Text</th>
                        <th className="py-2 px-2.5 min-w-[260px]">
                          Material / Item Name (Pick from Inventory or Add New)
                        </th>
                        <th className="py-2 px-2">Category</th>
                        <th className="py-2 px-2 text-right"># Packs Bought</th>
                        <th className="py-2 px-2 text-right">Pieces / Pack</th>
                        <th className="py-2 px-2 text-center bg-amber-50 text-amber-950">
                          Total Pieces
                        </th>
                        <th className="py-2 px-2 text-right">Line Price ($)</th>
                        <th className="py-2 px-2.5 text-right bg-emerald-50 text-emerald-950">
                          Cost / Piece
                        </th>
                        <th className="py-2 px-2 text-center">Sync Inv.</th>
                        <th className="py-2 px-2 text-center">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {receiptDraftItems.map((it, idx) => {
                        const qtyBought = Math.max(1, Number(it.qtyBought) || 1);
                        const piecesPerPack = Math.max(1, Number(it.packQty) || 1);
                        const totalPieces = qtyBought * piecesPerPack;
                        const linePrice = Number(it.price) || 0;
                        const costPerPiece = linePrice / totalPieces;
                        const isExistingSelected = Boolean(
                          it.matchedInventoryId &&
                            store.inventory.some((inv) => inv.id === it.matchedInventoryId)
                        );
                        return (
                          <tr key={it.id} className="hover:bg-stone-50">
                            <td className="py-2 px-2 font-mono text-[11px] text-stone-500 max-w-[140px] truncate" title={it.rawName}>
                              {it.rawName}
                            </td>
                            <td className="py-2 px-2.5">
                              <div className="space-y-1.5">
                                <select
                                  value={isExistingSelected ? it.matchedInventoryId! : "__NEW__"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const next = [...receiptDraftItems];
                                    if (val === "__NEW__") {
                                      next[idx] = {
                                        ...it,
                                        matchedInventoryId: undefined
                                      };
                                    } else {
                                      const matched = store.inventory.find((x) => x.id === val);
                                      if (matched) {
                                        const nextPackQty = matched.bulkQty || 1;
                                        next[idx] = {
                                          ...it,
                                          matchedInventoryId: matched.id,
                                          friendlyName: matched.name,
                                          packQty: nextPackQty,
                                          unitPrice: linePrice / (qtyBought * nextPackQty),
                                          syncToInventory: true
                                        };
                                      }
                                    }
                                    setReceiptDraftItems(next);
                                  }}
                                  className={`w-full border rounded-md px-2 py-1.5 text-xs font-bold cursor-pointer ${
                                    isExistingSelected
                                      ? "bg-emerald-50/70 border-emerald-400 text-emerald-950"
                                      : "bg-amber-50/60 border-amber-300 text-amber-950"
                                  }`}
                                >
                                  <option value="__NEW__">
                                    ➕ Add New Material / Custom Item Name...
                                  </option>
                                  <optgroup label={`Pick from Inventory List (${store.inventory.length} materials)`}>
                                    {store.inventory.map((inv) => (
                                      <option key={inv.id} value={inv.id}>
                                        {inv.name} ({inv.bulkQty} pcs/pack • Stock: {inv.stock} pcs)
                                      </option>
                                    ))}
                                  </optgroup>
                                </select>

                                {!isExistingSelected ? (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      list="inventory-material-names-list"
                                      value={it.friendlyName}
                                      onChange={(e) => {
                                        const typedName = e.target.value;
                                        const exactInv = store.inventory.find(
                                          (inv) =>
                                            inv.name.trim().toLowerCase() ===
                                            typedName.trim().toLowerCase()
                                        );
                                        const next = [...receiptDraftItems];
                                        next[idx] = {
                                          ...it,
                                          friendlyName: typedName,
                                          matchedInventoryId: exactInv?.id,
                                          packQty: exactInv ? exactInv.bulkQty : it.packQty
                                        };
                                        setReceiptDraftItems(next);
                                      }}
                                      placeholder="Type new material name (e.g. Pipe Cleaner Set)..."
                                      className="w-full border border-stone-300 rounded-md px-2 py-1 font-bold text-stone-900 bg-white"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between text-[10px] text-emerald-800 px-1">
                                    <span>
                                      ✓ Linked to Inventory: <strong>{it.friendlyName}</strong>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = [...receiptDraftItems];
                                        next[idx] = { ...it, matchedInventoryId: undefined };
                                        setReceiptDraftItems(next);
                                      }}
                                      className="text-stone-500 hover:text-stone-900 underline cursor-pointer"
                                    >
                                      Rename / New
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <select
                                value={it.category}
                                onChange={(e) => {
                                  const next = [...receiptDraftItems];
                                  next[idx] = { ...it, category: e.target.value as ExpenseCategory };
                                  setReceiptDraftItems(next);
                                }}
                                className="border border-stone-300 rounded-md px-2 py-1 text-[11px] font-semibold"
                              >
                                {EXPENSE_CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={qtyBought}
                                onChange={(e) => {
                                  const nextQtyBought = Math.max(1, Number(e.target.value) || 1);
                                  const next = [...receiptDraftItems];
                                  next[idx] = {
                                    ...it,
                                    qtyBought: nextQtyBought,
                                    unitPrice: linePrice / (nextQtyBought * piecesPerPack)
                                  };
                                  setReceiptDraftItems(next);
                                }}
                                className="w-14 text-right border border-stone-300 rounded-md px-1.5 py-1 font-mono font-bold"
                                title="How many packs/items you bought on this receipt"
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={piecesPerPack}
                                onChange={(e) => {
                                  const nextPackQty = Math.max(1, Number(e.target.value) || 1);
                                  const next = [...receiptDraftItems];
                                  next[idx] = {
                                    ...it,
                                    packQty: nextPackQty,
                                    unitPrice: linePrice / (qtyBought * nextPackQty)
                                  };
                                  setReceiptDraftItems(next);
                                }}
                                className="w-16 text-right border border-stone-300 rounded-md px-1.5 py-1 font-mono font-bold"
                                title="How many individual pieces are inside 1 pack (e.g. 300 pieces per pack)"
                              />
                            </td>
                            <td className="py-2 px-2 text-center font-mono font-bold text-amber-950 bg-amber-50/50">
                              +{totalPieces} pcs
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={it.price}
                                onChange={(e) => {
                                  const price = Number(e.target.value);
                                  const next = [...receiptDraftItems];
                                  next[idx] = {
                                    ...it,
                                    price,
                                    unitPrice: price / totalPieces
                                  };
                                  setReceiptDraftItems(next);
                                }}
                                className="w-20 text-right border border-stone-300 rounded-md px-2 py-1 font-mono font-bold"
                                title="Total price paid on receipt for all packs bought on this line"
                              />
                              {qtyBought > 1 && (
                                <span className="block text-[10px] font-mono text-stone-400">
                                  ({fmtMoney(linePrice / qtyBought)}/pack)
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-800 bg-emerald-50/40">
                              {fmtMoney(costPerPiece, 4)}/pc
                            </td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={it.syncToInventory}
                                onChange={(e) => {
                                  const next = [...receiptDraftItems];
                                  next[idx] = { ...it, syncToInventory: e.target.checked };
                                  setReceiptDraftItems(next);
                                }}
                                className="h-4 w-4 accent-emerald-600 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setReceiptDraftItems(receiptDraftItems.filter((_, i) => i !== idx))
                                }
                                className="text-stone-400 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-200">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setReceiptDraftItems([
                          ...receiptDraftItems,
                          {
                            id: `scan_${Date.now()}`,
                            rawName: "MANUAL LINE",
                            friendlyName: "New Receipt Material",
                            category: "Material",
                            qtyBought: 1,
                            price: 10,
                            packQty: 1,
                            unitPrice: 10,
                            syncToInventory: true
                          }
                        ])
                      }
                      className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Another Receipt Line
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = receiptDraftItems.map((it) => {
                          const taxedPrice = Number(((Number(it.price) || 0) * 1.15).toFixed(2));
                          const totPcs =
                            Math.max(1, Number(it.qtyBought) || 1) *
                            Math.max(1, Number(it.packQty) || 1);
                          return {
                            ...it,
                            price: taxedPrice,
                            unitPrice: Number((taxedPrice / totPcs).toFixed(4))
                          };
                        });
                        setReceiptDraftItems(updated);
                        showToast("Added 15% HST to all item prices!");
                      }}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold py-1 px-2.5 rounded-lg text-[11px] cursor-pointer transition-colors"
                      title="Multiply pre-tax receipt item prices by 1.15 (+15% HST)"
                    >
                      +15% HST to Item Prices
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {receiptDetectedTax !== undefined && receiptDetectedTax > 0 && (
                      <span className="text-[11px] font-mono text-stone-500">
                        Detected Tax: {fmtMoney(receiptDetectedTax)}
                      </span>
                    )}
                    {receiptDetectedTotal !== undefined && receiptDetectedTotal > 0 && (
                      <span className="text-[11px] font-mono text-stone-500">
                        Receipt Total Printed: {fmtMoney(receiptDetectedTotal)}
                      </span>
                    )}
                    <span className="text-xs font-mono font-bold text-stone-800">
                      Items Sum:{" "}
                      {fmtMoney(receiptDraftItems.reduce((s, i) => s + (Number(i.price) || 0), 0))}
                    </span>
                    <button
                      type="button"
                      onClick={handleCommitScannedReceipt}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="h-4 w-4" /> Commit Receipt &amp; Sync Inventory
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Manual Expense Entry Form */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-3">
            <h4 className="font-serif font-bold text-stone-900 text-base">
              Manual Expense / Refund Entry
            </h4>
            <form onSubmit={handleAddManualExpense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Date</label>
                <input
                  type="date"
                  value={manualExpForm.date}
                  onChange={(e) => setManualExpForm({ ...manualExpForm, date: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded-lg p-2"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Category</label>
                <select
                  value={manualExpForm.category}
                  onChange={(e) =>
                    setManualExpForm({ ...manualExpForm, category: e.target.value as ExpenseCategory })
                  }
                  className="w-full bg-white border border-stone-300 rounded-lg p-2 font-semibold"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="font-bold text-stone-700 block mb-1">
                  Description / Vendor (e.g. Michaels, Amazon, Dollarama)
                </label>
                <input
                  type="text"
                  value={manualExpForm.description}
                  onChange={(e) => setManualExpForm({ ...manualExpForm, description: e.target.value })}
                  placeholder="Michaels, Amazon, Shein, Dollarama..."
                  className="w-full bg-white border border-stone-300 rounded-lg p-2"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Payment Method</label>
                <input
                  type="text"
                  value={manualExpForm.paymentMethod}
                  onChange={(e) =>
                    setManualExpForm({ ...manualExpForm, paymentMethod: e.target.value })
                  }
                  className="w-full bg-white border border-stone-300 rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  Price ($) {manualExpForm.category === "Refund" && "(auto-negative)"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={manualExpForm.price}
                  onChange={(e) => setManualExpForm({ ...manualExpForm, price: e.target.value })}
                  placeholder="48.26"
                  className="w-full bg-white border border-stone-300 rounded-lg p-2 font-mono font-bold"
                  required
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-6 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-200">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 font-semibold text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualExpForm.syncToInventory}
                      onChange={(e) =>
                        setManualExpForm({ ...manualExpForm, syncToInventory: e.target.checked })
                      }
                    />
                    Also add/update this item in Inventory
                  </label>
                  {manualExpForm.syncToInventory && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={manualExpForm.selectedInventoryId}
                        onChange={(e) => {
                          const val = e.target.value;
                          const matched = store.inventory.find((x) => x.id === val);
                          setManualExpForm({
                            ...manualExpForm,
                            selectedInventoryId: val,
                            packQty: matched ? String(matched.bulkQty) : manualExpForm.packQty
                          });
                        }}
                        className="bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold text-stone-900"
                      >
                        <option value="__NEW__">➕ Add New Material to Inventory...</option>
                        <optgroup label="Pick Existing Material from Inventory">
                          {store.inventory.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.name} (Pack of {inv.bulkQty})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      {manualExpForm.selectedInventoryId === "__NEW__" && (
                        <input
                          type="text"
                          value={manualExpForm.newMaterialName}
                          onChange={(e) =>
                            setManualExpForm({
                              ...manualExpForm,
                              newMaterialName: e.target.value
                            })
                          }
                          placeholder="New material name (e.g. Sublimation Paper)..."
                          className="bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 min-w-[220px]"
                        />
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-stone-600"># Packs Bought:</span>
                        <input
                          type="number"
                          min="1"
                          value={manualExpForm.qty}
                          onChange={(e) =>
                            setManualExpForm({ ...manualExpForm, qty: e.target.value })
                          }
                          className="w-14 bg-white border border-stone-300 rounded px-2 py-1 font-mono font-bold"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-stone-600">Pieces / Pack:</span>
                        <input
                          type="number"
                          min="1"
                          value={manualExpForm.packQty}
                          onChange={(e) =>
                            setManualExpForm({ ...manualExpForm, packQty: e.target.value })
                          }
                          className="w-16 bg-white border border-stone-300 rounded px-2 py-1 font-mono font-bold"
                        />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-1 rounded">
                        = +{(Number(manualExpForm.qty) || 1) * (Number(manualExpForm.packQty) || 1)} total pcs
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-5 rounded-xl text-xs cursor-pointer"
                >
                  + Add Expense Record
                </button>
              </div>
            </form>
          </div>

          {/* Expense Ledger Table */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    placeholder="Filter by store or description..."
                    className="pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <select
                  value={expenseCatFilter}
                  onChange={(e) => setExpenseCatFilter(e.target.value)}
                  className="bg-white border border-stone-300 rounded-lg py-1.5 px-2.5 text-xs font-semibold"
                >
                  <option value="all">All Categories</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-stone-800">
                  Filtered Total: {fmtMoney(summaryKpis.totalExpense)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    exportCsv(
                      `nicoletta-expenses-${selectedYear}.csv`,
                      ["Date", "Category", "Description", "Payment Method", "Price", "Qty", "Total"],
                      filteredExpenses.map((e) => [
                        e.date,
                        e.category,
                        e.description,
                        e.paymentMethod,
                        e.price,
                        e.qty,
                        e.total
                      ])
                    )
                  }
                  className="bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-stone-100 text-stone-600 font-bold text-[10px] uppercase sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Description / Vendor</th>
                    <th className="py-2.5 px-3">Payment Method</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 px-2 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredExpenses
                    .filter((e) => {
                      if (expenseCatFilter !== "all" && e.category !== expenseCatFilter) return false;
                      if (!expenseSearch.trim()) return true;
                      const q = expenseSearch.toLowerCase();
                      return (
                        e.description.toLowerCase().includes(q) ||
                        e.category.toLowerCase().includes(q) ||
                        e.date.includes(q)
                      );
                    })
                    .map((e) => (
                      <tr key={e.id} className="hover:bg-stone-50">
                        <td className="py-2 px-3 font-mono text-stone-600">{e.date}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              e.category === "Refund" || e.total < 0
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-stone-100 text-stone-700"
                            }`}
                          >
                            {e.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-bold text-stone-900">{e.description}</td>
                        <td className="py-2 px-3 font-mono text-stone-500">{e.paymentMethod}</td>
                        <td className="py-2 px-3 text-right font-mono">{fmtMoney(e.price)}</td>
                        <td className="py-2 px-2 text-center font-mono">{e.qty}</td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-bold ${
                            e.total < 0 ? "text-emerald-700" : "text-stone-900"
                          }`}
                        >
                          {fmtMoney(e.total)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete expense "${e.description}" (${fmtMoney(e.total)})?`)) {
                                saveBusinessStore({
                                  expenses: store.expenses.filter((x) => x.id !== e.id)
                                });
                              }
                            }}
                            className="text-stone-400 hover:text-red-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 4: INVENTORY MANAGEMENT
         ========================================================================== */}
      {subTab === "inventory" && (
        <div className="space-y-6 animate-fade-in">
          {/* Status Summary Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-stone-50 border border-stone-200 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-stone-500 block">
                Total Raw Materials
              </span>
              <p className="font-serif font-bold text-xl text-stone-900 mt-0.5">
                {store.inventory.length}
              </p>
            </div>
            <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                In Stock
              </span>
              <p className="font-serif font-bold text-xl text-emerald-900 mt-0.5">
                {store.inventory.filter((i) => i.status === "In stock").length}
              </p>
            </div>
            <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-amber-800 block">
                Re-purchase Needed
              </span>
              <p className="font-serif font-bold text-xl text-amber-900 mt-0.5">
                {store.inventory.filter((i) => i.status === "Re-purchase needed").length}
              </p>
            </div>
            <div className="bg-red-50/80 border border-red-200 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-red-800 block">
                Sold Out / Unavailable
              </span>
              <p className="font-serif font-bold text-xl text-red-900 mt-0.5">
                {
                  store.inventory.filter(
                    (i) => i.status === "Sold out" || i.status === "Temporarily unavailable"
                  ).length
                }
              </p>
            </div>
          </div>

          {/* Add / Edit Raw Material Form */}
          {(isAddingInv || editingInvItem) && (
            <form
              onSubmit={handleSaveInventoryItem}
              className="bg-stone-50 border-2 border-brand-primary rounded-2xl p-5 space-y-4 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-serif font-bold text-stone-900 text-base">
                  {editingInvItem ? `Edit Material: ${editingInvItem.name}` : "Add New Raw Material to Inventory"}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setEditingInvItem(null);
                    setIsAddingInv(false);
                  }}
                  className="text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Item ID</label>
                  <input
                    type="text"
                    value={invForm.itemCode}
                    onChange={(e) => setInvForm({ ...invForm, itemCode: e.target.value })}
                    placeholder="INV-046"
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="font-bold text-stone-700 block mb-1">Item Name</label>
                  <input
                    type="text"
                    value={invForm.name}
                    onChange={(e) => setInvForm({ ...invForm, name: e.target.value })}
                    placeholder="e.g. Sublimation Paper 8.5x11"
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Category / Type</label>
                  <input
                    type="text"
                    value={invForm.category}
                    onChange={(e) => setInvForm({ ...invForm, category: e.target.value })}
                    className="w-full bg-white border border-stone-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Price per Pack ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={invForm.bulkPrice}
                    onChange={(e) => setInvForm({ ...invForm, bulkPrice: e.target.value })}
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">
                    Pieces per Pack (e.g. 300)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0.1"
                    value={invForm.bulkQty}
                    onChange={(e) => setInvForm({ ...invForm, bulkQty: e.target.value })}
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">
                    Stock (Total Pieces)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={invForm.stock}
                    onChange={(e) => setInvForm({ ...invForm, stock: e.target.value })}
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Min Alert Stock</label>
                  <input
                    type="number"
                    value={invForm.minStock}
                    onChange={(e) => setInvForm({ ...invForm, minStock: e.target.value })}
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Status Override</label>
                  <select
                    value={invForm.status}
                    onChange={(e) =>
                      setInvForm({ ...invForm, status: e.target.value as InventoryStatus })
                    }
                    className="w-full bg-white border border-stone-300 rounded-lg p-2"
                  >
                    <option value="In stock">In stock</option>
                    <option value="Re-purchase needed">Re-purchase needed</option>
                    <option value="Temporarily unavailable">Temporarily unavailable</option>
                    <option value="Sold out">Sold out</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label className="font-bold text-stone-700 block mb-1">Notes</label>
                  <input
                    type="text"
                    value={invForm.notes}
                    onChange={(e) => setInvForm({ ...invForm, notes: e.target.value })}
                    placeholder="Supplier link, pack details..."
                    className="w-full bg-white border border-stone-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-200 text-xs">
                <span className="font-mono text-stone-600">
                  Calculated Unit Price:{" "}
                  <strong className="text-emerald-800">
                    {fmtMoney(
                      (Number(invForm.bulkPrice) || 0) / Math.max(0.1, Number(invForm.bulkQty) || 1),
                      4
                    )}
                  </strong>
                </span>
                <button
                  type="submit"
                  className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-5 rounded-xl cursor-pointer"
                >
                  Save Material
                </button>
              </div>
            </form>
          )}

          {/* Inventory Table */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                    placeholder="Search material name or ID..."
                    className="pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs"
                  />
                </div>
                <select
                  value={invStatusFilter}
                  onChange={(e) => setInvStatusFilter(e.target.value)}
                  className="bg-white border border-stone-300 rounded-lg py-1.5 px-2.5 text-xs font-semibold"
                >
                  <option value="all">All Statuses</option>
                  <option value="In stock">In stock</option>
                  <option value="Re-purchase needed">Re-purchase needed</option>
                  <option value="Temporarily unavailable">Temporarily unavailable</option>
                  <option value="Sold out">Sold out</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingInvItem(null);
                  setInvForm({
                    itemCode: `INV-${String(store.inventory.length + 1).padStart(3, "0")}`,
                    name: "",
                    category: "Sublimation Blanks",
                    bulkPrice: "",
                    bulkQty: "1",
                    stock: "10",
                    minStock: "4",
                    status: "In stock",
                    notes: ""
                  });
                  setIsAddingInv(true);
                }}
                className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Raw Material
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-stone-100 text-stone-600 font-bold text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Item ID</th>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">Type / Category</th>
                    <th className="py-2.5 px-2.5 text-right">Pack Price</th>
                    <th className="py-2.5 px-2.5 text-right">Pieces / Pack</th>
                    <th className="py-2.5 px-2.5 text-right">Cost / Piece</th>
                    <th className="py-2.5 px-3 text-center">Stock (Pieces)</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {store.inventory
                    .filter((it) => {
                      if (invStatusFilter !== "all" && it.status !== invStatusFilter) return false;
                      if (!invSearch.trim()) return true;
                      const q = invSearch.toLowerCase();
                      return (
                        it.name.toLowerCase().includes(q) ||
                        it.itemCode.toLowerCase().includes(q) ||
                        it.category.toLowerCase().includes(q)
                      );
                    })
                    .map((it) => (
                      <tr
                        key={it.id}
                        className={`hover:bg-stone-50 ${
                          it.status === "Sold out"
                            ? "bg-red-50/40"
                            : it.status === "Re-purchase needed"
                            ? "bg-amber-50/40"
                            : ""
                        }`}
                      >
                        <td className="py-2 px-3 font-mono font-bold text-stone-500">
                          {it.itemCode}
                        </td>
                        <td className="py-2 px-3 font-bold text-stone-900">{it.name}</td>
                        <td className="py-2 px-3 text-stone-600">{it.category}</td>
                        <td className="py-2 px-2.5 text-right font-mono">{fmtMoney(it.bulkPrice)}</td>
                        <td className="py-2 px-2.5 text-right font-mono">{it.bulkQty}</td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-800">
                          {fmtMoney(it.unitPrice, 4)}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAdjustStock(it.id, -1)}
                              className="w-5 h-5 rounded bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold flex items-center justify-center cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-mono font-bold w-8 text-center">{it.stock}</span>
                            <button
                              type="button"
                              onClick={() => handleAdjustStock(it.id, 1)}
                              className="w-5 h-5 rounded bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold flex items-center justify-center cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              it.status === "In stock"
                                ? "bg-emerald-100 text-emerald-800"
                                : it.status === "Re-purchase needed"
                                ? "bg-amber-100 text-amber-900"
                                : it.status === "Temporarily unavailable"
                                ? "bg-stone-200 text-stone-700"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {it.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-stone-500 max-w-[180px] truncate">
                          {it.notes || "—"}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingInvItem(it);
                                setInvForm({
                                  itemCode: it.itemCode,
                                  name: it.name,
                                  category: it.category,
                                  bulkPrice: String(it.bulkPrice),
                                  bulkQty: String(it.bulkQty),
                                  stock: String(it.stock),
                                  minStock: String(it.minStock),
                                  status: it.status,
                                  notes: it.notes || ""
                                });
                              }}
                              className="text-stone-500 hover:text-stone-900 p-1 cursor-pointer"
                              title="Edit"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete material "${it.name}" from Inventory?`)) {
                                  saveBusinessStore({
                                    inventory: store.inventory.filter((x) => x.id !== it.id)
                                  });
                                }
                              }}
                              className="text-stone-400 hover:text-red-600 p-1 cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 5: ITEM PRICING & RECIPE CALCULATOR
         ========================================================================== */}
      {subTab === "item-pricing" && !activeRecipe && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-8 text-center space-y-3 animate-fade-in">
          <p className="text-sm font-bold text-stone-700">No product recipes remaining.</p>
          <button
            type="button"
            onClick={handleCreateNewRecipe}
            className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-4 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Create Product Recipe
          </button>
        </div>
      )}

      {subTab === "item-pricing" && activeRecipe && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Bar: Select Product Recipe or Create New + Global Labor Rate */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <label className="text-xs font-bold text-stone-700">Select Product Recipe:</label>
              <select
                value={activeRecipe.id}
                onChange={(e) => setSelectedRecipeId(e.target.value)}
                className="bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 min-w-[260px]"
              >
                {store.recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.category}) — Final Price: {fmtMoney(r.actualPrice)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCreateNewRecipe}
                className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> New Recipe
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRecipe(activeRecipe.id)}
                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="Delete this product recipe"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Recipe
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-stone-700">Global Labor Rate ($/hr):</span>
              <input
                type="number"
                step="0.5"
                value={store.settings.hourlyLaborRate}
                onChange={(e) => handleUpdateLaborRate(Number(e.target.value))}
                className="w-20 bg-white border border-stone-300 rounded-lg px-2 py-1.5 font-mono font-bold text-center"
              />
            </div>
          </div>

          {/* Recipe Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 cols: Bill of Materials Table */}
            <div className="lg:col-span-7 bg-white border border-stone-200 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pb-3 border-b border-stone-200">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Product Recipe Name</label>
                  <input
                    type="text"
                    value={activeRecipe.name}
                    onChange={(e) => handleUpdateActiveRecipe({ name: e.target.value })}
                    className="w-full border border-stone-300 rounded-lg p-2 font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Craft Category</label>
                  <select
                    value={activeRecipe.category}
                    onChange={(e) => handleUpdateActiveRecipe({ category: e.target.value })}
                    className="w-full border border-stone-300 rounded-lg p-2 font-semibold"
                  >
                    {PRODUCT_CRAFT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="font-bold text-stone-700 block mb-1">
                    Linked Website Catalog Product (for 1-click price sync &amp; auto-order deduction)
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={activeRecipe.websiteProductId || ""}
                      onChange={(e) =>
                        handleUpdateActiveRecipe({ websiteProductId: e.target.value || undefined })
                      }
                      className="flex-1 border border-stone-300 rounded-lg p-2"
                    >
                      <option value="">-- Match by Name or Select Website Craft --</option>
                      {websiteProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Current Website Price: ${p.price})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleSyncRecipePriceToWebsite(activeRecipe)}
                      className="bg-stone-900 hover:bg-stone-800 text-white font-bold px-3 py-2 rounded-lg whitespace-nowrap cursor-pointer"
                    >
                      Sync ${activeRecipe.actualPrice} to Website
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h5 className="font-serif font-bold text-stone-900 text-sm">
                  Bill of Materials (Recipe Ingredients)
                </h5>
                <span className="font-mono text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                  Material Cost: {fmtMoney(activeRecipe.materialCost, 4)}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 text-stone-600 font-bold text-[10px] uppercase">
                      <th className="py-2 px-2">Material (From Inventory)</th>
                      <th className="py-2 px-2 text-right">Pack Price ($)</th>
                      <th className="py-2 px-2 text-right">Pieces / Pack</th>
                      <th className="py-2 px-2 text-right">Cost / Piece</th>
                      <th className="py-2 px-2 text-right bg-amber-50 text-amber-950">
                        Pieces Used
                      </th>
                      <th className="py-2 px-2 text-right bg-emerald-50 text-emerald-950">
                        Line Cost
                      </th>
                      <th className="py-2 px-2 text-center">Del</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {activeRecipe.materials.map((m, mIdx) => {
                      const costPerPiece = (Number(m.bulkPrice) || 0) / (Number(m.bulkQty) || 1);
                      const qtyUsed = Number(m.qtyUsed) > 0 ? Number(m.qtyUsed) : 1;
                      return (
                        <tr key={m.id} className="hover:bg-stone-50">
                          <td className="py-2 px-2">
                            <select
                              value={m.inventoryItemId || ""}
                              onChange={(e) => {
                                const invId = e.target.value;
                                const inv = store.inventory.find((i) => i.id === invId);
                                const nextMats = [...activeRecipe.materials];
                                if (inv) {
                                  const unitP = inv.bulkPrice / (inv.bulkQty || 1);
                                  nextMats[mIdx] = {
                                    ...m,
                                    inventoryItemId: inv.id,
                                    name: inv.name,
                                    bulkPrice: inv.bulkPrice,
                                    bulkQty: inv.bulkQty,
                                    unitPrice: unitP,
                                    lineCost: unitP * qtyUsed
                                  };
                                } else {
                                  nextMats[mIdx] = { ...m, inventoryItemId: undefined };
                                }
                                handleUpdateActiveRecipe({ materials: nextMats });
                              }}
                              className="w-full border border-stone-300 rounded px-2 py-1 font-semibold text-stone-800"
                            >
                              <option value="">{m.name}</option>
                              {store.inventory.map((inv) => (
                                <option key={inv.id} value={inv.id}>
                                  {inv.name} (${inv.bulkPrice} / {inv.bulkQty} pcs)
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={m.bulkPrice}
                              onChange={(e) => {
                                const bulkPrice = Number(e.target.value) || 0;
                                const unitP = bulkPrice / (m.bulkQty || 1);
                                const nextMats = [...activeRecipe.materials];
                                nextMats[mIdx] = {
                                  ...m,
                                  bulkPrice,
                                  unitPrice: unitP,
                                  lineCost: unitP * qtyUsed
                                };
                                handleUpdateActiveRecipe({ materials: nextMats });
                              }}
                              className="w-18 text-right border border-stone-300 rounded px-1.5 py-1 font-mono"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="1"
                              min="0.1"
                              value={m.bulkQty}
                              onChange={(e) => {
                                const bulkQty = Math.max(0.1, Number(e.target.value) || 1);
                                const unitP = m.bulkPrice / bulkQty;
                                const nextMats = [...activeRecipe.materials];
                                nextMats[mIdx] = {
                                  ...m,
                                  bulkQty,
                                  unitPrice: unitP,
                                  lineCost: unitP * qtyUsed
                                };
                                handleUpdateActiveRecipe({ materials: nextMats });
                              }}
                              className="w-16 text-right border border-stone-300 rounded px-1.5 py-1 font-mono"
                              title="How many pieces are in 1 pack (e.g. 300 pieces)"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-[11px] text-stone-500">
                            {fmtMoney(costPerPiece, 4)}
                          </td>
                          <td className="py-2 px-2 text-right bg-amber-50/40">
                            <input
                              type="number"
                              step="0.5"
                              min="0.01"
                              value={qtyUsed}
                              onChange={(e) => {
                                const nextQtyUsed = Math.max(0.01, Number(e.target.value) || 1);
                                const unitP = m.bulkPrice / (m.bulkQty || 1);
                                const nextMats = [...activeRecipe.materials];
                                nextMats[mIdx] = {
                                  ...m,
                                  qtyUsed: nextQtyUsed,
                                  unitPrice: unitP,
                                  lineCost: unitP * nextQtyUsed
                                };
                                handleUpdateActiveRecipe({ materials: nextMats });
                              }}
                              className="w-16 text-right border border-amber-300 bg-white rounded px-1.5 py-1 font-mono font-bold text-amber-950"
                              title="How many individual pieces are used for 1 craft (e.g. 75 pipe cleaners for a Sunflower)"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-emerald-900 bg-emerald-50/40">
                            {fmtMoney(m.lineCost, 4)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateActiveRecipe({
                                  materials: activeRecipe.materials.filter((_, i) => i !== mIdx)
                                })
                              }
                              className="text-stone-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => handleAddMaterialToRecipe()}
                className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Material Row from Inventory
              </button>
            </div>

            {/* Right 5 cols: Costing & Profit Margin Formula Card */}
            <div className="lg:col-span-5 bg-stone-900 text-white rounded-2xl p-5 md:p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 block">
                    Item Pricing &amp; Margin Formula
                  </span>
                  <h5 className="font-serif font-bold text-lg text-white">
                    {activeRecipe.name}
                  </h5>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-stone-800">
                    <span className="text-stone-300">Material Cost:</span>
                    <span className="font-mono font-bold text-white">
                      {fmtMoney(activeRecipe.materialCost, 4)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-2 border-b border-stone-800">
                    <div>
                      <label className="text-stone-400 block mb-1">Time Spent (Minutes)</label>
                      <input
                        type="number"
                        min="0"
                        value={activeRecipe.laborMinutes}
                        onChange={(e) => {
                          const mins = Number(e.target.value) || 0;
                          handleUpdateActiveRecipe({
                            laborMinutes: mins,
                            laborHours: mins / 60,
                            laborCost: (mins / 60) * store.settings.hourlyLaborRate
                          });
                        }}
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg p-2 font-mono font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="text-stone-400 block mb-1">Time Spent (Hours)</label>
                      <div className="bg-stone-800/60 border border-stone-800 rounded-lg p-2 font-mono text-stone-300">
                        {activeRecipe.laborHours.toFixed(4)} h
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-stone-800">
                    <span className="text-stone-300">
                      Labor ($) (@ ${store.settings.hourlyLaborRate}/hr):
                    </span>
                    <span className="font-mono font-bold text-amber-300">
                      {fmtMoney(activeRecipe.laborCost, 2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-stone-800">
                    <span className="text-stone-300">Advertising Cost ($):</span>
                    <input
                      type="number"
                      step="0.5"
                      value={activeRecipe.advertisingCost}
                      onChange={(e) =>
                        handleUpdateActiveRecipe({ advertisingCost: Number(e.target.value) || 0 })
                      }
                      className="w-24 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-right font-mono text-white"
                    />
                  </div>

                  <div className="flex items-center justify-between py-2.5 px-3 bg-stone-800 rounded-xl">
                    <span className="font-bold text-white">Total Cost (Item Cost):</span>
                    <span className="font-mono font-bold text-base text-white">
                      {fmtMoney(activeRecipe.totalCost, 2)}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-stone-300 font-bold">Desired Profit Margin (%):</label>
                      <span className="font-mono font-bold text-amber-400">
                        {Math.round(activeRecipe.desiredProfitPct * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.75"
                      step="0.05"
                      value={activeRecipe.desiredProfitPct}
                      onChange={(e) =>
                        handleUpdateActiveRecipe({ desiredProfitPct: Number(e.target.value) })
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between py-2.5 px-3 bg-amber-500/15 border border-amber-400/30 rounded-xl">
                    <div>
                      <span className="font-bold text-amber-300 block">
                        Calculated Sale Price
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        Total Cost / (1 − {Math.round(activeRecipe.desiredProfitPct * 100)}%)
                      </span>
                    </div>
                    <span className="font-mono font-bold text-lg text-amber-300">
                      {fmtMoney(activeRecipe.calculatedPrice, 2)}
                    </span>
                  </div>

                  <div className="pt-2">
                    <label className="font-bold text-white block mb-1">
                      Actual Selling Price ($) (Website / Market Price)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={activeRecipe.actualPrice}
                      onChange={(e) =>
                        handleUpdateActiveRecipe({ actualPrice: Number(e.target.value) || 0 })
                      }
                      className="w-full bg-white text-stone-900 rounded-xl p-2.5 font-mono font-bold text-base"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-800 grid grid-cols-2 gap-3">
                <div className="bg-stone-800 p-3 rounded-xl">
                  <span className="text-[10px] uppercase text-stone-400 block">
                    Profit per Item
                  </span>
                  <span
                    className={`font-mono font-bold text-base ${
                      activeRecipe.profitPerItem >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {fmtMoney(activeRecipe.profitPerItem)}
                  </span>
                </div>
                <div className="bg-emerald-950 border border-emerald-700/50 p-3 rounded-xl">
                  <span className="text-[10px] uppercase text-emerald-300 block">
                    Profit + Labor Pocketed
                  </span>
                  <span className="font-mono font-bold text-base text-emerald-300">
                    {fmtMoney(activeRecipe.profitPerItem + activeRecipe.laborCost)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          TAB 6: PRODUCTS MASTER TABLE (`Products` Tab Equivalent)
         ========================================================================== */}
      {subTab === "products" && (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs animate-fade-in">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-serif font-bold text-stone-900 text-base">
                Products Master Costing &amp; Margin Table
              </h4>
              <p className="text-xs text-stone-500">
                Complete side-by-side view of all {store.recipes.length} products, item costs, labor time, calculated prices, and profit per item.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                handleCreateNewRecipe();
                setSubTab("item-pricing");
              }}
              className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> New Product Recipe
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-stone-100 text-stone-600 font-bold text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-2.5 text-right">Item Cost</th>
                  <th className="py-2.5 px-2.5 text-right">Labour (min)</th>
                  <th className="py-2.5 px-2.5 text-right">Labour (h)</th>
                  <th className="py-2.5 px-2.5 text-right">Labour Cost/Item</th>
                  <th className="py-2.5 px-2.5 text-right">Calculated Price</th>
                  <th className="py-2.5 px-3 text-right bg-amber-50 text-amber-950">Price</th>
                  <th className="py-2.5 px-3 text-right bg-emerald-50 text-emerald-950">
                    Profit per Item
                  </th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {store.recipes.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50">
                    <td className="py-2 px-3 font-bold text-stone-900">{r.name}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 bg-stone-100 rounded-full text-[10px] font-bold text-stone-700">
                        {r.category}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono">
                      {r.totalCost > 0 ? fmtMoney(r.totalCost) : "—"}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono">{r.laborMinutes}</td>
                    <td className="py-2 px-2.5 text-right font-mono text-stone-500">
                      {r.laborHours.toFixed(2)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono">
                      {r.laborCost > 0 ? fmtMoney(r.laborCost) : "—"}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-stone-600">
                      {r.calculatedPrice > 0 ? fmtMoney(r.calculatedPrice) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold bg-amber-50/40 text-stone-900">
                      {r.actualPrice > 0 ? fmtMoney(r.actualPrice) : "—"}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono font-bold bg-emerald-50/40 ${
                        r.profitPerItem > 0 ? "text-emerald-800" : "text-stone-400"
                      }`}
                    >
                      {fmtMoney(r.profitPerItem)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRecipeId(r.id);
                            setSubTab("item-pricing");
                          }}
                          className="text-brand-primary hover:underline font-bold text-[11px] cursor-pointer"
                        >
                          Edit Recipe &rarr;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecipe(r.id)}
                          className="text-stone-400 hover:text-red-600 p-1 cursor-pointer transition-colors"
                          title={`Delete recipe "${r.name}"`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
