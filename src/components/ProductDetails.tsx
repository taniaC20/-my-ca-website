import React, { useState, useRef } from "react";
import {
  ArrowLeft,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  HelpCircle,
  Truck,
  RefreshCw,
  Sparkles,
  PenTool,
  Hash,
  Calendar,
  Upload,
  Paperclip,
  Trash2,
  Send,
  Clock,
  Ruler,
  Mail,
  Phone,
  Video,
  Play,
  Image as ImageIcon
} from "lucide-react";
import { Product, QuoteRequest, getEmbedVideoUrl } from "../types";
import { validateEmailAddress, validatePhoneNumber, formatPhoneInput } from "../emailService";

interface ProductDetailsProps {
  product: Product;
  categoryName: string;
  onBack: () => void;
  onRequestQuote: (p: Product) => void;
  onSubmitQuote?: (quote: Omit<QuoteRequest, "id" | "createdAt" | "updatedAt" | "status">) => void;
}

export default function ProductDetails({
  product,
  categoryName,
  onBack,
  onRequestQuote,
  onSubmitQuote
}: ProductDetailsProps): React.JSX.Element {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeMedia, setActiveMedia] = useState<"image" | "video">("image");

  // Form States
  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    contactPreference: "email" as "email" | "phone",
    engravingText: "",
    fontPreference: "Classic Cursive (Dancing Script)",
    specialInstructions: "",
    quantity: 1,
    deadline: "",
    alternativeRequest: false,
    alternativeDetails: "",
  });

  const [changeFont, setChangeFont] = useState<boolean>(false);

  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number; url: string }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedQuoteInfo, setSubmittedQuoteInfo] = useState<{
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    contactPreference: "email" | "phone";
    productName: string;
  } | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const hasPromo = product.promoPrice !== undefined && product.promoPrice < product.price;
  const discountPercent = hasPromo ? Math.round(((product.price - (product.promoPrice ?? 0)) / product.price) * 100) : 0;

  // Rich material storytelling tailored to product type
  const getMaterialDescription = (catId: string) => {
    switch (catId) {
      case "wood":
        return {
          title: "Premium Sustainable Hardwoods",
          details: "American Black Walnut, Curly Maple, or Oregon Black Cherry. Sourced from FSC-certified sustainable timber yards. Hand-planed, grain-matched, and fully conditioned in our workshop using organic, food-safe linseed oil and raw Oregon beeswax. Ready to become a multi-generation family heirloom.",
          badge: "FSC Certified Hardwood",
          seal: "100% Food-Safe & Organic"
        };
      case "leather":
        return {
          title: "Vegetable-Tanned Full-Grain Leather",
          details: "Hand-selected full-grain hide from local American tanneries. Tanned with organic tree bark and plant extracts. Laser-branded at specialized temperatures to burn deep, crisp contrast into the fibers. Finished with natural leather conditioning oils to develop a rich, personal amber patina.",
          badge: "A5 Heritage Leather",
          seal: "Premium Veg-Tanned Patina"
        };
      case "glassware":
        return {
          title: "Lead-Free High-Clarity Crystal",
          details: "Double-weighted crystalline formulation. Each piece is masked with custom vector lasers, then meticulously sandblast-etched by hand using ultra-fine abrasive compound in our workshop. Provides a permanent, velvet-smooth frosted touch that is 100% dishwasher safe.",
          badge: "Permanently Hand-Etched",
          seal: "Dishwasher Safe Frosted"
        };
      case "slate":
        return {
          title: "Natural Organic Metamorphic Slate",
          details: "Dark metamorphic slate stone cleaved along natural planes to expose rustic split edges. Highly heat-resistant and sealed with water-repellent protective coatings. Outfitted with heavy-duty non-slip organic rubber surface bumpers on the underside.",
          badge: "100% Natural Portland Stone",
          seal: "Cleaved Rustic Slate"
        };
      default:
        return {
          title: "Artisan Hardwood & Earth Materials",
          details: "Individually hand-planed American hardwoods, full-grain leather goods, sandblasted crystal, and hand-cleaved natural slate. Sourced sustainably and crafted piece-by-piece in Portland, Oregon.",
          badge: "Hand-Finished in Oregon",
          seal: "Artisan Bench Crafted"
        };
    }
  };

  const material = getMaterialDescription(product.categoryId);

  const fontOptions = [
    { name: "Classic Cursive (Dancing Script)", class: "", fontFamily: "'Dancing Script', cursive" },
    { name: "Elegant Calligraphy (Great Vibes)", class: "", fontFamily: "'Great Vibes', cursive" },
    { name: "Flowing Script (Alex Brush)", class: "", fontFamily: "'Alex Brush', cursive" },
    { name: "Modern Cursive (Satisfy)", class: "", fontFamily: "'Satisfy', cursive" },
    { name: "Slim Hand-lettered (Sacramento)", class: "", fontFamily: "'Sacramento', cursive" },
    { name: "Retro Brush (Pacifico)", class: "", fontFamily: "'Pacifico', cursive" },
    { name: "Natural Signature (Caveat)", class: "", fontFamily: "'Caveat', cursive" },
    { name: "Times New Roman", class: "", fontFamily: "'Times New Roman', Times, serif" },
    { name: "Serif Classic (Playfair Display)", class: "", fontFamily: "'Playfair Display', Georgia, serif" },
    { name: "Modern Clean", class: "font-sans font-bold", fontFamily: "sans-serif" },
    { name: "Geometric Gothic", class: "font-sans uppercase tracking-widest font-black", fontFamily: "Arial, sans-serif" },
    { name: "Rustic Monospace", class: "font-mono tracking-wider", fontFamily: "'Courier New', monospace" },
    { name: "Copperplate Gothic", class: "uppercase tracking-wider", fontFamily: "'Copperplate', 'Cinzel', serif" },
    { name: "Other (Specify in Instructions)", class: "", fontFamily: "inherit" },
  ];

  // Visualizer Styling Mapping
  const getVisualizerBg = () => {
    const cat = product.categoryId;
    switch (cat) {
      case "wood":
        return "bg-amber-950/95 border-amber-900 text-amber-200 bg-[radial-gradient(#5c3e21_1px,transparent_1px)] bg-[size:16px_16px] border-dashed";
      case "leather":
        return "bg-amber-900 text-amber-100 border-amber-800 bg-[radial-gradient(#4a2a10_1px,transparent_1px)] bg-[size:10px_10px]";
      case "glassware":
        return "bg-sky-950/85 text-sky-100 border-sky-800 backdrop-blur-xs opacity-90";
      case "slate":
        return "bg-neutral-900 text-neutral-300 border-neutral-800 bg-[radial-gradient(#1a1a1a_2px,transparent_1px)]";
      case "sublimation":
        return "bg-purple-950/90 text-purple-100 border-purple-800 bg-[radial-gradient(#a855f7_1px,transparent_1px)] bg-[size:12px_12px]";
      default:
        return "bg-stone-800 border-stone-700 text-stone-300";
    }
  };

  const getVisualizerLabel = () => {
    const cat = product.categoryId;
    switch (cat) {
      case "wood":
        return "Walnut/Maple Grain Simulation";
      case "leather":
        return "Full-Grain Leather Emboss";
      case "glassware":
        return "Sandblasted Frosted Glass";
      case "slate":
        return "Etched Slate Stone";
      case "sublimation":
        return "Vibrant Sublimation Ink Print";
      default:
        return "Artisan Slate Material";
    }
  };

  const getSelectedFontClass = () => {
    const selected = fontOptions.find((f) => f.name === formData.fontPreference);
    return selected ? selected.class : "";
  };

  const getSelectedFontFamily = () => {
    const selected = fontOptions.find((f) => f.name === formData.fontPreference);
    return selected ? selected.fontFamily : "inherit";
  };

  // Drag & Drop Handling
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  const addFiles = async (files: FileList) => {
    setUploadingFiles(true);
    setUploadError("");
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`"${file.name}" exceeds the 10MB limit.`);
        continue;
      }
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        setUploadError(`"${file.name}" is an invalid file type.`);
        continue;
      }

      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64Data = e.target?.result as string;
          const sizeKB = Math.max(1, Math.round(file.size / 1024));
          try {
            const response = await fetch("/api/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: file.name,
                type: file.type,
                data: base64Data
              })
            });
            if (response.ok) {
              const result = await response.json();
              setUploadedFiles((prev) => [
                ...prev,
                { name: result.name || file.name, size: result.size || sizeKB, url: result.url || base64Data }
              ]);
            } else {
              setUploadedFiles((prev) => [
                ...prev,
                { name: file.name, size: sizeKB, url: base64Data }
              ]);
            }
          } catch (err) {
            setUploadedFiles((prev) => [
              ...prev,
              { name: file.name, size: sizeKB, url: base64Data }
            ]);
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    setUploadingFiles(false);
  };

  const removeFile = (idx: number) => {
    const copy = [...uploadedFiles];
    copy.splice(idx, 1);
    setUploadedFiles(copy);
  };

  // Form Inputs
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (submitted) {
      setSubmitted(false);
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.customerName.trim()) newErrors.customerName = "Full Name is required.";

    if (!formData.contactPreference) {
      newErrors.contactPreference = "Please select how you would like to be contacted.";
    }

    if (formData.contactPreference === "email") {
      if (!formData.customerEmail.trim()) {
        newErrors.customerEmail = "Email address is required when Email is selected as preferred contact.";
      } else {
        const check = validateEmailAddress(formData.customerEmail);
        if (!check.valid) newErrors.customerEmail = check.error;
      }
      if (formData.customerPhone.trim()) {
        const phoneCheck = validatePhoneNumber(formData.customerPhone, false);
        if (!phoneCheck.valid) newErrors.customerPhone = phoneCheck.error;
      }
    } else if (formData.contactPreference === "phone") {
      if (!formData.customerPhone.trim()) {
        newErrors.customerPhone = "Phone number is required when Phone is selected as preferred contact.";
      } else {
        const phoneCheck = validatePhoneNumber(formData.customerPhone, true);
        if (!phoneCheck.valid) newErrors.customerPhone = phoneCheck.error;
      }
      if (formData.customerEmail.trim()) {
        const check = validateEmailAddress(formData.customerEmail);
        if (!check.valid) newErrors.customerEmail = check.error;
      }
    }

    if (formData.quantity < 1) newErrors.quantity = "Quantity must be at least 1.";
    return newErrors;
  };

  const handleSubmitQuoteForm = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const cleanInstructions = (formData.specialInstructions || "").trim();
    const cleanEngraving = (formData.engravingText || "").trim();
    const cleanPhone = (formData.customerPhone || "").trim();
    const cleanDeadline = (formData.deadline || "").trim();

    const cleanCustomerEmail = formData.customerEmail.trim();
    setSubmittedQuoteInfo({
      customerName: formData.customerName.trim(),
      customerEmail: cleanCustomerEmail || undefined,
      customerPhone: cleanPhone || undefined,
      contactPreference: formData.contactPreference,
      productName: product.name
    });

    if (onSubmitQuote) {
      onSubmitQuote({
        productId: product.id,
        productName: product.name,
        customerName: formData.customerName.trim(),
        customerEmail: cleanCustomerEmail || undefined,
        customerPhone: cleanPhone || undefined,
        contactPreference: formData.contactPreference,
        engravingText: changeFont && cleanEngraving ? cleanEngraving : undefined,
        fontPreference: changeFont ? formData.fontPreference : "Leave as in picture reference",
        specialInstructions: cleanInstructions || undefined,
        quantity: Number(formData.quantity) || 1,
        deadline: cleanDeadline || undefined,
        alternativeRequest: formData.alternativeRequest || undefined,
        alternativeDetails: formData.alternativeRequest && formData.alternativeDetails.trim() ? formData.alternativeDetails.trim() : undefined,
        uploadedFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      });
    }

    setSubmitted(true);
    setChangeFont(false);
    setFormData({
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      contactPreference: "email",
      engravingText: "",
      fontPreference: "Classic Cursive (Dancing Script)",
      specialInstructions: "",
      quantity: 1,
      deadline: "",
      alternativeRequest: false,
      alternativeDetails: "",
    });
    setUploadedFiles([]);
  };

  // Dynamic font size scaling based on text length to prevent simulator overflow
  const getSimulatedTextSize = () => {
    const len = formData.engravingText.length;
    if (len > 35) return "text-sm md:text-base leading-snug";
    if (len > 20) return "text-lg md:text-xl";
    return "text-2xl md:text-3xl";
  };

  const flowerPattern = /flower|floral|bouquet|pipe\s*cleaner|pipecleaner|rose|tulip|lily|lilies|sunflower|daisy|daisies|lavender|orchid|peony|peonies|carnation|blossom|petal|stem/i;
  const isSublimation = product.categoryId === "sublimation" || /sublimation/i.test(categoryName || "");
  const isPipeCleaner =
    Boolean(product.isHandmadeFlowers) ||
    product.categoryId === "pipecleaner" ||
    flowerPattern.test(categoryName || "") ||
    flowerPattern.test(product.categoryId || "") ||
    flowerPattern.test(product.name || "") ||
    flowerPattern.test(product.badge || "");
  const hasVisualizer = product.hasVisualizer !== false && !isPipeCleaner;
  const hasEngravingText = product.hasEngravingText !== undefined ? product.hasEngravingText : hasVisualizer;
  const hasTypography = product.hasTypography !== undefined ? product.hasTypography : hasEngravingText;
  const isEngraving =
    !isPipeCleaner &&
    !isSublimation &&
    (product.isEngravingProduct === true || (product.isEngravingProduct !== false && Boolean(hasEngravingText)));

  return (
    <div id="product-detail-view" className="space-y-8 animate-fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Back to discover */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted hover:text-brand-primary cursor-pointer transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Discover Catalog
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Image Gallery, Custom Engraving Visualizer, and Trust Assurances */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <div className="relative aspect-4/3 bg-brand-highlight rounded-[24px] overflow-hidden border border-brand-border shadow-xs">
            {activeMedia === "video" && product.videoUrl ? (
              <div className="w-full h-full bg-black flex items-center justify-center relative">
                {(() => {
                  const parsed = getEmbedVideoUrl(product.videoUrl);
                  if (parsed.type === "youtube" || parsed.type === "vimeo") {
                    return (
                      <iframe
                        src={parsed.embedUrl}
                        title={`${product.name} Showcase Video`}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    );
                  }
                  return (
                    <video
                      src={parsed.embedUrl}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    >
                      Your browser does not support the video tag.
                    </video>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => setActiveMedia("image")}
                  className="absolute top-4 right-4 bg-brand-dark/85 hover:bg-brand-dark text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md cursor-pointer transition-colors backdrop-blur-xs border border-white/20 z-10"
                >
                  <ImageIcon className="h-3 w-3" /> View Photos
                </button>
              </div>
            ) : (
              <>
                <img
                  src={product.images[activeImageIndex] || "https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&q=80&w=600"}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {product.videoUrl && (
                  <button
                    type="button"
                    onClick={() => setActiveMedia("video")}
                    className="absolute bottom-4 right-4 bg-brand-dark/85 hover:bg-brand-primary text-white text-[10px] font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-md cursor-pointer transition-all duration-300 backdrop-blur-xs border border-white/20 hover:scale-105 z-10"
                  >
                    <Play className="h-3.5 w-3.5 fill-white stroke-none" /> Watch Showcase Video
                  </button>
                )}
              </>
            )}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10 pointer-events-none">
              <span className="bg-brand-dark/95 backdrop-blur-xs text-white text-[9px] tracking-widest uppercase font-bold px-3 py-1 rounded-full">
                {categoryName}
              </span>
              {hasPromo && (
                <span className="bg-brand-primary text-white text-[9px] tracking-widest uppercase font-bold px-3 py-1 rounded-full">
                  -{discountPercent}% Special Offer
                </span>
              )}
            </div>
          </div>

          {/* Gallery Thumbnails & Video Showcase */}
          {(product.images.length > 1 || product.videoUrl) && (
            <div className="flex flex-wrap gap-3">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setActiveMedia("image");
                    setActiveImageIndex(i);
                  }}
                  className={`relative aspect-4/3 w-20 rounded-[12px] overflow-hidden border cursor-pointer transition-all ${
                    activeMedia === "image" && activeImageIndex === i
                      ? "border-brand-primary ring-2 ring-brand-primary/10"
                      : "border-brand-border hover:border-brand-primary/40 opacity-80 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt={`Thumbnail ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}

              {product.videoUrl && (
                <button
                  type="button"
                  onClick={() => setActiveMedia("video")}
                  className={`relative aspect-4/3 w-20 rounded-[12px] overflow-hidden border cursor-pointer transition-all flex flex-col items-center justify-center bg-stone-900 text-white ${
                    activeMedia === "video"
                      ? "border-brand-primary ring-2 ring-brand-primary/20 bg-amber-950/80"
                      : "border-brand-border hover:border-brand-primary/40 opacity-90 hover:opacity-100"
                  }`}
                  title="Watch Showcase Video"
                >
                  <div className="p-1 rounded-full bg-white/20 text-white mb-0.5">
                    <Play className="h-3.5 w-3.5 fill-white stroke-none ml-0.5" />
                  </div>
                  <span className="text-[9px] font-bold tracking-wider uppercase text-amber-200">Video</span>
                </button>
              )}
            </div>
          )}

          {/* Premium Live Personalization Simulation Panel (Appears when client checks change font) */}
          {hasVisualizer && changeFont && (
            <div className="bg-white text-brand-dark rounded-[24px] p-5 border border-brand-border shadow-2xs space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-brand-primary animate-pulse" />
                <h4 className="font-serif font-bold text-sm text-brand-dark">Live Personalization Visualizer</h4>
              </div>

              <div className={`relative h-44 rounded-[16px] border flex flex-col items-center justify-center p-5 text-center transition-all duration-300 overflow-hidden ${getVisualizerBg()}`}>
                {/* Material Badge */}
                <span className="absolute bottom-2 right-2 text-[8px] tracking-widest uppercase font-bold text-white/50 bg-black/40 px-2 py-0.5 rounded-sm">
                  {getVisualizerLabel()}
                </span>

                {formData.engravingText.trim() ? (
                  <div className="space-y-1 max-w-full px-2">
                    <span className="text-[9px] uppercase tracking-widest text-white/40 block font-semibold">
                      {isSublimation ? "Simulated Print Output" : "Simulated Etch Output"}
                    </span>
                    <p
                      style={{ fontFamily: getSelectedFontFamily() }}
                      className={`tracking-wide select-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)] filter contrast-125 break-words max-w-full ${getSimulatedTextSize()} ${getSelectedFontClass()}`}
                    >
                      {formData.engravingText}
                    </p>
                    <p className="text-[9px] opacity-65 italic">
                      applying to: {product.name}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 opacity-50 px-3">
                    <PenTool className="h-6 w-6 mx-auto stroke-1 text-white/70" />
                    <p className="text-xs font-semibold text-white/90">{isSublimation ? "Enter Sublimation Text" : "Enter Personalization Text"}</p>
                    <p className="text-[9px] text-white/60">
                      {isSublimation 
                        ? "Live print mockup will appear here styled in your chosen typography." 
                        : "Live engraving mockup will appear here styled in your chosen typography."}
                    </p>
                  </div>
                )}
              </div>
              
              <p className="text-[10px] text-brand-muted text-center font-light leading-normal">
                *This is a 2D preview. Adjustments and a final mockup will be shown to you before creating your item.
              </p>
            </div>
          )}


        </div>

        {/* Right Column: Details Info & Elegant Direct Configurator Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <h1 className="font-serif font-bold text-3xl md:text-4xl text-brand-dark tracking-tight leading-tight">
              {product.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {product.badge && product.badge.trim() && (
                <span className="text-[9px] bg-brand-highlight text-brand-primary border border-brand-border/80 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                  {product.badge.trim()}
                </span>
              )}
              {product.seal && product.seal.trim() && (
                <span className="text-[9px] bg-amber-800/10 text-amber-800 border border-amber-800/20 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                  {product.seal.trim()}
                </span>
              )}
              {product.leadTime && product.leadTime.trim() && (
                <span className="text-[9px] bg-stone-100 text-stone-800 border border-stone-200 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-3 w-3 text-brand-primary" /> {product.leadTime.trim()}
                </span>
              )}
              {product.dimensions && product.dimensions.trim() && (
                <span className="text-[9px] bg-stone-100 text-stone-800 border border-stone-200 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                  <Ruler className="h-3 w-3 text-brand-primary" /> {product.dimensions.trim()}
                </span>
              )}
              <span className="text-[9px] bg-amber-100/90 text-amber-950 border border-amber-300 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shadow-3xs">
                <Sparkles className="h-3 w-3 text-amber-800" /> Fully Customizable
              </span>
              {product.readyForPickup && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                  <span className="flex items-center gap-1 font-semibold text-[11px]">
                    <CheckCircle className="h-3.5 w-3.5" /> Ready for Pickup
                  </span>
                </div>
              )}
              {isEngraving && product.inStock && (
                <div className="flex items-center gap-1.5 text-xs text-brand-primary">
                  <span className="flex items-center gap-1 font-semibold text-[11px]">
                    <CheckCircle className="h-3.5 w-3.5" /> Ready for Custom Engraving
                  </span>
                </div>
              )}
              {!product.inStock && (
                <div className="flex items-center gap-1.5 text-xs text-brand-primary">
                  <span className="text-brand-muted flex items-center gap-1 font-semibold text-[11px]">
                    <AlertTriangle className="h-3.5 w-3.5" /> Custom Workshop Only
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Pricing Box & Transparent Fee Breakdown */}
          <div className="bg-brand-highlight border border-brand-border rounded-[24px] p-5 space-y-3.5">
            <div className={`flex justify-between items-center ${
              (product.includedNotes && product.includedNotes.some((n) => n && n.trim())) || (product.pricingNotice && product.pricingNotice.trim())
                ? "border-b border-brand-border/60 pb-3"
                : ""
            }`}>
              <div>
                <span className="text-[10px] text-brand-muted font-bold uppercase tracking-widest block mb-0.5">
                  Transparent Price Range
                </span>
                <div className="flex items-baseline gap-2">
                  {hasPromo ? (
                    <>
                      <span className="text-red-700 font-serif font-bold text-2xl md:text-3xl">
                        {product.maxPrice 
                          ? `$${product.promoPrice} - $${Math.round((product.promoPrice ?? 0) * (product.maxPrice / product.price))}`
                          : `$${product.promoPrice}`
                        }
                      </span>
                      <span className="text-brand-muted line-through text-xs font-medium">
                        {product.maxPrice ? `$${product.price} - $${product.maxPrice}` : `$${product.price}`}
                      </span>
                    </>
                  ) : (
                    <span className="text-brand-dark font-serif font-bold text-2xl md:text-3xl">
                      {product.maxPrice ? `$${product.price} - $${product.maxPrice}` : `$${product.price}`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {product.includedNotes && product.includedNotes.filter((n) => n && n.trim()).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[10px] text-brand-dark font-medium">
                {product.includedNotes
                  .filter((n) => n && n.trim())
                  .map((note, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                      <span>{note.trim()}</span>
                    </div>
                  ))}
              </div>
            )}
            {product.pricingNotice && product.pricingNotice.trim() && (
              <p className="text-[10px] text-brand-muted leading-relaxed font-light">
                {product.pricingNotice.trim()}
              </p>
            )}
          </div>

          {/* Custom Options Display */}
          {!product.hideCustomOptions && !product.hideOptionsAvailable && product.customOptions && product.customOptions.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] text-brand-muted font-bold tracking-widest uppercase block border-b border-brand-border pb-1">
                Options Available:
              </span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                {product.customOptions.map((opt, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-brand-text font-light">
                    <CheckCircle className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                    <span>{opt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description Block */}
          <div className="space-y-1.5 border-t border-brand-border pt-4">
            <h4 className="font-serif font-bold text-brand-dark text-base">Description</h4>
            <p className="text-brand-muted text-xs leading-relaxed font-light whitespace-pre-line">
              {product.description}
            </p>
          </div>

          {/* Obvious Customization & Similar Item Request Notice */}
          <div className="bg-gradient-to-r from-amber-50 via-amber-50/90 to-amber-100/60 border-2 border-amber-300 rounded-[22px] p-4.5 sm:p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2 flex-wrap justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-amber-200 text-amber-900 shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h4 className="font-serif font-bold text-amber-950 text-sm sm:text-base">
                  Every Piece Can Be Fully Customized
                </h4>
              </div>
              <span className="text-[9px] bg-amber-200/90 text-amber-900 font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                Custom Orders Welcome
              </span>
            </div>
            <p className="text-xs text-amber-950/90 leading-relaxed font-medium">
              Don't see something you like or want a custom variation? Every craft can be tailored to your specifications. If you would like something similar, a custom size, or an alternative design, simply check the <strong className="text-amber-950 font-bold underline decoration-amber-500 underline-offset-2">"Request a Similar or Alternative Item?"</strong> box in the order form below!
            </p>
          </div>

          {/* Premium Direct Configurator Form Section */}
          <div className="border-t border-brand-border pt-6 space-y-6">
            <div className="bg-brand-highlight/30 border border-brand-border rounded-[28px] p-5 md:p-6 space-y-5">
              <div className="space-y-1.5 border-b border-brand-border pb-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand-primary animate-pulse" />
                  <h3 className="font-serif font-bold text-lg text-brand-dark">
                    {isPipeCleaner ? "Get a Quote" : "Personalize this Item"}
                  </h3>
                </div>
                <p className="text-brand-muted text-[11px] leading-relaxed font-light">
                  {isPipeCleaner
                    ? "Please fill out your contact information, and we'll get back to you soon to confirm availability and guide you through the ordering process, including payment options and pickup or delivery details."
                    : "Fill in your custom details below. The crafter will review your order and contact you soon."}
                </p>
              </div>

              <form onSubmit={handleSubmitQuoteForm} className="space-y-4">
                {/* Preferred Contact Method Section */}
                <div className="flex flex-col gap-2 p-3.5 bg-white border border-brand-border rounded-[16px] shadow-3xs">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-brand-dark uppercase tracking-wider flex items-center gap-1">
                      <span>How would you like us to contact you?</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[9px] text-brand-primary font-bold uppercase tracking-wider">Required</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, contactPreference: "email" }));
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.contactPreference;
                          delete copy.customerPhone;
                          return copy;
                        });
                      }}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-[10px] border cursor-pointer transition-all text-xs font-bold ${
                        formData.contactPreference === "email"
                          ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                          : "bg-brand-highlight/30 text-brand-dark border-brand-border hover:border-brand-primary/40"
                      }`}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>By Email</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, contactPreference: "phone" }));
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.contactPreference;
                          delete copy.customerEmail;
                          return copy;
                        });
                      }}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-[10px] border cursor-pointer transition-all text-xs font-bold ${
                        formData.contactPreference === "phone"
                          ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                          : "bg-brand-highlight/30 text-brand-dark border-brand-border hover:border-brand-primary/40"
                      }`}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>By Phone</span>
                    </button>
                  </div>
                  {errors.contactPreference && (
                    <span className="text-[9px] text-red-600 font-medium">{errors.contactPreference}</span>
                  )}
                </div>

                {/* Contact Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="customerName" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                      Your Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="customerName"
                      name="customerName"
                      type="text"
                      value={formData.customerName}
                      onChange={handleInputChange}
                      placeholder="Eleanor Vance"
                      className={`bg-white border rounded-[8px] py-2 px-3 text-brand-text text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary ${errors.customerName ? "border-red-500" : "border-brand-border"}`}
                    />
                    {errors.customerName && (
                      <span className="text-[9px] text-red-600 font-medium">{errors.customerName}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="customerEmail" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                      Email Address {formData.contactPreference === "email" ? <span className="text-red-500">*</span> : <span className="text-brand-muted font-normal">(Optional)</span>}
                    </label>
                    <input
                      id="customerEmail"
                      name="customerEmail"
                      type="email"
                      value={formData.customerEmail}
                      onChange={handleInputChange}
                      placeholder="eleanor@example.com"
                      className={`bg-white border rounded-[8px] py-2 px-3 text-brand-text text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary ${errors.customerEmail ? "border-red-500" : "border-brand-border"}`}
                    />
                    {errors.customerEmail && (
                      <span className="text-[9px] text-red-600 font-medium">{errors.customerEmail}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="customerPhone" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                      Phone Number {formData.contactPreference === "phone" ? <span className="text-red-500">*</span> : <span className="text-brand-muted font-normal">(Optional)</span>}
                    </label>
                    <input
                      id="customerPhone"
                      name="customerPhone"
                      type="text"
                      value={formData.customerPhone}
                      onChange={(e) => {
                        const formatted = formatPhoneInput(e.target.value);
                        setFormData((prev) => ({ ...prev, customerPhone: formatted }));
                        if (errors.customerPhone) {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.customerPhone;
                            return copy;
                          });
                        }
                      }}
                      placeholder="(709) 555-0199"
                      className={`bg-white border rounded-[8px] py-2 px-3 text-brand-text text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary ${errors.customerPhone ? "border-red-500" : "border-brand-border"}`}
                    />
                    {errors.customerPhone && (
                      <span className="text-[9px] text-red-600 font-medium">{errors.customerPhone}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="quantity" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                      Quantity Required <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="quantity"
                      name="quantity"
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      className="bg-white border border-brand-border rounded-[8px] py-2 px-3 text-brand-text text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="deadline" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-brand-primary" /> Target Deadline
                    </label>
                    <input
                      id="deadline"
                      name="deadline"
                      type="date"
                      value={formData.deadline}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split("T")[0]}
                      className="bg-white border border-brand-border rounded-[8px] py-2 px-3 text-brand-text text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer"
                    />
                  </div>
                </div>

                {/* Special instructions */}
                <div className="flex flex-col gap-1.5 border-t border-brand-border/40 pt-4 mt-2">
                  <label htmlFor="specialInstructions" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                    {isSublimation ? "Additional Customization Preferences" : isPipeCleaner ? "Bouquet Wrapping & Packaging Preferences" : "Special Design Instructions"}
                  </label>
                  <textarea
                    id="specialInstructions"
                    name="specialInstructions"
                    rows={2.5}
                    value={formData.specialInstructions}
                    onChange={handleInputChange}
                    placeholder={isSublimation ? "Describe any background colors, placement of your image, or specific print details..." : isPipeCleaner ? "Request specific ribbon colors, wrapping paper styles, or card notes..." : "E.g., Please align the engraving in the lower right-hand corner. Wood oil coat finishes only..."}
                    className="bg-white border border-brand-border rounded-[8px] py-2 px-3 text-brand-text text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </div>

                {/* Similar or Alternative Craft Request Toggle - Located immediately below Special Design Instructions */}
                {(() => {
                  const altPrompt = (product.alternativeRequestText && product.alternativeRequestText.trim()) || "If you want a custom size, design, or specialized piece, check this box to specify what you'd like!";
                  return (
                    <div className="bg-amber-50/80 border-2 border-amber-300/90 p-4 rounded-[16px] space-y-3 mt-2 shadow-3xs">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          name="alternativeRequest"
                          checked={formData.alternativeRequest}
                          onChange={(e) => setFormData(prev => ({ ...prev, alternativeRequest: e.target.checked }))}
                          className="rounded border-amber-400 text-amber-800 focus:ring-amber-500 h-4.5 w-4.5 cursor-pointer mt-0.5 shrink-0"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-serif font-bold text-brand-dark text-sm block">Request a Similar or Alternative Item?</span>
                            <span className="text-[9px] bg-amber-200/90 text-amber-900 font-bold uppercase px-1.5 py-0.5 rounded-full">
                              Customizable
                            </span>
                          </div>
                          <span className="text-xs text-amber-950/80 leading-relaxed block font-medium">
                            {altPrompt}
                          </span>
                        </div>
                      </label>
                      
                      {formData.alternativeRequest && (
                        <div className="space-y-2 pl-7 animate-fade-in pt-1">
                          <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                            Describe what you would like instead (and ask for a price quote):
                          </label>
                          <textarea
                            name="alternativeDetails"
                            rows={2.5}
                            value={formData.alternativeDetails}
                            onChange={(e) => setFormData(prev => ({ ...prev, alternativeDetails: e.target.value }))}
                            placeholder={isPipeCleaner ? "e.g. Can I request a hand-made Lavender and Rose bouquet instead of the Sunflower? Please provide pricing for 3 stems..." : "e.g. Can I request a custom size, specific wood finish, or personalized design? Please let me know what options are possible..."}
                            className="w-full bg-white border border-amber-300 rounded-[8px] py-2 px-3 text-brand-text text-xs focus:outline-none focus:ring-1 focus:ring-amber-800 focus:border-amber-800 font-medium"
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Text to Engrave Input (Available for both: keep font or change font) */}
                {hasEngravingText && (
                  <div className="flex flex-col gap-1.5 border-t border-brand-border/40 pt-4 mt-2">
                    <div className="flex justify-between items-center">
                      <label htmlFor="engravingText" className="text-[10px] font-bold text-brand-primary uppercase tracking-widest flex items-center gap-1">
                        <PenTool className="h-3.5 w-3.5" /> {isSublimation ? "Custom Text to Print on Item" : "Text to Engrave"}
                      </label>
                      <span className="text-[9px] text-brand-muted font-mono font-medium">
                        {formData.engravingText.length}/100 chars
                      </span>
                    </div>
                    <input
                      id="engravingText"
                      name="engravingText"
                      type="text"
                      maxLength={100}
                      value={formData.engravingText}
                      onChange={handleInputChange}
                      placeholder={isSublimation ? "e.g. Happy Birthday, Dad! / Family Photo 2026" : "The Vance Family, Est. 2026"}
                      className="bg-white border border-brand-border rounded-[8px] py-2.5 px-3.5 text-brand-text text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary font-medium"
                    />
                    {!isSublimation && (
                      <span className="text-[9px] text-brand-muted font-light">
                        {changeFont
                          ? "*Type your phrase above. The simulation preview in the left column renders live."
                          : "*Enter the custom phrase, name, or date to be engraved using the font style shown in the picture reference."}
                      </span>
                    )}
                  </div>
                )}

                {/* Font Preference Question */}
                {hasEngravingText && (
                  <div className="space-y-3 border-t border-brand-border/40 pt-4 mt-2">
                    <div>
                      <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest block flex items-center gap-1.5">
                        <PenTool className="h-3.5 w-3.5" /> {isSublimation ? "Font & Print Style Preference" : "Font & Typography Preference"}
                      </span>
                      <p className="text-xs text-stone-800 font-serif font-bold mt-1">
                        Would you like to change the font or leave it as in the picture reference?
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label
                        onClick={() => setChangeFont(false)}
                        className={`flex items-start gap-2.5 p-3 rounded-[12px] border cursor-pointer transition-all ${
                          !changeFont
                            ? "border-amber-800 bg-amber-50/70 ring-1 ring-amber-800/30 text-stone-900 shadow-3xs"
                            : "border-stone-200 bg-white hover:border-amber-600/50 text-stone-600"
                        }`}
                      >
                        <input
                          type="radio"
                          name="fontPreferenceOption"
                          checked={!changeFont}
                          onChange={() => setChangeFont(false)}
                          className="text-amber-800 focus:ring-amber-800 mt-0.5 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <span className="font-bold text-xs block text-stone-900">
                            Leave as in the picture reference
                          </span>
                          <span className="text-[10px] text-stone-500 block leading-tight font-light">
                            Crafted using the exact typography shown in the sample photos
                          </span>
                        </div>
                      </label>

                      <label
                        onClick={() => setChangeFont(true)}
                        className={`flex items-start gap-2.5 p-3 rounded-[12px] border cursor-pointer transition-all ${
                          changeFont
                            ? "border-amber-800 bg-amber-50/70 ring-1 ring-amber-800/30 text-stone-900 shadow-3xs"
                            : "border-stone-200 bg-white hover:border-amber-600/50 text-stone-600"
                        }`}
                      >
                        <input
                          type="radio"
                          name="fontPreferenceOption"
                          checked={changeFont}
                          onChange={() => setChangeFont(true)}
                          className="text-amber-800 focus:ring-amber-800 mt-0.5 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <span className="font-bold text-xs block text-stone-900">
                            Change font
                          </span>
                          <span className="text-[10px] text-stone-500 block leading-tight font-light">
                            Select custom typography style with live visualizer preview
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Typography Style Dropdown (Displayed when Change Font is selected) */}
                {hasTypography && changeFont && (
                  <div className="flex flex-col gap-1.5 animate-fade-in border-t border-brand-border/40 pt-4 mt-2">
                    <label htmlFor="fontPreference" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider block">
                      {isSublimation ? "Printed Font Style" : "Typography Style"}
                    </label>
                    <div className="relative">
                      <select
                        id="fontPreference"
                        name="fontPreference"
                        value={formData.fontPreference}
                        onChange={handleInputChange}
                        className="w-full bg-white border border-brand-border rounded-[8px] py-2.5 px-3.5 text-brand-text text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer appearance-none font-medium"
                      >
                        {fontOptions.map((font) => (
                          <option key={font.name} value={font.name}>
                            {font.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-brand-muted text-xs">
                        ▼
                      </div>
                    </div>
                  </div>
                )}

                {/* Secure, optional file drag upload */}
                <div className="flex flex-col gap-1.5 border-t border-brand-border/40 pt-4 mt-2">
                  <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider flex items-center gap-1">
                    <Upload className="h-3.5 w-3.5 text-brand-primary" /> Photos, Designs, or Inspiration (Optional)
                  </label>
                  <p className="text-[11px] text-brand-muted font-light leading-relaxed">
                    Have a photo you'd like printed or engraved, a custom design, logo, or inspiration image? Drag and drop your files below or click to upload.
                  </p>

                  {isSublimation && (
                    <div className="bg-purple-50/70 border border-purple-200 text-purple-950 p-4 rounded-[12px] text-xs flex items-start gap-2.5 animate-fade-in mb-2 mt-1">
                      <span className="text-base shrink-0">📸</span>
                      <div>
                        <p className="font-bold">Sublimation Photo Recommendation!</p>
                        <p className="text-purple-800 text-[11px] leading-relaxed mt-0.5 font-light">
                          For full-color mugs, puzzles, tumblers, or keychains, we recommend a high-resolution JPEG or PNG. Our crafters will automatically center and fit your image to the item's print area before sharing a visual mockup!
                        </p>
                      </div>
                    </div>
                  )}

                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border border-dashed rounded-[14px] p-3.5 text-center cursor-pointer transition-all ${
                      dragActive
                        ? "border-brand-primary bg-brand-primary/5"
                        : "border-brand-border bg-white hover:border-brand-primary/50 hover:bg-brand-highlight/20"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*,application/pdf"
                    />
                    <Upload className="h-4.5 w-4.5 text-brand-primary/70 mx-auto mb-1 animate-pulse" />
                    <p className="text-[11px] font-semibold text-brand-dark">
                      Click to <span className="text-brand-primary underline">browse</span> or drag sketch here
                    </p>
                    <p className="text-[8px] text-brand-muted mt-0.5">
                      PNG, JPG, JPEG, or PDF up to 10MB
                    </p>
                  </div>

                  {uploadingFiles && (
                    <div className="text-[10px] text-brand-primary font-medium flex items-center justify-center gap-1.5 animate-pulse pt-1">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-brand-primary border-t-transparent"></div>
                      Encrypting &amp; uploading design asset...
                    </div>
                  )}

                  {uploadError && (
                    <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-[10px] text-[10px] font-medium text-center">
                      ⚠️ {uploadError}
                    </div>
                  )}

                  {/* Uploaded assets list */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-1.5 pt-1.5">
                      <span className="text-[8px] font-bold text-brand-muted uppercase tracking-wider block">
                        Uploaded Assets ({uploadedFiles.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {uploadedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between border border-brand-border bg-white p-2 rounded-[10px] text-[11px] shadow-3xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {file.url ? (
                                <img
                                  src={file.url}
                                  alt="preview"
                                  className="h-7 w-7 rounded-md object-cover border border-brand-border shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="h-7 w-7 bg-brand-highlight text-brand-primary rounded-md flex items-center justify-center shrink-0 border border-brand-border">
                                  <Paperclip className="h-3 w-3" />
                                </div>
                              )}
                              <span className="truncate max-w-[120px] font-medium text-brand-dark">{file.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(idx);
                              }}
                              className="text-brand-muted hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-sans font-bold py-3.5 px-4 rounded-full transition-colors text-[10px] uppercase tracking-widest shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-4"
                >
                  <Send className="h-3.5 w-3.5" />
                  Inquire to Order
                </button>

                {submitted && (
                  <div
                    id="inline-quote-success"
                    className="mt-6 p-5 bg-emerald-50/90 border border-emerald-200 text-emerald-950 rounded-[18px] text-xs space-y-3.5 animate-fade-in shadow-xs text-left"
                  >
                    <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                      <CheckCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                      <span>Quote Request Received Successfully!</span>
                    </div>
                    <p className="font-normal text-emerald-800 text-xs leading-relaxed">
                      Thank you for your request{submittedQuoteInfo?.customerName ? `, ${submittedQuoteInfo.customerName}` : ""}! We will get back to you in 1 business day.
                    </p>

                    {(() => {
                      const hasEmail = Boolean(submittedQuoteInfo?.customerEmail);
                      const hasPhone = Boolean(submittedQuoteInfo?.customerPhone);

                      if (hasPhone && !hasEmail) {
                        return (
                          <div className="bg-white border border-amber-200/90 rounded-[12px] p-3.5 text-stone-800 text-xs leading-relaxed space-y-2 shadow-2xs">
                            <div className="flex items-center gap-2 text-amber-900 font-bold text-[11px] uppercase tracking-wider">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                              Phone Confirmation Notice
                            </div>
                            <p className="text-stone-700 text-xs leading-relaxed">
                              Since you selected <strong>Phone</strong> as your contact method, our studio administrator Tannia will call or text you directly at <strong>{submittedQuoteInfo?.customerPhone}</strong> from <strong>+1 (709) 763-1315</strong> in 1 business day.
                            </p>
                            <div className="bg-amber-50/90 border border-amber-200/70 rounded-[8px] p-2 text-stone-800 text-[10px] leading-relaxed">
                              <strong>⚠️ Notice a typo in your phone number?</strong> Please check your number above. If incorrect, click below to submit a correction!
                            </div>
                          </div>
                        );
                      }

                      if (hasEmail && !hasPhone) {
                        return (
                          <div className="bg-white border border-amber-200/90 rounded-[12px] p-3.5 text-stone-800 text-xs leading-relaxed space-y-2 shadow-2xs">
                            <div className="flex items-center gap-2 text-amber-900 font-bold text-[11px] uppercase tracking-wider">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                              Quote Request Received
                            </div>
                            <p className="text-stone-700 text-xs leading-relaxed">
                              Thank you for your custom request! Studio owner Tannia has received your details and will prepare a tailored proposal directly to your email (<strong>{submittedQuoteInfo?.customerEmail}</strong>) within 1 business day.
                            </p>
                            <div className="bg-amber-50/90 border border-amber-200/70 rounded-[8px] p-2 text-stone-800 text-[10px] leading-relaxed">
                              <strong>⚠️ Notice a typo in your email?</strong> Please verify your address above or click below to submit a correction!
                            </div>
                          </div>
                        );
                      }

                      // Both email and phone provided
                      return (
                        <div className="bg-white border border-amber-200/90 rounded-[12px] p-3.5 text-stone-800 text-xs leading-relaxed space-y-2 shadow-2xs">
                          <div className="flex items-center gap-2 text-amber-900 font-bold text-[11px] uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            Quote Request Received
                          </div>
                          <p className="text-stone-700 text-xs leading-relaxed">
                            Thank you for your custom request! Studio owner Tannia has received your specifications and will reach out to you within 1 business day via email (<strong>{submittedQuoteInfo?.customerEmail}</strong>) or phone (<strong>{submittedQuoteInfo?.customerPhone}</strong>).
                          </p>
                          <div className="bg-amber-50/90 border border-amber-200/70 rounded-[8px] p-2 text-stone-800 text-[10px] leading-relaxed">
                            <strong>⚠️ Notice a typo in your contact info?</strong> Please verify your details above or click below to submit a correction!
                          </div>
                        </div>
                      );
                    })()}

                    <button
                      type="button"
                      onClick={() => setSubmitted(false)}
                      className="text-xs font-bold text-brand-primary hover:text-brand-dark transition-colors underline underline-offset-4 cursor-pointer"
                    >
                      Submit another quote or send a correction &rarr;
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
