import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Calendar, PenTool, Hash, Send, Sparkles, Upload, Trash2, Paperclip, CheckCircle, Mail, Phone } from "lucide-react";
import { Product, QuoteRequest } from "../types";
import { getStoredCustomerSession } from "../supabaseClient";

interface QuoteFormProps {
  products: Product[];
  selectedProduct: Product | null;
  onSubmitQuote: (quote: Omit<QuoteRequest, "id" | "createdAt" | "updatedAt" | "status">) => void;
  onClearSelection: () => void;
}

export default function QuoteForm({ products, selectedProduct, onSubmitQuote, onClearSelection }: QuoteFormProps) {
  const activeCustomer = getStoredCustomerSession();
  const [formData, setFormData] = useState({
    productId: "",
    customerName: activeCustomer?.fullName || "",
    customerEmail: activeCustomer?.email || "",
    customerPhone: activeCustomer?.phone || "",
    contactPreference: "email" as "email" | "phone",
    engravingText: "",
    fontPreference: "Classic Cursive (Dancing Script)",
    specialInstructions: "",
    quantity: 1,
    deadline: "",
    alternativeRequest: false,
    alternativeDetails: "",
  });

  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number; url: string }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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

  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadError, setUploadError] = useState("");

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
      
      // Client-side quick size check (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`"${file.name}" exceeds the 10MB size restriction.`);
        continue;
      }

      // Allowed MIME types
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        setUploadError(`"${file.name}" is an invalid file type. Only JPEG, PNG, GIF, WEBP, SVG, and PDF files are allowed.`);
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
              headers: {
                "Content-Type": "application/json"
              },
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
                {
                  name: result.name || file.name,
                  size: result.size || sizeKB,
                  url: result.url || base64Data
                }
              ]);
            } else {
              setUploadedFiles((prev) => [
                ...prev,
                {
                  name: file.name,
                  size: sizeKB,
                  url: base64Data
                }
              ]);
            }
          } catch (err) {
            setUploadedFiles((prev) => [
              ...prev,
              {
                name: file.name,
                size: sizeKB,
                url: base64Data
              }
            ]);
          }
          resolve();
        };
        reader.onerror = () => {
          setUploadError(`Failed to read file "${file.name}".`);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    setUploadingFiles(false);
  };

  const removeFile = (index: number) => {
    const file = uploadedFiles[index];
    if (file.url && file.url.startsWith("blob:")) {
      URL.revokeObjectURL(file.url);
    }
    const copy = [...uploadedFiles];
    copy.splice(index, 1);
    setUploadedFiles(copy);
  };

  // Sync selected product from catalog click
  useEffect(() => {
    if (selectedProduct) {
      setFormData((prev) => ({
        ...prev,
        productId: selectedProduct.id,
      }));
    }
  }, [selectedProduct]);

  const currentProduct = products.find((p) => p.id === formData.productId);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (submitted) {
      setSubmitted(false);
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // clear error for this field
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
    if (!formData.customerName.trim()) {
      newErrors.customerName = "Name is required.";
    }

    if (!formData.contactPreference) {
      newErrors.contactPreference = "Please select how you would like to be contacted.";
    }

    if (formData.contactPreference === "email") {
      if (!formData.customerEmail.trim()) {
        newErrors.customerEmail = "Email address is required when Email is selected as preferred contact.";
      } else if (!/\S+@\S+\.\S+/.test(formData.customerEmail)) {
        newErrors.customerEmail = "Please enter a valid email address.";
      }
    } else if (formData.contactPreference === "phone") {
      if (!formData.customerPhone.trim()) {
        newErrors.customerPhone = "Phone number is required when Phone is selected as preferred contact.";
      } else if (formData.customerPhone.trim().replace(/\D/g, "").length < 7) {
        newErrors.customerPhone = "Please enter a valid phone number (at least 7 digits).";
      }
      if (formData.customerEmail.trim() && !/\S+@\S+\.\S+/.test(formData.customerEmail)) {
        newErrors.customerEmail = "Please enter a valid email address.";
      }
    }

    if (formData.quantity < 1) {
      newErrors.quantity = "Quantity must be at least 1.";
    }
    return newErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstError = Object.keys(validationErrors)[0];
      document.getElementById(firstError)?.focus();
      return;
    }

    const cleanInstructions = (formData.specialInstructions || "").trim();
    const cleanEngraving = (formData.engravingText || "").trim();
    const cleanPhone = (formData.customerPhone || "").trim();
    const cleanDeadline = (formData.deadline || "").trim();

    const payload = {
      productId: formData.productId || undefined,
      productName: currentProduct ? currentProduct.name : "General Custom Craft Project",
      customerName: formData.customerName.trim(),
      customerEmail: formData.customerEmail.trim(),
      customerPhone: cleanPhone || undefined,
      contactPreference: formData.contactPreference,
      engravingText: cleanEngraving || undefined,
      fontPreference: cleanEngraving ? formData.fontPreference : undefined,
      specialInstructions: cleanInstructions || undefined,
      quantity: Number(formData.quantity) || 1,
      deadline: cleanDeadline || undefined,
      alternativeRequest: formData.alternativeRequest || undefined,
      alternativeDetails: formData.alternativeRequest && formData.alternativeDetails.trim() ? formData.alternativeDetails.trim() : undefined,
      uploadedFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
    };

    onSubmitQuote(payload);
    setSubmitted(true);
    setFormData({
      productId: "",
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
    onClearSelection();
  };

  // Get current styling of visualizer background based on product category
  const getVisualizerBg = () => {
    if (!currentProduct) return "bg-stone-800 border-stone-700 text-stone-300"; // General

    const cat = currentProduct.categoryId;
    switch (cat) {
      case "wood":
        return "bg-amber-950/90 border-amber-900 text-amber-200 bg-[radial-gradient(#5c3e21_1px,transparent_1px)] bg-[size:16px_16px] border-dashed";
      case "leather":
        return "bg-amber-900 text-amber-100 border-amber-800 bg-[radial-gradient(#4a2a10_1px,transparent_1px)] bg-[size:10px_10px]";
      case "glassware":
        return "bg-sky-950/80 text-sky-100 border-sky-800 backdrop-blur-md opacity-90";
      case "slate":
        return "bg-neutral-900 text-neutral-300 border-neutral-800 bg-[radial-gradient(#1a1a1a_2px,transparent_1px)]";
      case "pipecleaner":
        return "bg-emerald-50 border-emerald-200 text-emerald-950 bg-[radial-gradient(#bbf7d0_1px,transparent_1px)] bg-[size:20px_20px]";
      case "sublimation":
        return "bg-gradient-to-tr from-sky-100 via-pink-50 to-amber-50 border-purple-200 text-slate-800 shadow-inner";
      default:
        return "bg-stone-800 border-stone-700 text-stone-300";
    }
  };

  const getVisualizerLabel = () => {
    if (!currentProduct) return "Bespoke Engraving Material";
    const cat = currentProduct.categoryId;
    switch (cat) {
      case "wood":
        return "Walnut/Maple Grain Simulation";
      case "leather":
        return "Full-Grain Leather Emboss";
      case "glassware":
        return "Sandblasted Frosted Glass";
      case "slate":
        return "Etched Slate Stone";
      case "pipecleaner":
        return "Everlasting Flower Bouquet Preview";
      case "sublimation":
        return "Sublimation Heat-Press Print Preview";
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

  const getFontSizeForMainText = () => {
    const len = formData.engravingText.length;
    if (len <= 10) return "1.875rem"; // 30px
    if (len <= 18) return "1.5rem";   // 24px
    if (len <= 28) return "1.25rem";  // 20px
    if (len <= 40) return "1rem";     // 16px
    if (len <= 60) return "0.875rem"; // 14px
    return "0.75rem";                 // 12px
  };

  const getFontSizeForSubText = () => {
    const len = formData.engravingText.length;
    if (len <= 10) return "1.125rem"; // 18px
    if (len <= 20) return "0.9375rem"; // 15px
    if (len <= 35) return "0.8125rem"; // 13px
    return "0.6875rem";                // 11px
  };

  const isSublimation = currentProduct?.categoryId === "sublimation";
  const isPipeCleaner = currentProduct?.categoryId === "pipecleaner";
  const isEngraving = !currentProduct || !["sublimation", "pipecleaner"].includes(currentProduct.categoryId);

  const lastImageFile = [...uploadedFiles].reverse().find(f => f.url && (f.name.match(/\.(jpeg|jpg|gif|png|webp)$/i) || f.url.startsWith("data:image") || f.url.startsWith("blob:")));

  return (
    <div id="quote-request-form-container" className="w-full">
      {/* Actual Form Fields */}
      <div className="bg-white rounded-[24px] border border-brand-border p-6 md:p-8 shadow-xs transition-all duration-300 w-full">

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-brand-highlight rounded-full">
            <MessageSquare className="h-5 w-5 text-brand-primary" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-brand-dark text-xl md:text-2xl">
              Request a Custom Quote
            </h3>
            <p className="text-brand-muted text-xs md:text-sm leading-relaxed">
              We'll get back to you with a personalized quote within 24 hours. Once your order is confirmed, we'll send you a design preview for approval before bringing your idea to life.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Product Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider flex items-center gap-1">
              Select Craft Product
            </label>
            <div className="relative">
              <select
                id="productId"
                name="productId"
                value={formData.productId}
                onChange={handleInputChange}
                className="w-full bg-brand-highlight/30 border border-brand-border rounded-[8px] py-2.5 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary cursor-pointer appearance-none"
              >
                <option value="">-- Custom/General Project Idea (Not cataloged) --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (${p.promoPrice || p.price})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-muted text-xs">
                ▼
              </div>
            </div>
            {currentProduct && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1 text-[11px] text-brand-primary bg-brand-highlight px-3 py-2 rounded-[8px] border border-brand-border animate-fade-in">
                <span>Selected: <strong>{currentProduct.name}</strong></span>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-800 text-white px-2 py-0.5 rounded text-[10px] font-bold shrink-0">
                    Price: ${currentProduct.promoPrice || currentProduct.price} USD
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, productId: "" }));
                      onClearSelection();
                    }}
                    className="underline hover:text-brand-dark font-semibold cursor-pointer text-[10px] shrink-0"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preferred Contact Method Selection */}
          <div className="flex flex-col gap-2 p-3.5 bg-brand-highlight/40 border border-brand-border rounded-[14px]">
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
                    : "bg-white text-brand-dark border-brand-border hover:border-brand-primary/40"
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
                    : "bg-white text-brand-dark border-brand-border hover:border-brand-primary/40"
                }`}
              >
                <Phone className="h-3.5 w-3.5" />
                <span>By Phone</span>
              </button>
            </div>
            {errors.contactPreference && (
              <span className="text-[10px] text-red-600 font-medium">{errors.contactPreference}</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Name */}
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
                className={`bg-brand-highlight/30 border rounded-[8px] py-2 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary ${errors.customerName ? "border-red-500" : "border-brand-border"}`}
              />
              {errors.customerName && (
                <span className="text-[10px] text-red-600 font-medium">{errors.customerName}</span>
              )}
            </div>

            {/* Customer Email */}
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
                className={`bg-brand-highlight/30 border rounded-[8px] py-2 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary ${errors.customerEmail ? "border-red-500" : "border-brand-border"}`}
              />
              {errors.customerEmail && (
                <span className="text-[10px] text-red-600 font-medium">{errors.customerEmail}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer Phone */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="customerPhone" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                Phone Number {formData.contactPreference === "phone" ? <span className="text-red-500">*</span> : <span className="text-brand-muted font-normal">(Optional)</span>}
              </label>
              <input
                id="customerPhone"
                name="customerPhone"
                type="text"
                value={formData.customerPhone}
                onChange={handleInputChange}
                placeholder="(709) 555-0199"
                className={`bg-brand-highlight/30 border rounded-[8px] py-2 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary ${errors.customerPhone ? "border-red-500" : "border-brand-border"}`}
              />
              {errors.customerPhone && (
                <span className="text-[10px] text-red-600 font-medium">{errors.customerPhone}</span>
              )}
            </div>

            {/* Quantity */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="quantity" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider flex items-center gap-1">
                <Hash className="h-3 w-3" /> Quantity Required <span className="text-red-500">*</span>
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={handleInputChange}
                className={`bg-brand-highlight/30 border rounded-[8px] py-2 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary ${errors.quantity ? "border-red-500" : "border-brand-border"}`}
              />
              {errors.quantity && (
                <span className="text-[10px] text-red-600 font-medium">{errors.quantity}</span>
              )}
            </div>

            {/* Deadline */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="deadline" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider flex items-center gap-1">
                <Calendar className="h-3 w-3 text-brand-primary" /> Desired Deadline
              </label>
              <input
                id="deadline"
                name="deadline"
                type="date"
                value={formData.deadline}
                onChange={handleInputChange}
                min={new Date().toISOString().split("T")[0]}
                className="bg-brand-highlight/30 border border-brand-border rounded-[8px] py-2 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary cursor-pointer"
              />
            </div>
          </div>

          {/* Engraving Customization Details */}
          <div className="border-t border-brand-border pt-4 mt-2 space-y-4 animate-fade-in">
            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-widest flex items-center gap-1.5">
              <PenTool className="h-3.5 w-3.5" /> {["pipecleaner", "sublimation"].includes(currentProduct?.categoryId || "") ? "Custom Layout & Text Details" : "Engraving Specifics"}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dynamic Text Input */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="engravingText" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                  {["pipecleaner", "sublimation"].includes(currentProduct?.categoryId || "") ? "Custom Message / Printed Text" : "Text to Engrave"}
                </label>
                <input
                  id="engravingText"
                  name="engravingText"
                  type="text"
                  maxLength={100}
                  value={formData.engravingText}
                  onChange={handleInputChange}
                  placeholder={["pipecleaner", "sublimation"].includes(currentProduct?.categoryId || "") ? "e.g. Happy Mother's Day!, or Monogram" : "e.g. The Vance Family, Est. 2026"}
                  className="bg-brand-highlight/30 border border-brand-border rounded-[8px] py-2 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                />
              </div>

              {/* Dynamic Font Style Selection */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fontPreference" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                  {["pipecleaner", "sublimation"].includes(currentProduct?.categoryId || "") ? "Preferred Text Font Style" : "Engraving Font Style"}
                </label>
                <div className="relative">
                  <select
                    id="fontPreference"
                    name="fontPreference"
                    value={formData.fontPreference}
                    onChange={handleInputChange}
                    style={{ fontFamily: fontOptions.find(f => f.name === formData.fontPreference)?.fontFamily || "inherit" }}
                    className="w-full bg-brand-highlight/30 border border-brand-border rounded-[8px] py-2.5 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary cursor-pointer appearance-none"
                  >
                    {fontOptions.map((font) => (
                      <option 
                        key={font.name} 
                        value={font.name}
                        style={{ fontFamily: font.fontFamily }}
                        className={font.class}
                      >
                        {font.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-brand-muted text-xs">
                    ▼
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Special Instructions */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="specialInstructions" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
              Special Instructions or Design Ideas
            </label>
            <textarea
              id="specialInstructions"
              name="specialInstructions"
              rows={3}
              value={formData.specialInstructions}
              onChange={handleInputChange}
              placeholder={isSublimation ? "Describe any design preferences, background colors, or specific positioning of your photo..." : isPipeCleaner ? "Request custom wrapping papers, specific ribbon colors, or packaging ideas..." : "Please engrave the family crest in the middle. We would also like leather straps added if possible..."}
              className="bg-brand-highlight/30 border border-brand-border rounded-[8px] py-2.5 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
            />
          </div>

          {/* Similar or Alternative Craft Request Toggle - Below Special Instructions */}
          <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-[16px] space-y-3 mt-4">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                name="alternativeRequest"
                checked={formData.alternativeRequest}
                onChange={(e) => setFormData(prev => ({ ...prev, alternativeRequest: e.target.checked }))}
                className="rounded border-amber-300 text-amber-800 focus:ring-amber-500 h-4.5 w-4.5 cursor-pointer mt-0.5 shrink-0"
              />
              <div className="space-y-0.5">
                <span className="font-serif font-bold text-brand-dark text-sm block">Request a Custom or Alternative Craft?</span>
                <span className="text-xs text-brand-muted leading-relaxed block font-light">
                  Would you like to request similar items not in our standard list? Check this box and we will quote a custom price if it is possible.
                </span>
              </div>
            </label>
            
            {formData.alternativeRequest && (
              <div className="space-y-2 pl-7 animate-fade-in">
                <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                  Describe what you would like instead (and ask for a price quote):
                </label>
                <textarea
                  name="alternativeDetails"
                  rows={2}
                  value={formData.alternativeDetails}
                  onChange={(e) => setFormData(prev => ({ ...prev, alternativeDetails: e.target.value }))}
                  placeholder="e.g. Can I request a hand-made Lavender and Rose bouquet instead of the Sunflower? Please provide pricing for 3 stems..."
                  className="w-full bg-white border border-amber-300 rounded-[8px] py-2 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-amber-800 focus:border-amber-800"
                />
              </div>
            )}
          </div>

          {/* File Upload Segment */}
          <div className="flex flex-col gap-2 border-t border-brand-border pt-4 mt-2">
            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5 text-brand-primary" /> Upload files, photos, etc. (Optional)
            </label>
            <p className="text-[11px] text-brand-muted font-light mb-1">
              Drag & drop files or photos here, or click to browse.
            </p>

            {/* Drag Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-[16px] p-5 text-center cursor-pointer transition-all ${
                dragActive
                  ? "border-brand-primary bg-brand-primary/5"
                  : "border-brand-border bg-brand-highlight/15 hover:border-brand-primary/60 hover:bg-brand-highlight/30"
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
              <Upload className="h-6 w-6 text-brand-primary/60 mx-auto mb-2 animate-pulse" />
              <p className="text-xs font-semibold text-brand-dark">
                Drag & Drop files here, or <span className="text-brand-primary underline">browse</span>
              </p>
              <p className="text-[10px] text-brand-muted mt-1">
                Supports PNG, JPG, JPEG, or PDF up to 10MB
              </p>
            </div>

            {uploadingFiles && (
              <div className="text-center py-2 text-xs text-brand-primary font-medium flex items-center justify-center gap-2 animate-pulse">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-brand-primary border-t-transparent"></div>
                Analyzing and securing file upload...
              </div>
            )}

            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-[12px] text-xs font-medium">
                ⚠️ {uploadError}
              </div>
            )}

            {/* List of uploaded files */}
            {uploadedFiles.length > 0 && (
              <div className="mt-2 space-y-2">
                <span className="text-[9px] font-bold text-brand-muted uppercase tracking-wider block">
                  Uploaded Files ({uploadedFiles.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {uploadedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between border border-brand-border bg-white p-2 rounded-[12px] text-xs shadow-3xs group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {file.url ? (
                          <img
                            src={file.url}
                            alt="preview"
                            className="h-8 w-8 rounded-md object-cover border border-brand-border shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="h-8 w-8 bg-brand-highlight text-brand-primary rounded-md flex items-center justify-center shrink-0 border border-brand-border">
                            <Paperclip className="h-4 w-4" />
                          </div>
                        )}
                        <div className="truncate pr-1">
                          <p className="font-medium text-brand-dark truncate">{file.name}</p>
                          <p className="text-[10px] text-brand-muted">{file.size} KB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
                        className="text-brand-muted hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors cursor-pointer"
                        title="Remove file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            id="quote-submit-btn"
            type="submit"
            className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-sans font-bold py-3.5 px-4 rounded-full transition-colors text-[10px] uppercase tracking-widest shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            <Send className="h-3.5 w-3.5" />
            Inquire to Order
          </button>

          {submitted && (
            <div
              id="quote-success-banner"
              className="mt-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-[16px] text-xs space-y-1.5 animate-fade-in shadow-xs"
            >
              <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                <CheckCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                <span>Request Received Successfully!</span>
              </div>
              <p className="font-normal text-emerald-800 text-xs leading-relaxed">
                Thank you for submitting your custom quote request! We have received your details and our team will get back to you soon with your quote and design mockup.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
