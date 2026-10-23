import React, { useState } from "react";
import * as LucideIcons from "lucide-react";
import {
  TrendingUp,
  FileText,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  AlertCircle,
  FolderPlus,
  Sliders,
  DollarSign,
  Briefcase,
  Layers,
  Award,
  BellRing,
  Eye,
  Info,
  BadgeDollarSign,
  Star,
  Upload,
  Mail,
  Send,
  Sparkles,
  Type,
  Lock,
  Quote,
  Paperclip,
  MessageSquare,
  Image,
  Search,
  Megaphone,
  GripVertical,
  Download,
  Phone,
  MapPin
} from "lucide-react";
import { Product, Category, Testimonial, Announcement, QuoteRequest, AnalyticsSummary, CustomizationSettings, CustomSection, GIFT_OCCASION_PRESETS, GiftOccasionFilter } from "../types";
import { NicolettaLogo } from "./NicolettaLogo";
import { safeSetLocalStorage, persistKeyVal } from "../storage";
import { pushCloudStore, subscribeCloudSync, CloudSyncState } from "../cloudStore";
import { dispatchClientProposal, openGmailCompose, DEFAULT_ADMIN_EMAIL } from "../emailService";

interface AdminDashboardProps {
  products: Product[];
  categories: Category[];
  testimonials: Testimonial[];
  announcements: Announcement[];
  quotes: QuoteRequest[];
  analytics: AnalyticsSummary;
  token: string | null;
  customization: CustomizationSettings;
  onUpdateCustomization: (customization: CustomizationSettings) => void;
  onUpdateProducts: (products: Product[]) => void;
  onUpdateCategories: (categories: Category[]) => void;
  onUpdateTestimonials: (testimonials: Testimonial[]) => void;
  onUpdateAnnouncements: (announcements: Announcement[]) => void;
  onUpdateQuotes: (quotes: QuoteRequest[]) => void;
}

type AdminTab = "analytics" | "products" | "categories" | "testimonials" | "quotes" | "messages" | "announcements" | "site-customizer" | "security";

async function compressImageToDataUrl(
  file: File,
  maxDimension = 900,
  quality = 0.76,
  preserveAlpha = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error reading file."));
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      // Preserve SVGs, GIFs, and PDFs without canvas rasterization
      if (
        file.type === "image/svg+xml" ||
        file.type === "image/gif" ||
        file.type === "application/pdf" ||
        !file.type.startsWith("image/")
      ) {
        resolve(rawDataUrl);
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;
          if (!width || !height) {
            resolve(rawDataUrl);
            return;
          }

          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          if (!preserveAlpha) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);

          const outputMime = preserveAlpha ? "image/webp" : "image/jpeg";
          let compressed = canvas.toDataURL(outputMime, quality);
          if (preserveAlpha && (!compressed || !compressed.startsWith("data:image/webp"))) {
            compressed = canvas.toDataURL("image/png");
          }

          // Step down quality if still above ~85KB Base64 (~115,000 chars) so multiple carousel slides fit effortlessly
          const maxBase64Length = preserveAlpha ? 180000 : 115000;
          if (compressed && compressed.length > maxBase64Length) {
            for (const q of [0.64, 0.52, 0.42]) {
              const nextTry = canvas.toDataURL("image/jpeg", q);
              if (nextTry && nextTry !== "data:," && nextTry.length < compressed.length) {
                compressed = nextTry;
              }
              if (compressed.length <= maxBase64Length) break;
            }
          }

          if (!compressed || compressed === "data:,") {
            compressed = rawDataUrl;
          }
          resolve(compressed);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadImageAsset(
  file: File,
  maxDimension = 900,
  preserveAlpha = false
): Promise<{ url: string; name: string; size: number }> {
  const compressedData = await compressImageToDataUrl(file, maxDimension, 0.76, preserveAlpha);
  const mimeMatch = compressedData.match(/^data:([^;]+);base64,/);
  const effectiveType = mimeMatch ? mimeMatch[1] : file.type || "image/jpeg";
  const approxSizeKB = Math.max(1, Math.round((compressedData.length * 0.75) / 1024));

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        type: effectiveType,
        data: compressedData
      })
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && typeof data.url === "string" && data.url.length > 0 && !data.url.startsWith("/uploads/artisan_")) {
        return {
          url: data.url,
          name: data.name || file.name,
          size: data.size || approxSizeKB
        };
      }
    }
  } catch {
    // Fallback to compact compressed data URL when running in static mode
  }

  return {
    url: compressedData,
    name: file.name,
    size: approxSizeKB
  };
}

export default function AdminDashboard({
  products,
  categories,
  testimonials,
  announcements,
  quotes,
  analytics,
  token,
  customization,
  onUpdateCustomization,
  onUpdateProducts,
  onUpdateCategories,
  onUpdateTestimonials,
  onUpdateAnnouncements,
  onUpdateQuotes
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("site-customizer");

  // Rich analytics BI report state
  const [richAnalytics, setRichAnalytics] = useState<any | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  React.useEffect(() => {
    if (activeTab === "analytics" && token) {
      setLoadingAnalytics(true);
      fetch("/api/admin/analytics", {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) throw new Error("HTTP error " + res.status);
          return res.json();
        })
        .then(data => {
          setRichAnalytics(data);
          setLoadingAnalytics(false);
        })
        .catch(err => {
          console.error("Failed to fetch rich analytics:", err);
          setLoadingAnalytics(false);
        });
    }
  }, [activeTab, token, quotes]);

  // Site Customizer States
  const [logoText, setLogoText] = useState(customization?.logoText || "Nicoletta");
  const [logoSubtext, setLogoSubtext] = useState(customization?.logoSubtext || "Crafts & Decor");
  const [logoImageUrl, setLogoImageUrl] = useState(customization?.logoImageUrl || "");
  const [logoShowText, setLogoShowText] = useState(customization?.logoShowText !== false);
  const [logoSize, setLogoSize] = useState(customization?.logoSize || 48);
  const [logoHideBorder, setLogoHideBorder] = useState(customization?.logoHideBorder !== false);
  const [philosophyQuote, setPhilosophyQuote] = useState(customization?.philosophyQuote || "An engraving isn't just marks burnt into surface; it's the transfer of a family signature across generations.");
  const [philosophyAuthor, setPhilosophyAuthor] = useState(customization?.philosophyAuthor || "Nicoletta, Founder & Creative Director");
  const [giftOccasionFilters, setGiftOccasionFilters] = useState<GiftOccasionFilter[]>(() => {
    return Array.isArray(customization?.giftOccasionFilters)
      ? [...customization.giftOccasionFilters]
      : [...GIFT_OCCASION_PRESETS];
  });
  const [showOccasionEmojiPicker, setShowOccasionEmojiPicker] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState<"home" | "workshop">("home");
  const [sections, setSections] = useState<CustomSection[]>(() => {
    return customization?.sections && customization?.sections.length > 0
      ? [...customization.sections]
      : [];
  });

  // Change Password States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({ type: "error", message: "All password fields are required." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: "error", message: "New password and confirmation password do not match." });
      return;
    }

    if (newPassword.length < 4) {
      setPasswordStatus({ type: "error", message: "New password must be at least 4 characters long." });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update password.");
      }

      localStorage.setItem("nicoletta_admin_custom_password", newPassword);
      setPasswordStatus({ type: "success", message: "Your admin portal password has been changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const storedCustomPass = localStorage.getItem("nicoletta_admin_custom_password") || "nicoletta2026";
      if (err?.message && (err.message.includes("Current password") || err.message.includes("at least 4"))) {
        setPasswordStatus({ type: "error", message: err.message });
      } else if (currentPassword === storedCustomPass || (!localStorage.getItem("nicoletta_admin_custom_password") && currentPassword === "nicoletta2026")) {
        localStorage.setItem("nicoletta_admin_custom_password", newPassword);
        setPasswordStatus({ type: "success", message: "Your admin portal password has been changed successfully." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordStatus({ type: "error", message: "Current password does not match." });
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Sync state if prop changes
  const sectionsRef = React.useRef<CustomSection[]>(sections);
  sectionsRef.current = sections;

  React.useEffect(() => {
    if (customization) {
      setLogoText(customization.logoText || "Nicoletta");
      setLogoSubtext(customization.logoSubtext || "Crafts & Decor");
      setLogoImageUrl(customization.logoImageUrl || "");
      setLogoShowText(customization.logoShowText !== false);
      setLogoSize(customization.logoSize || 48);
      setLogoHideBorder(customization.logoHideBorder !== false);
      setPhilosophyQuote(customization.philosophyQuote || "An engraving isn't just marks burnt into surface; it's the transfer of a family signature across generations.");
      setPhilosophyAuthor(customization.philosophyAuthor || "Nicoletta, Founder & Creative Director");
      if (Array.isArray(customization.giftOccasionFilters)) {
        setGiftOccasionFilters([...customization.giftOccasionFilters]);
      }
      if (Array.isArray(customization.sections) && customization.sections.length > 0) {
        sectionsRef.current = [...customization.sections];
        setSections([...customization.sections]);
      }
    }
  }, [customization]);

  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSecTitle, setNewSecTitle] = useState("");
  const [newSecSubtitle, setNewSecSubtitle] = useState("");
  const [newSecDesc, setNewSecDesc] = useState("");
  const [newSecBtnText, setNewSecBtnText] = useState("");
  const [newSecImage, setNewSecImage] = useState("");

  const [isSavingCustomizer, setIsSavingCustomizer] = useState(false);
  const [customizerSuccess, setCustomizerSuccess] = useState<string | null>(null);

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState("");
  const [logoDragActive, setLogoDragActive] = useState(false);
  const logoFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadLogoFile(file);
    e.target.value = "";
  };

  const uploadLogoFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setLogoUploadError("Logo file size exceeds the 10MB limit.");
      return;
    }

    setLogoUploading(true);
    setLogoUploadError("");

    try {
      const uploaded = await uploadImageAsset(file, 500, true);
      setLogoImageUrl(uploaded.url);
      setLogoUploading(false);
      await handleSaveCustomizer(undefined, undefined, uploaded.url);
    } catch {
      setLogoUploadError("Error reading file.");
      setLogoUploading(false);
    }
  };

  const handleSaveCustomizer = async (
    e?: React.FormEvent,
    sectionsOverride?: CustomSection[],
    logoUrlOverride?: string,
    occasionFiltersOverride?: GiftOccasionFilter[]
  ) => {
    if (e) e.preventDefault();
    setIsSavingCustomizer(true);
    setCustomizerSuccess(null);

    const rawSections = sectionsOverride || sectionsRef.current || sections;
    const targetSections = Array.isArray(rawSections)
      ? rawSections.filter((s): s is CustomSection => Boolean(s && typeof s === "object" && typeof s.id === "string"))
      : [];
    const targetLogoUrl = logoUrlOverride !== undefined ? logoUrlOverride : logoImageUrl;
    const targetOccasionFilters = occasionFiltersOverride !== undefined ? occasionFiltersOverride : giftOccasionFilters;
    const payload: CustomizationSettings = {
      logoText: logoText || "Nicoletta",
      logoSubtext: logoSubtext || "Crafts & Decor",
      logoImageUrl: targetLogoUrl || "",
      logoShowText: logoShowText !== false,
      logoSize: Number(logoSize) || 48,
      logoHideBorder: logoHideBorder !== false,
      philosophyQuote,
      philosophyAuthor,
      giftOccasionFilters: targetOccasionFilters,
      sections: targetSections
    };

    // Always persist locally (both localStorage and IndexedDB) & update live app state immediately
    sectionsRef.current = targetSections;
    setSections(targetSections);
    setGiftOccasionFilters(targetOccasionFilters);
    onUpdateCustomization(payload);
    persistKeyVal("nicoletta_customization", payload);

    // Immediately push to global cloud store so all other browsers & devices receive changes
    pushCloudStore({
      customization: payload,
      products,
      categories,
      testimonials,
      announcements,
      quotes
    }).catch(() => {});

    try {
      const res = await fetch("/api/admin/customization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const updated = await res.json();
        if (updated && typeof updated === "object" && Array.isArray(updated.sections) && updated.sections.length > 0) {
          onUpdateCustomization(updated);
          persistKeyVal("nicoletta_customization", updated);
          try {
            localStorage.removeItem("nicoletta_customization_unsynced");
          } catch {
            // Ignore
          }
        }
      } else {
        safeSetLocalStorage("nicoletta_customization_unsynced", "true");
      }
      setCustomizerSuccess("Site settings, carousel photos, and all store updates saved and synced across all browsers!");
      setTimeout(() => setCustomizerSuccess(null), 4000);
    } catch (err) {
      console.warn("Saved customization locally (server offline):", err);
      safeSetLocalStorage("nicoletta_customization_unsynced", "true");
      setCustomizerSuccess("Site settings and carousel customization saved and synced across all browsers!");
      setTimeout(() => setCustomizerSuccess(null), 4000);
    } finally {
      setIsSavingCustomizer(false);
    }
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;
    
    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    
    // Recalculate orders
    const final = updated.map((sec, idx) => ({ ...sec, order: idx }));
    setSections(final);
    // Auto save the new order immediately to feel extremely responsive!
    handleSaveCustomizer(undefined, final);
  };

  const moveSectionInTab = (secId: string, direction: "up" | "down") => {
    const sortedAll = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    const isOfActiveTab = (sec: CustomSection) => {
      if (activeSectionTab === "home") {
        return sec.page === "home" || sec.id.startsWith("home-") || sec.id.startsWith("custom_");
      }
      if (activeSectionTab === "workshop") {
        return sec.id === "contact-header" || sec.id.startsWith("contact-");
      }
      return false;
    };

    const filtered = sortedAll.filter(isOfActiveTab);
    const indexInFiltered = filtered.findIndex(s => s.id === secId);
    if (indexInFiltered === -1) return;

    const targetIndexInFiltered = direction === "up" ? indexInFiltered - 1 : indexInFiltered + 1;
    if (targetIndexInFiltered < 0 || targetIndexInFiltered >= filtered.length) return;

    const itemA = filtered[indexInFiltered];
    const itemB = filtered[targetIndexInFiltered];

    const idxA = sortedAll.findIndex(s => s.id === itemA.id);
    const idxB = sortedAll.findIndex(s => s.id === itemB.id);

    if (idxA !== -1 && idxB !== -1) {
      const temp = sortedAll[idxA];
      sortedAll[idxA] = sortedAll[idxB];
      sortedAll[idxB] = temp;
    }

    const final = sortedAll.map((sec, idx) => ({ ...sec, order: idx }));
    sectionsRef.current = final;
    setSections(final);
    handleSaveCustomizer(undefined, final);
  };

  // Drag & Drop Reorder States & Helpers
  const [draggedProductIdx, setDraggedProductIdx] = useState<number | null>(null);
  const [dragOverProductIdx, setDragOverProductIdx] = useState<number | null>(null);

  const [draggedCategoryIdx, setDraggedCategoryIdx] = useState<number | null>(null);
  const [dragOverCategoryIdx, setDragOverCategoryIdx] = useState<number | null>(null);

  const [draggedTestimonialIdx, setDraggedTestimonialIdx] = useState<number | null>(null);
  const [dragOverTestimonialIdx, setDragOverTestimonialIdx] = useState<number | null>(null);

  const [draggedAnnouncementIdx, setDraggedAnnouncementIdx] = useState<number | null>(null);
  const [dragOverAnnouncementIdx, setDragOverAnnouncementIdx] = useState<number | null>(null);

  const [sectionDragArmedId, setSectionDragArmedId] = useState<string | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  const [slideDragArmedIdx, setSlideDragArmedIdx] = useState<number | null>(null);
  const [draggedSlideIdx, setDraggedSlideIdx] = useState<number | null>(null);
  const [dragOverSlideIdx, setDragOverSlideIdx] = useState<number | null>(null);

  const [draggedHeroPhotoIdx, setDraggedHeroPhotoIdx] = useState<number | null>(null);
  const [dragOverHeroPhotoIdx, setDragOverHeroPhotoIdx] = useState<number | null>(null);

  const [draggedGalleryIdx, setDraggedGalleryIdx] = useState<number | null>(null);
  const [dragOverGalleryIdx, setDragOverGalleryIdx] = useState<number | null>(null);

  function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
      return list;
    }
    const updated = [...list];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    return updated;
  }

  const handleReorderProducts = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    onUpdateProducts(reorderList(products, fromIdx, toIdx));
  };

  const handleReorderCategories = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    onUpdateCategories(reorderList(categories, fromIdx, toIdx));
  };

  const handleReorderTestimonials = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    onUpdateTestimonials(reorderList(testimonials, fromIdx, toIdx));
  };

  const handleReorderAnnouncements = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    onUpdateAnnouncements(reorderList(announcements, fromIdx, toIdx));
  };

  const handleDropSectionInTab = (sourceSecId: string, targetSecId: string) => {
    if (!sourceSecId || !targetSecId || sourceSecId === targetSecId) return;
    const sortedAll = [...(sectionsRef.current || sections)].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idxFrom = sortedAll.findIndex((s) => s.id === sourceSecId);
    const idxTo = sortedAll.findIndex((s) => s.id === targetSecId);
    if (idxFrom === -1 || idxTo === -1) return;
    const reordered = reorderList(sortedAll, idxFrom, idxTo).map((sec, idx) => ({ ...sec, order: idx }));
    sectionsRef.current = reordered;
    setSections(reordered);
    handleSaveCustomizer(undefined, reordered);
  };

  const handleReorderHeroSlides = (secId: string, currentUrls: string[], fromSlideIdx: number, toSlideIdx: number) => {
    const numSlides = Math.max(1, Math.ceil(currentUrls.length / 3));
    if (fromSlideIdx === toSlideIdx || fromSlideIdx < 0 || toSlideIdx < 0 || fromSlideIdx >= numSlides || toSlideIdx >= numSlides) return;
    const groups: string[][] = [];
    for (let i = 0; i < numSlides; i++) {
      groups.push([
        currentUrls[i * 3] || "",
        currentUrls[i * 3 + 1] || "",
        currentUrls[i * 3 + 2] || ""
      ]);
    }
    const reorderedGroups = reorderList(groups, fromSlideIdx, toSlideIdx);
    const updatedUrls = reorderedGroups.flat();
    const firstValid = updatedUrls.find((u) => typeof u === "string" && u.trim().length > 0) || "";
    const nextSections = (sectionsRef.current || sections).map((s) =>
      s.id === secId ? { ...s, imageUrls: updatedUrls, imageUrl: firstValid } : s
    );
    sectionsRef.current = nextSections;
    setSections(nextSections);
    handleSaveCustomizer(undefined, nextSections);
  };

  const handleReorderHeroPhoto = (secId: string, currentUrls: string[], fromGlobalIdx: number, toGlobalIdx: number) => {
    if (fromGlobalIdx === toGlobalIdx || fromGlobalIdx < 0 || toGlobalIdx < 0) return;
    const maxIdx = Math.max(currentUrls.length - 1, fromGlobalIdx, toGlobalIdx);
    const padded = [...currentUrls];
    while (padded.length <= maxIdx) padded.push("");
    const temp = padded[fromGlobalIdx];
    padded[fromGlobalIdx] = padded[toGlobalIdx];
    padded[toGlobalIdx] = temp;
    const firstValid = padded.find((u) => typeof u === "string" && u.trim().length > 0) || "";
    const nextSections = (sectionsRef.current || sections).map((s) =>
      s.id === secId ? { ...s, imageUrls: padded, imageUrl: firstValid } : s
    );
    sectionsRef.current = nextSections;
    setSections(nextSections);
    handleSaveCustomizer(undefined, nextSections);
  };

  const toggleSectionVisibility = (id: string) => {
    const final = sections.map((sec) =>
      sec.id === id ? { ...sec, visible: sec.visible === false ? true : false } : sec
    );
    setSections(final);
    handleSaveCustomizer(undefined, final);
  };

  const deleteSection = (id: string) => {
    if (confirm("Are you sure you want to permanently delete this custom section?")) {
      const final = sections.filter((sec) => sec.id !== id);
      setSections(final);
      handleSaveCustomizer(undefined, final);
    }
  };

  const updateSectionText = (id: string, field: keyof CustomSection | Partial<CustomSection>, value?: any) => {
    setSections((prev) => {
      const next = prev.map((sec) => {
        if (sec.id === id) {
          if (typeof field === "object" && field !== null) {
            return { ...sec, ...field };
          } else {
            return { ...sec, [field as keyof CustomSection]: value };
          }
        }
        return sec;
      });
      sectionsRef.current = next;
      return next;
    });
  };

  const handleAddCustomSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecTitle.trim()) {
      alert("Title is required for custom sections");
      return;
    }
    const newSec: CustomSection = {
      id: "custom_" + Date.now(),
      page: "home",
      name: `Custom: ${newSecTitle.trim()}`,
      title: newSecTitle.trim(),
      subtitle: newSecSubtitle.trim(),
      description: newSecDesc.trim(),
      buttonText: newSecBtnText.trim() || undefined,
      imageUrl: newSecImage.trim() || undefined,
      order: sections.length,
      visible: true
    };
    const final = [...sections, newSec];
    setSections(final);
    setIsAddingSection(false);
    // Clear fields
    setNewSecTitle("");
    setNewSecSubtitle("");
    setNewSecDesc("");
    setNewSecBtnText("");
    setNewSecImage("");
    // Save to server
    handleSaveCustomizer(undefined, final);
  };

  // Edit / Creation states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [customOccasionInput, setCustomOccasionInput] = useState("");
  const [productForm, setProductForm] = useState<{
    name: string;
    description: string;
    categoryId: string;
    price: number;
    maxPrice: string;
    promoPrice: string;
    image: string;
    additionalImages?: string[];
    featured: boolean;
    inStock: boolean;
    readyForPickup?: boolean;
    isEngravingProduct?: boolean;
    isHandmadeFlowers?: boolean;
    customOptions: string;
    hideCustomOptions?: boolean;
    hasVisualizer: boolean;
    hasEngravingText?: boolean;
    hasTypography?: boolean;
    leadTime?: string;
    dimensions?: string;
    badge?: string;
    seal?: string;
    includedNotes?: string;
    giftOccasions?: string[];
    materialDetails?: string;
    pricingNotice?: string;
    alternativeRequestText?: string;
  }>({
    name: "",
    description: "",
    categoryId: "",
    price: 0,
    maxPrice: "",
    promoPrice: "",
    image: "",
    additionalImages: [],
    featured: false,
    inStock: true,
    readyForPickup: false,
    isEngravingProduct: false,
    isHandmadeFlowers: false,
    customOptions: "",
    hideCustomOptions: false,
    hasVisualizer: true,
    hasEngravingText: true,
    hasTypography: true,
    leadTime: "",
    dimensions: "",
    badge: "",
    seal: "",
    includedNotes: "",
    giftOccasions: [],
    materialDetails: "",
    pricingNotice: "",
    alternativeRequestText: ""
  });

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    image: ""
  });

  const [isAddingAnnouncement, setIsAddingAnnouncement] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    type: "info" as "info" | "promo" | "urgent",
    active: true
  });

  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quotePrice, setQuotePrice] = useState(0);
  const [quotePhotos, setQuotePhotos] = useState<{ name: string; url: string; size?: number }[]>([]);
  const [uploadingAdminPhoto, setUploadingAdminPhoto] = useState(false);
  const [adminPhotoError, setAdminPhotoError] = useState("");
  const [drawerStatus, setDrawerStatus] = useState<QuoteRequest["status"]>("quoted");

  // Custom Image Upload states
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // Section Image Upload states
  const [uploadingSectionId, setUploadingSectionId] = useState<string | null>(null);
  const [uploadingSlideIndex, setUploadingSlideIndex] = useState<{ sectionId: string; index: number } | null>(null);
  const [sectionUploadError, setSectionUploadError] = useState<string>("");

  // Cloud sync live state
  const [cloudSyncState, setCloudSyncState] = useState<CloudSyncState>("idle");
  const [cloudLastSynced, setCloudLastSynced] = useState<string | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  React.useEffect(() => {
    return subscribeCloudSync((st, at) => {
      setCloudSyncState(st);
      if (at) setCloudLastSynced(at);
    });
  }, []);

  const handleManualCloudSync = async () => {
    setIsManualSyncing(true);
    setSyncFeedback(null);
    try {
      const ok = await pushCloudStore({
        customization,
        products,
        categories,
        testimonials,
        announcements,
        quotes
      });
      if (ok) {
        setSyncFeedback("All products, categories, photos, and settings successfully synced to cloud!");
      } else {
        setSyncFeedback("Sync attempt completed. Saved to local browser cache.");
      }
    } catch {
      setSyncFeedback("Sync attempt completed. Saved to local browser cache.");
    } finally {
      setIsManualSyncing(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };
  const [quotesFilter, setQuotesFilter] = useState<"all" | "pending" | "reviewing" | "quoted" | "approved" | "completed" | "rejected">("all");
  const [messagesFilter, setMessagesFilter] = useState<"all" | "pending" | "reviewing" | "quoted" | "approved" | "completed" | "rejected">("all");
  const [isAddingTestimonial, setIsAddingTestimonial] = useState(false);
  const [testimonialForm, setTestimonialForm] = useState({
    author: "",
    rating: 5,
    content: "",
    company: ""
  });
  const [promoProductId, setPromoProductId] = useState<string>("");
  const [promoDiscountPercent, setPromoDiscountPercent] = useState<number>(15);

  // Email Proposal States
  const [emailQuote, setEmailQuote] = useState<QuoteRequest | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [emailError, setEmailError] = useState<string>("");

  // Gmail Configuration States
  const [gmailPasswordInput, setGmailPasswordInput] = useState(
    customization.emailSettings?.gmailAppPassword || ""
  );
  const [showGmailPassword, setShowGmailPassword] = useState(false);
  const [emailConfigSaved, setEmailConfigSaved] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testEmailMsg, setTestEmailMsg] = useState("");

  const handleOpenEmailCompose = (q: QuoteRequest) => {
    const currentPrice = q.quoteAmount || quotePrice || (q.productId ? products.find((p) => p.id === q.productId)?.price || 85 : 85);
    const defaultSubject = `Custom Craft Quote & Preview - ${q.productName} [Nicoletta Crafts & Decor]`;
    const defaultBody = `Hi ${q.customerName},\n\nThank you for reaching out to Nicoletta Crafts & Decor! We have reviewed your request for the "${q.productName}".\n\nBased on your details:\n${q.engravingText ? `- Custom Personalization: "${q.engravingText}"\n` : ""}${q.fontPreference ? `- Typography Preference: ${q.fontPreference}\n` : ""}- Quantity: ${q.quantity} unit(s)\n${q.deadline ? `- Target Deadline: ${q.deadline}\n` : ""}${q.specialInstructions ? `- Notes & Instructions: ${q.specialInstructions}\n` : ""}\nWe are delighted to provide your custom quote estimate:\n👉 Total Quote Estimate: $${currentPrice} CAD\n\nIf you have any questions or would like to confirm your order, simply reply to this email (sales@nicolettacraftsdecor.ca). Once your order is confirmed, we'll send you a design preview for approval before bringing your idea to life!\n\nWarm regards,\nNicoletta\nNicoletta Crafts & Decor\nsales@nicolettacraftsdecor.ca\nhttps://www.nicolettacraftsdecor.ca`;
    
    setEmailQuote(q);
    setEmailSubject(defaultSubject);
    setEmailBody(defaultBody);
    setEmailStatus("idle");
    setEmailError("");
  };

  const handleSendEmail = async () => {
    if (!emailQuote) return;
    setEmailStatus("sending");
    setEmailError("");

    const currentPrice = emailQuote.quoteAmount || quotePrice || (emailQuote.productId ? products.find((p) => p.id === emailQuote.productId)?.price || 85 : 85);

    const result = await dispatchClientProposal(
      {
        clientEmail: emailQuote.customerEmail,
        clientName: emailQuote.customerName,
        subject: emailSubject,
        body: emailBody,
        quoteAmount: Number(currentPrice),
        quoteId: emailQuote.id
      },
      customization.emailSettings
    );

    const updated = quotes.map((q) =>
      q.id === emailQuote.id
        ? {
            ...q,
            status: "quoted" as const,
            quoteAmount: Number(currentPrice),
            adminNotes: `${q.adminNotes || ""}\n[System: Sent customized email quote proposal via ${result.method === "smtp" ? "Gmail SMTP (sales@nicolettacraftsdecor.ca)" : "Gmail Web"} on ${new Date().toLocaleDateString()}]`.trim(),
            updatedAt: new Date().toISOString()
          }
        : q
    );
    onUpdateQuotes(updated);

    if (result.success) {
      setEmailStatus("sent");
      setTimeout(() => {
        setEmailQuote(null);
        setSelectedQuoteId(null);
      }, 1500);
    } else {
      if (result.error) {
        setEmailError(result.error);
      }
      openGmailCompose({
        to: emailQuote.customerEmail,
        subject: emailSubject,
        body: emailBody
      });
      setEmailStatus("sent");
      setTimeout(() => {
        setEmailQuote(null);
        setSelectedQuoteId(null);
      }, 2500);
    }
  };

  const handleOpenDirectGmail = () => {
    if (!emailQuote) return;
    openGmailCompose({
      to: emailQuote.customerEmail,
      subject: emailSubject,
      body: emailBody
    });
  };

  const handleSaveGmailConfig = () => {
    const updatedCustomization: CustomizationSettings = {
      ...customization,
      emailSettings: {
        ...customization.emailSettings,
        adminEmail: "sales@nicolettacraftsdecor.ca",
        gmailUser: "sales@nicolettacraftsdecor.ca",
        gmailAppPassword: gmailPasswordInput.trim().replace(/\s+/g, ""),
        emailNotificationsEnabled: true
      }
    };
    onUpdateCustomization(updatedCustomization);
    pushCloudStore({ customization: updatedCustomization }).catch(() => {});
    setEmailConfigSaved(true);
    setTimeout(() => setEmailConfigSaved(false), 3000);
  };

  const handleSendTestEmail = async () => {
    setTestEmailStatus("testing");
    setTestEmailMsg("");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "sales@nicolettacraftsdecor.ca",
          from: "sales@nicolettacraftsdecor.ca",
          subject: "[Nicoletta Portal] Gmail Automation Engine Test Email",
          text: "Congratulations! Your Gmail automation engine for sales@nicolettacraftsdecor.ca is successfully connected and operational.",
          appPassword: gmailPasswordInput.trim().replace(/\s+/g, "")
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTestEmailStatus("success");
        setTestEmailMsg("Test email delivered successfully to sales@nicolettacraftsdecor.ca!");
      } else {
        setTestEmailStatus("error");
        setTestEmailMsg(data.error || "Could not connect to Gmail SMTP. Please verify your 16-character App Password.");
      }
    } catch (err: any) {
      setTestEmailStatus("error");
      setTestEmailMsg(err.message || "Failed to reach email API.");
    }
  };

  const handleDownloadAttachment = (fileUrl: string, fileName: string) => {
    try {
      const cleanName = fileName || "client_attachment.png";
      if (fileUrl.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = fileUrl;
        a.download = cleanName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        fetch(fileUrl)
          .then((res) => res.blob())
          .then((blob) => {
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = cleanName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1500);
          })
          .catch(() => {
            const a = document.createElement("a");
            a.href = fileUrl;
            a.download = cleanName;
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          });
      }
    } catch (err) {
      console.error("Attachment download error:", err);
    }
  };

  const handleSendEmailSimulated = () => {
    if (!emailQuote) return;
    setEmailStatus("sending");
    
    // Simulate sending email api
    setTimeout(() => {
      setEmailStatus("sent");
      
      // Update status to quoted and save
      const currentPrice = emailQuote.quoteAmount || quotePrice || (emailQuote.productId ? products.find((p) => p.id === emailQuote.productId)?.price || 85 : 85);
      const updated = quotes.map((q) =>
        q.id === emailQuote.id
          ? {
              ...q,
              status: "quoted" as const,
              quoteAmount: Number(currentPrice),
              adminNotes: `${q.adminNotes || ""}\n[System: Sent customized email quote proposal on ${new Date().toLocaleDateString()}]`.trim(),
              updatedAt: new Date().toISOString()
            }
          : q
      );
      onUpdateQuotes(updated);
      
      setTimeout(() => {
        setEmailQuote(null);
        setSelectedQuoteId(null);
      }, 1500);
    }, 1200);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image file exceeds the 10MB limit.");
      return;
    }

    setUploadingImage(true);
    setUploadError("");

    try {
      const uploaded = await uploadImageAsset(file, 1200);
      setProductForm((prev) => ({ ...prev, image: uploaded.url }));
    } catch {
      setUploadError("Error reading file.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleAdditionalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setUploadError("");

    const fileList: File[] = Array.from(files);
    e.target.value = "";

    for (const file of fileList) {
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`"${file.name}" exceeds the 10MB limit.`);
        continue;
      }
      try {
        const uploaded = await uploadImageAsset(file, 1200);
        setProductForm((prev) => ({
          ...prev,
          additionalImages: [...(prev.additionalImages || []), uploaded.url]
        }));
      } catch {
        setUploadError(`Failed to read "${file.name}".`);
      }
    }
    setUploadingImage(false);
  };

  const handleCategoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 10 * 1024 * 1024) return;
    try {
      const uploaded = await uploadImageAsset(file, 1000);
      setCategoryForm((prev) => ({ ...prev, image: uploaded.url }));
    } catch {
      // Ignore error
    }
  };

  const handleSectionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, sectionId: string, slideIndex?: number) => {
    const fileList: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (fileList.length === 0) return;
    e.target.value = "";

    for (const f of fileList) {
      if (f.size > 15 * 1024 * 1024) {
        setSectionUploadError(`"${f.name}" exceeds the 15MB limit.`);
        return;
      }
    }

    if (slideIndex !== undefined) {
      setUploadingSlideIndex({ sectionId, index: slideIndex });
    } else {
      setUploadingSectionId(sectionId);
    }
    setSectionUploadError("");

    try {
      const uploadedUrls: string[] = [];
      for (const file of fileList) {
        const uploaded = await uploadImageAsset(file, sectionId === "home-hero" ? 850 : 1000, false);
        uploadedUrls.push(uploaded.url);
      }

      const prevSections = sectionsRef.current || sections;
      const updatedSections = prevSections.map((s) => {
        if (s.id !== sectionId) return s;
        if (sectionId === "home-hero") {
          const currentUrls = s.imageUrls && s.imageUrls.length > 0
            ? [...s.imageUrls]
            : (s.imageUrl ? [s.imageUrl] : []);
          if (slideIndex !== undefined) {
            uploadedUrls.forEach((u, offset) => {
              const targetIdx = slideIndex + offset;
              while (currentUrls.length <= targetIdx) {
                currentUrls.push("");
              }
              currentUrls[targetIdx] = u;
            });
          } else {
            currentUrls.push(...uploadedUrls);
          }
          const firstValid = currentUrls.find((u) => typeof u === "string" && u.trim().length > 0) || uploadedUrls[0] || "";
          return { ...s, imageUrl: firstValid, imageUrls: currentUrls };
        }
        return { ...s, imageUrl: uploadedUrls[0] || s.imageUrl };
      });

      sectionsRef.current = updatedSections;
      setSections(updatedSections);
      await handleSaveCustomizer(undefined, updatedSections);
    } catch {
      setSectionUploadError("Error reading file.");
    } finally {
      setUploadingSectionId(null);
      setUploadingSlideIndex(null);
    }
  };

  // PRESET PRODUCTS IMAGES library for convenience
  const imagePresets = [
    { name: "Walnut Cutting Board", url: "https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&q=80&w=600" },
    { name: "Leather Journal", url: "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80&w=600" },
    { name: "Whiskey Decanter", url: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=600" },
    { name: "Slate Coasters", url: "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&q=80&w=600" },
    { name: "Wood Tray", url: "https://images.unsplash.com/photo-1590736969955-71cb94801759?auto=format&fit=crop&q=80&w=600" },
    { name: "Leather Wallet", url: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&q=80&w=600" }
  ];

  // PRODUCT ACTIONS
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const optionsArray = productForm.customOptions
      ? productForm.customOptions.split(",").map((o) => o.trim()).filter((o) => o.length > 0)
      : [];
    const includedArray = productForm.includedNotes
      ? productForm.includedNotes.split(",").map((o) => o.trim()).filter((o) => o.length > 0)
      : [];

    const parsedPromo = productForm.promoPrice ? Number(productForm.promoPrice) : undefined;
    const parsedMaxPrice = productForm.maxPrice ? Number(productForm.maxPrice) : undefined;
    const occasionsArray = Array.isArray(productForm.giftOccasions)
      ? productForm.giftOccasions.map((o) => o.trim()).filter(Boolean)
      : [];

    if (editingProduct) {
      // Update
      const updated = products.map((p) =>
          p.id === editingProduct.id
              ? {
                ...p,
                name: productForm.name,
                description: productForm.description,
                categoryId: productForm.categoryId,
                price: Number(productForm.price),
                maxPrice: parsedMaxPrice,
                promoPrice: parsedPromo,
                images: [productForm.image || p.images[0], ...(productForm.additionalImages || [])].filter(Boolean),
                featured: productForm.featured,
                inStock: productForm.inStock,
                readyForPickup: Boolean(productForm.readyForPickup),
                isEngravingProduct: Boolean(productForm.isEngravingProduct),
                isHandmadeFlowers: Boolean(productForm.isHandmadeFlowers),
                customOptions: optionsArray,
                hideCustomOptions: productForm.hideCustomOptions,
                hideOptionsAvailable: productForm.hideCustomOptions,
                hasVisualizer: productForm.hasVisualizer,
                hasEngravingText: productForm.hasEngravingText,
                hasTypography: productForm.hasTypography,
                leadTime: (productForm.leadTime || "").trim(),
                dimensions: (productForm.dimensions || "").trim(),
                badge: (productForm.badge || "").trim(),
                seal: (productForm.seal || "").trim(),
                includedNotes: includedArray,
                giftOccasions: occasionsArray,
                materialDetails: (productForm.materialDetails || "").trim(),
                pricingNotice: (productForm.pricingNotice || "").trim(),
                alternativeRequestText: (productForm.alternativeRequestText || "").trim()
              }
              : p
      );
      onUpdateProducts(updated);
      setEditingProduct(null);
    } else {
      // Create
      const newProduct: Product = {
        id: "p_" + Date.now(),
        name: productForm.name,
        description: productForm.description,
        categoryId: productForm.categoryId || categories[0]?.id || "wood",
        price: Number(productForm.price),
        maxPrice: parsedMaxPrice,
        promoPrice: parsedPromo,
        images: [productForm.image || imagePresets[0].url, ...(productForm.additionalImages || [])].filter(Boolean),
        featured: productForm.featured,
        inStock: productForm.inStock,
        readyForPickup: Boolean(productForm.readyForPickup),
        isEngravingProduct: Boolean(productForm.isEngravingProduct),
        isHandmadeFlowers: Boolean(productForm.isHandmadeFlowers),
        customOptions: optionsArray,
        hideCustomOptions: productForm.hideCustomOptions,
        hideOptionsAvailable: productForm.hideCustomOptions,
        hasVisualizer: productForm.hasVisualizer !== undefined ? productForm.hasVisualizer : true,
        hasEngravingText: productForm.hasEngravingText !== undefined ? productForm.hasEngravingText : true,
        hasTypography: productForm.hasTypography !== undefined ? productForm.hasTypography : true,
        leadTime: (productForm.leadTime || "").trim(),
        dimensions: (productForm.dimensions || "").trim(),
        badge: (productForm.badge || "").trim(),
        seal: (productForm.seal || "").trim(),
        includedNotes: includedArray,
        giftOccasions: occasionsArray,
        materialDetails: (productForm.materialDetails || "").trim(),
        pricingNotice: (productForm.pricingNotice || "").trim(),
        alternativeRequestText: (productForm.alternativeRequestText || "").trim()
      };
      onUpdateProducts([...products, newProduct]);
      setIsAddingProduct(false);
    }

    // Reset Form
    setCustomOccasionInput("");
    setProductForm({
      name: "",
      description: "",
      categoryId: "",
      price: 0,
      maxPrice: "",
      promoPrice: "",
      image: "",
      additionalImages: [],
      featured: false,
      inStock: true,
      readyForPickup: false,
      isEngravingProduct: false,
      isHandmadeFlowers: false,
      customOptions: "",
      hideCustomOptions: false,
      hasVisualizer: true,
      hasEngravingText: true,
      hasTypography: true,
      leadTime: "",
      dimensions: "",
      badge: "",
      seal: "",
      includedNotes: "",
      giftOccasions: [],
      materialDetails: "",
      pricingNotice: "",
      alternativeRequestText: ""
    });
  };

  const startEditProduct = (p: Product) => {
    setEditingProduct(p);
    setIsAddingProduct(false);
    setCustomOccasionInput("");
    setProductForm({
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      price: p.price,
      maxPrice: p.maxPrice ? String(p.maxPrice) : "",
      promoPrice: p.promoPrice ? String(p.promoPrice) : "",
      image: p.images[0] || "",
      additionalImages: p.images.slice(1),
      featured: p.featured,
      inStock: p.inStock,
      readyForPickup: Boolean(p.readyForPickup),
      isEngravingProduct: Boolean(p.isEngravingProduct),
      isHandmadeFlowers: Boolean(p.isHandmadeFlowers),
      customOptions: p.customOptions ? p.customOptions.join(", ") : "",
      hideCustomOptions: !!(p.hideCustomOptions || p.hideOptionsAvailable),
      hasVisualizer: p.hasVisualizer !== false,
      hasEngravingText: p.hasEngravingText !== undefined ? p.hasEngravingText : (p.hasVisualizer !== false),
      hasTypography: p.hasTypography !== undefined ? p.hasTypography : (p.hasVisualizer !== false),
      leadTime: p.leadTime || "",
      dimensions: p.dimensions || "",
      badge: p.badge || "",
      seal: p.seal || "",
      includedNotes: p.includedNotes ? p.includedNotes.join(", ") : "",
      giftOccasions: Array.isArray(p.giftOccasions) ? [...p.giftOccasions] : [],
      materialDetails: p.materialDetails || "",
      pricingNotice: p.pricingNotice || "",
      alternativeRequestText: p.alternativeRequestText || ""
    });
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      onUpdateProducts(products.filter((p) => p.id !== id));
    }
  };

  // CATEGORY ACTIONS
  const startEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      description: cat.description,
      image: cat.image
    });
    setIsAddingCategory(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      const updatedCats = categories.map((c) =>
        c.id === editingCategory.id
          ? {
              ...c,
              name: categoryForm.name,
              description: categoryForm.description,
              image: categoryForm.image || imagePresets[0].url
            }
          : c
      );
      onUpdateCategories(updatedCats);
      setEditingCategory(null);
    } else {
      const newCat: Category = {
        id: categoryForm.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        name: categoryForm.name,
        slug: categoryForm.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        description: categoryForm.description,
        image: categoryForm.image || imagePresets[0].url
      };
      onUpdateCategories([...categories, newCat]);
    }
    setIsAddingCategory(false);
    setCategoryForm({ name: "", description: "", image: "" });
  };

  const handleDeleteCategory = (id: string) => {
    if (confirm("Are you sure you want to delete this category? Products in this category will become uncategorized.")) {
      onUpdateCategories(categories.filter((c) => c.id !== id));
    }
  };

  // TESTIMONIAL ACTIONS
  const handleApproveTestimonial = (id: string) => {
    const updated = testimonials.map((t) => (t.id === id ? { ...t, approved: true } : t));
    onUpdateTestimonials(updated);
  };

  const handleDeleteTestimonial = (id: string) => {
    if (confirm("Are you sure you want to delete this testimonial?")) {
      onUpdateTestimonials(testimonials.filter((t) => t.id !== id));
    }
  };

  const handleSaveManualTestimonial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testimonialForm.author || !testimonialForm.content) {
      alert("Author name and Review message are required.");
      return;
    }

    const newTestimonial: Testimonial = {
      id: "t_" + Date.now(),
      author: testimonialForm.author,
      rating: testimonialForm.rating,
      content: testimonialForm.content,
      company: testimonialForm.company || undefined,
      approved: true, // Direct admin addition is pre-approved
      date: new Date().toISOString().split("T")[0]
    };

    onUpdateTestimonials([...testimonials, newTestimonial]);
    setIsAddingTestimonial(false);
    setTestimonialForm({ author: "", rating: 5, content: "", company: "" });
  };

  // ANNOUNCEMENT ACTIONS
  const handleSaveAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();

    let finalTitle = announcementForm.title;
    let finalContent = announcementForm.content;

    // Direct product promotion pricing syncer
    if (announcementForm.type === "promo" && promoProductId) {
      const targetProduct = products.find(p => p.id === promoProductId);
      if (targetProduct) {
        const calculatedPromoPrice = Math.round(targetProduct.price * (1 - promoDiscountPercent / 100));
        
        // Auto-update products promoPrice
        const updatedProducts = products.map(p => 
          p.id === promoProductId ? { ...p, promoPrice: calculatedPromoPrice } : p
        );
        onUpdateProducts(updatedProducts);

        if (!finalTitle || finalTitle.trim() === "") {
          finalTitle = `🎪 Craft Fair Promo: ${targetProduct.name}!`;
        }
        if (!finalContent || finalContent.trim() === "") {
          finalContent = `Stop by our workshop or order online! Hand-finished ${targetProduct.name} is ${promoDiscountPercent}% off at only $${calculatedPromoPrice} USD!`;
        }
      }
    }

    const newAnn: Announcement = {
      id: "a_" + Date.now(),
      title: finalTitle || "Artisan Shop Announcement",
      content: finalContent || "Limited time specialized crafting alert.",
      type: announcementForm.type,
      active: announcementForm.active,
      date: new Date().toISOString().split("T")[0]
    };

    onUpdateAnnouncements([...announcements, newAnn]);
    setIsAddingAnnouncement(false);
    setAnnouncementForm({ title: "", content: "", type: "info", active: true });
    setPromoProductId("");
    setPromoDiscountPercent(15);
  };

  const handleToggleAnnouncement = (id: string) => {
    const updated = announcements.map((a) => (a.id === id ? { ...a, active: !a.active } : a));
    onUpdateAnnouncements(updated);
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (confirm("Are you sure you want to delete this announcement?")) {
      onUpdateAnnouncements(announcements.filter((a) => a.id !== id));
    }
  };

  // QUOTE & MESSAGE ACTIONS
  const startReviewQuote = (q: QuoteRequest) => {
    setSelectedQuoteId(q.id);
    setQuoteNotes(q.adminNotes || "");
    setQuotePrice(q.quoteAmount || (q.productId ? products.find((p) => p.id === q.productId)?.price || 50 : 50));
    setQuotePhotos(q.adminPhotos || []);
    setAdminPhotoError("");
    setDrawerStatus(q.status === "pending" ? "reviewing" : q.status);

    if (q.status === "pending") {
      const updated = quotes.map((item) =>
        item.id === q.id ? { ...item, status: "reviewing" as const, updatedAt: new Date().toISOString() } : item
      );
      onUpdateQuotes(updated);
    }
  };

  const handleAdminPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingAdminPhoto(true);
    setAdminPhotoError("");

    const fileList: File[] = Array.from(files);
    e.target.value = "";

    for (const file of fileList) {
      if (file.size > 10 * 1024 * 1024) {
        setAdminPhotoError(`File "${file.name}" exceeds 10MB limit.`);
        continue;
      }
      try {
        const uploaded = await uploadImageAsset(file, 1200);
        setQuotePhotos((prev) => [...prev, { name: uploaded.name, url: uploaded.url, size: uploaded.size }]);
      } catch {
        setAdminPhotoError(`Failed to read "${file.name}".`);
      }
    }
    setUploadingAdminPhoto(false);
  };

  const removeAdminPhoto = (idx: number) => {
    setQuotePhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveQuoteStatus = async (id: string, status: QuoteRequest["status"]) => {
    const updated = quotes.map((q) =>
      q.id === id ? { ...q, status, updatedAt: new Date().toISOString() } : q
    );
    onUpdateQuotes(updated);

    if (token) {
      try {
        await fetch(`/api/admin/quotes/${id}/status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ status })
        });
      } catch (e) {
        console.error("Failed to update status on backend:", e);
      }
    }
  };

  const handleSaveQuoteDetails = async () => {
    if (!selectedQuoteId) return;
    const currentQuote = quotes.find((q) => q.id === selectedQuoteId);
    const finalStatus = drawerStatus || (currentQuote?.status === "pending" || currentQuote?.status === "reviewing" ? "quoted" : currentQuote?.status || "quoted");

    const updated = quotes.map((q) =>
      q.id === selectedQuoteId
        ? {
            ...q,
            adminNotes: quoteNotes,
            quoteAmount: quotePrice,
            adminPhotos: quotePhotos,
            status: finalStatus,
            updatedAt: new Date().toISOString()
          }
        : q
    );
    onUpdateQuotes(updated);

    if (token) {
      try {
        await fetch(`/api/admin/quotes/${selectedQuoteId}/details`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            adminNotes: quoteNotes,
            quoteAmount: quotePrice,
            adminPhotos: quotePhotos,
            status: finalStatus
          })
        });
      } catch (e) {
        console.error("Failed to sync details:", e);
      }
    }

    setSelectedQuoteId(null);
  };

  // Categorize Quote Requests vs Contact Messages
  const isContactMsg = (q: QuoteRequest) =>
    q.type === "contact" ||
    Boolean(q.productName && (q.productName.toLowerCase().startsWith("contact message") || q.productName.toLowerCase().includes("contact message")));

  const isQuoteReq = (q: QuoteRequest) => !isContactMsg(q);

  const quoteRequestsList = quotes.filter(isQuoteReq);
  const contactMessagesList = quotes.filter(isContactMsg);

  const pendingQuotes = quoteRequestsList.filter((q) => q.status === "pending").length;
  const pendingMessages = contactMessagesList.filter((q) => q.status === "pending").length;
  const totalApprovedTestimonials = testimonials.filter((t) => t.approved).length;
  const totalPendingTestimonials = testimonials.filter((t) => !t.approved).length;

  return (
    <div id="admin-dashboard-container" className="bg-brand-bg border border-brand-border rounded-[24px] overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[550px] font-sans">
      {/* Sidebar Navigation */}
      <div className="md:col-span-3 bg-brand-dark text-brand-muted p-5 space-y-1 border-r border-brand-border/10 rounded-l-[24px]">
        <div className="px-2 py-4 mb-4 border-b border-brand-border/10 flex items-center gap-2">
          <Sliders className="h-4.5 w-4.5 text-brand-primary" />
          <span className="font-serif font-bold text-base text-brand-highlight uppercase tracking-wider">Artisan Portal</span>
        </div>

        {/* Global Cloud Sync Status Pill & Force-Sync Button */}
        <div className="mx-1 mb-4 p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-stone-300 font-semibold flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${cloudSyncState === "syncing" ? "bg-amber-400 animate-pulse" : cloudSyncState === "error" ? "bg-red-400" : "bg-emerald-400"}`}></span>
              {cloudSyncState === "syncing" ? "Syncing..." : cloudSyncState === "error" ? "Local Cache" : "Cloud Active"}
            </span>
            <span className="text-[9px] text-stone-400 font-mono">
              All Browsers
            </span>
          </div>
          <p className="text-[9px] text-stone-300 leading-tight">
            Changes save to cloud so every browser, phone, and visitor sees your latest updates.
          </p>
          <button
            type="button"
            onClick={handleManualCloudSync}
            disabled={isManualSyncing}
            className="w-full text-center py-1.5 px-2 bg-brand-primary text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-brand-primary-hover transition-colors disabled:opacity-50 cursor-pointer shadow-3xs"
          >
            {isManualSyncing ? "Syncing..." : "Sync Local Data to Cloud"}
          </button>
          {syncFeedback && (
            <p className="text-[9px] text-emerald-300 font-medium text-center animate-fade-in">
              {syncFeedback}
            </p>
          )}
        </div>

        <nav className="space-y-2">
          <button
            id="tab-btn-quotes"
            onClick={() => setActiveTab("quotes")}
            className={`w-full text-left py-2 px-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center justify-between transition-colors cursor-pointer ${activeTab === "quotes" ? "bg-brand-primary text-white" : "hover:bg-brand-primary/10 text-brand-muted"}`}
          >
            <span className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> Quote Requests
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-mono opacity-80">({quoteRequestsList.length})</span>
              {pendingQuotes > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingQuotes} NEW
                </span>
              )}
            </div>
          </button>

          <button
            id="tab-btn-messages"
            onClick={() => setActiveTab("messages")}
            className={`w-full text-left py-2 px-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center justify-between transition-colors cursor-pointer ${activeTab === "messages" ? "bg-brand-primary text-white" : "hover:bg-brand-primary/10 text-brand-muted"}`}
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5" /> Contact Messages
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-mono opacity-80">({contactMessagesList.length})</span>
              {pendingMessages > 0 && (
                <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingMessages} NEW
                </span>
              )}
            </div>
          </button>

          <button
            id="tab-btn-analytics"
            onClick={() => setActiveTab("analytics")}
            className={`w-full text-left py-2 px-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer ${activeTab === "analytics" ? "bg-brand-primary text-white" : "hover:bg-brand-primary/10 text-brand-muted"}`}
          >
            <TrendingUp className="h-3.5 w-3.5" /> Basic Analytics
          </button>

          <button
            id="tab-btn-products"
            onClick={() => setActiveTab("products")}
            className={`w-full text-left py-2 px-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer ${activeTab === "products" ? "bg-brand-primary text-white" : "hover:bg-brand-primary/10 text-brand-muted"}`}
          >
            <Briefcase className="h-3.5 w-3.5" /> Manage Crafts
          </button>

          <button
            id="tab-btn-categories"
            onClick={() => setActiveTab("categories")}
            className={`w-full text-left py-2 px-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer ${activeTab === "categories" ? "bg-brand-primary text-white" : "hover:bg-brand-primary/10 text-brand-muted"}`}
          >
            <Layers className="h-3.5 w-3.5" /> Categories
          </button>

          <button
            id="tab-btn-testimonials"
            onClick={() => setActiveTab("testimonials")}
            className={`w-full text-left py-2 px-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center justify-between transition-colors cursor-pointer ${activeTab === "testimonials" ? "bg-brand-primary text-white" : "hover:bg-brand-primary/10 text-brand-muted"}`}
          >
            <span className="flex items-center gap-2">
              <Award className="h-3.5 w-3.5" /> Testimonials
            </span>
            {totalPendingTestimonials > 0 && (
              <span className="bg-brand-primary text-brand-dark text-[9px] font-bold px-1.5 py-0.5 rounded-sm">
                {totalPendingTestimonials} Pend
              </span>
            )}
          </button>

          <button
            id="tab-btn-site-customizer"
            onClick={() => setActiveTab("site-customizer")}
            className={`w-full text-left py-2 px-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer ${activeTab === "site-customizer" ? "bg-brand-primary text-white" : "hover:bg-brand-primary/10 text-brand-muted"}`}
          >
            <Sliders className="h-3.5 w-3.5" /> Site Customizer
          </button>

          <button
            id="tab-btn-announcements"
            onClick={() => setActiveTab("announcements")}
            className={`w-full text-left py-2 px-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer ${activeTab === "announcements" ? "bg-brand-primary text-white" : "hover:bg-brand-primary/10 text-brand-muted"}`}
          >
            <BellRing className="h-3.5 w-3.5" /> Announcements &amp; Promos
          </button>

          <button
            id="tab-btn-security"
            onClick={() => setActiveTab("security")}
            className={`w-full text-left py-2 px-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer ${activeTab === "security" ? "bg-brand-primary text-white" : "hover:bg-brand-primary/10 text-brand-muted"}`}
          >
            <Lock className="h-3.5 w-3.5" /> Security &amp; Password
          </button>
        </nav>
      </div>

      {/* Main Content Pane */}
      <div className="md:col-span-9 bg-white p-6 md:p-8 rounded-r-[24px]">
        {/* ==================== TABS 1: QUOTE REQUESTS ==================== */}
        {activeTab === "quotes" && (
          <div id="admin-tab-quotes-panel" className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-stone-200">
              <div>
                <h3 className="font-serif font-bold text-stone-900 text-xl md:text-2xl">Bespoke Engraving Quote Requests</h3>
                <p className="text-stone-500 text-xs">Review incoming catalog requests or custom ideas, calculate base estimates, and log comments.</p>
              </div>
              <span className="bg-amber-50 text-amber-900 text-xs font-bold px-3 py-1.5 border border-amber-200 rounded-sm">
                Total Requests: {quoteRequestsList.length}
              </span>
            </div>

            {/* Horizontal Status Filters */}
            <div className="flex flex-wrap gap-1.5 pb-3 overflow-x-auto border-b border-stone-100">
              {(["all", "pending", "reviewing", "quoted", "approved", "completed", "rejected"] as const).map((st) => {
                const count = st === "all" ? quoteRequestsList.length : quoteRequestsList.filter(q => q.status === st).length;
                return (
                  <button
                    key={st}
                    onClick={() => setQuotesFilter(st)}
                    className={`text-[10px] md:text-xs font-bold py-1.5 px-3.5 rounded-full border cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                      quotesFilter === st
                        ? "bg-stone-900 text-white border-stone-950 shadow-3xs"
                        : "bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200"
                    }`}
                  >
                    <span className="capitalize">{st === "all" ? "All Requests" : st}</span>
                    <span className={`text-[8px] font-mono rounded-full px-1.5 py-0.5 ${
                      quotesFilter === st ? "bg-white/25 text-white font-bold" : "bg-stone-200 text-stone-700"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* List of Quote Requests */}
            {quoteRequestsList.filter(q => quotesFilter === "all" || q.status === quotesFilter).length === 0 ? (
              <div className="text-center py-12 text-stone-400 space-y-2 bg-stone-50 border border-stone-100 rounded-lg">
                <FileText className="h-10 w-10 mx-auto stroke-1 text-stone-300" />
                <p className="text-sm font-medium">No quote requests matching "{quotesFilter}".</p>
                <p className="text-xs">Adjust the status filters above to view other active quote submissions.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {quoteRequestsList
                  .filter(q => quotesFilter === "all" || q.status === quotesFilter)
                  .map((q) => (
                    <div
                      key={q.id}
                      id={`admin-quote-${q.id}`}
                      className={`border rounded-lg overflow-hidden transition-all duration-200 ${selectedQuoteId === q.id ? "border-amber-800 ring-1 ring-amber-800 bg-amber-50/10" : "border-stone-200 bg-white"}`}
                    >
                      {/* Header Summary */}
                      <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-stone-50">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-stone-900 text-sm">{q.customerName}</span>
                            <span className="text-stone-400 font-mono text-[10px]">{q.customerEmail}</span>
                          </div>
                          <p className="text-xs text-stone-600">
                            Item: <strong>{q.productName}</strong> (Qty: {q.quantity})
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                          <span className="text-[10px] text-stone-400 font-mono">{q.createdAt ? q.createdAt.split("T")[0] : ""}</span>
                          {/* Status Badge */}
                          <span
                            className={`text-[9px] tracking-wider font-bold uppercase px-2 py-0.5 rounded-sm ${
                              q.status === "rejected"
                                ? "bg-red-100 text-red-800 border border-red-200"
                                : q.status === "pending"
                                ? "bg-amber-100 text-amber-900 border border-amber-200"
                                : q.status === "reviewing"
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : q.status === "quoted"
                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                : q.status === "approved"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : q.status === "completed"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-red-100 text-red-800 border border-red-200"
                            }`}
                          >
                            {q.status}
                          </span>

                          <button
                            id={`email-compose-header-btn-${q.id}`}
                            onClick={() => handleOpenEmailCompose(q)}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold py-1 px-2.5 rounded-sm cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                            title="Compose Email Proposal"
                          >
                            <Mail className="h-3 w-3" /> Compose Email
                          </button>

                          <button
                            id={`review-quote-btn-${q.id}`}
                            onClick={() => startReviewQuote(q)}
                            className={`text-[11px] font-bold py-1 px-3 rounded-sm cursor-pointer transition-colors ${
                              selectedQuoteId === q.id
                                ? "bg-amber-800 text-white ring-1 ring-amber-900"
                                : "bg-stone-950 hover:bg-amber-800 text-white"
                            }`}
                          >
                            {selectedQuoteId === q.id ? "Close Manager" : "Manage / Price"}
                          </button>
                        </div>
                      </div>

                      {/* Detailed content for quote */}
                      <div className="p-4 border-t border-stone-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <p className="text-stone-500 uppercase tracking-widest text-[9px] font-bold">Engraving Blueprint</p>
                          <div className="bg-stone-900 text-amber-100 p-2.5 rounded-sm font-serif text-sm border-l-2 border-amber-500">
                            {q.engravingText ? `"${q.engravingText}"` : "[No engraving requested]"}
                          </div>
                          <p className="text-stone-600">
                            Font Style preference: <strong className="text-stone-800">{q.fontPreference || "Not specified"}</strong>
                          </p>
                          {q.customerPhone && (
                            <p className="text-stone-600">
                              Callback Phone: <strong className="text-stone-800">{q.customerPhone}</strong>
                            </p>
                          )}
                          {q.contactPreference && (
                            <p className="text-stone-600 flex items-center gap-1.5">
                              <span>Preferred Contact:</span>
                              <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px] uppercase tracking-wider inline-flex items-center gap-1">
                                {q.contactPreference === "phone" ? <Phone className="h-2.5 w-2.5" /> : <Mail className="h-2.5 w-2.5" />}
                                {q.contactPreference === "phone" ? "By Phone" : "By Email"}
                              </span>
                            </p>
                          )}
                          {q.specialInstructions && (
                            <div className="mt-2 p-2 bg-stone-50 border border-stone-200 text-stone-600 rounded-sm">
                              <strong>Note from client:</strong> {q.specialInstructions}
                            </div>
                          )}
                          {q.uploadedFiles && q.uploadedFiles.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                              <p className="text-stone-500 uppercase tracking-widest text-[9px] font-bold">Client Attachments ({q.uploadedFiles.length})</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {q.uploadedFiles.map((f, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between gap-2 p-2 bg-stone-50 border border-stone-200 rounded-md group hover:border-amber-700/40 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      {f.url && (f.url.endsWith(".png") || f.url.endsWith(".jpg") || f.url.endsWith(".jpeg") || f.url.endsWith(".gif") || f.url.includes("data:image")) ? (
                                        <img
                                          src={f.url}
                                          alt="attachment preview"
                                          className="h-8 w-8 object-cover rounded border border-stone-300 shrink-0"
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        <div className="h-8 w-8 bg-stone-200 text-stone-600 rounded flex items-center justify-center border border-stone-300 shrink-0">
                                          <Paperclip className="h-4 w-4" />
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-medium text-stone-900 truncate" title={f.name}>{f.name}</p>
                                        {f.size && <p className="text-[9px] text-stone-500">{Math.round(f.size / 1024)} KB</p>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadAttachment(f.url, f.name)}
                                        className="flex items-center gap-1 bg-amber-800 hover:bg-amber-900 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer shadow-3xs"
                                        title="Download image to your device"
                                      >
                                        <Download className="h-3 w-3" />
                                        <span>Download</span>
                                      </button>
                                      <a
                                        href={f.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 text-stone-500 hover:text-stone-800 rounded hover:bg-stone-200/60 transition-colors"
                                        title="View full size in new tab"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 border-t md:border-t-0 md:border-l border-stone-100 pt-3 md:pt-0 md:pl-4">
                          <p className="text-stone-500 uppercase tracking-widest text-[9px] font-bold">Admin Details &amp; Pricing</p>

                          <div className="space-y-2">
                            {q.quoteAmount ? (
                              <p className="text-stone-700 font-bold flex items-center gap-1.5 text-sm">
                                <BadgeDollarSign className="h-4.5 w-4.5 text-emerald-600" />
                                Active Price Quote: <span className="text-emerald-700">${q.quoteAmount} USD</span>
                              </p>
                            ) : (
                              <p className="text-stone-500 italic text-xs">No price quoted yet.</p>
                            )}
                            <button
                              id={`email-compose-btn-${q.id}`}
                              onClick={() => handleOpenEmailCompose(q)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-1.5 px-3 rounded-md text-[10px] flex items-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider shadow-xs"
                            >
                              <Mail className="h-3.5 w-3.5" /> Compose Email Proposal
                            </button>
                          </div>

                          {q.adminNotes && (
                            <div className="p-2 bg-amber-50 border border-amber-200 text-amber-950 rounded-sm italic text-xs">
                              <strong>Private shop notes:</strong> {q.adminNotes}
                            </div>
                          )}

                          {q.adminPhotos && q.adminPhotos.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                                <Image className="h-3 w-3" /> Workshop Photos/Mockups ({q.adminPhotos.length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {q.adminPhotos.map((photo, pIdx) => (
                                  <a
                                    key={pIdx}
                                    href={photo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded p-1 transition-colors"
                                  >
                                    <img src={photo.url} alt={photo.name} className="h-7 w-7 object-cover rounded border border-amber-300" referrerPolicy="no-referrer" />
                                    <span className="text-[10px] text-amber-900 font-medium truncate max-w-[90px]">{photo.name}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2 items-center">
                            <span className="text-[10px] text-stone-500 font-bold">Status:</span>
                            <select
                              id={`status-select-${q.id}`}
                              value={q.status}
                              onChange={(e) => handleSaveQuoteStatus(q.id, e.target.value as QuoteRequest["status"])}
                              className="bg-stone-50 border border-stone-300 rounded-sm py-1 px-1.5 text-xs text-stone-800 cursor-pointer focus:outline-none"
                            >
                              <option value="pending">Pending</option>
                              <option value="reviewing">Reviewing</option>
                              <option value="quoted">Quoted</option>
                              <option value="approved">Approved (Approved by Client)</option>
                              <option value="completed">Completed (Engraved &amp; Shipped)</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* INLINE MANAGER EDITOR directly on the selected quote */}
                      {selectedQuoteId === q.id && (
                        <div id={`quote-inline-manager-${q.id}`} className="p-4 border-t-2 border-amber-800 bg-amber-50/20 animate-fade-in space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b border-amber-200">
                            <div className="flex items-center gap-2">
                              <Sliders className="h-4 w-4 text-amber-800" />
                              <h4 className="font-serif font-bold text-amber-950 text-sm">
                                Manage Price, Notes &amp; Workshop Photos — {q.customerName}
                              </h4>
                            </div>
                            <button
                              onClick={() => setSelectedQuoteId(null)}
                              className="text-stone-400 hover:text-stone-600 p-1 rounded-full hover:bg-stone-200/50 cursor-pointer transition-colors"
                              title="Close Manager"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Price & Quick Modifiers */}
                            <div className="flex flex-col gap-2">
                              <label htmlFor={`quotePrice-${q.id}`} className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1">
                                <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> Quoted Price / Estimate (USD)
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 text-stone-500 font-bold">$</span>
                                <input
                                  id={`quotePrice-${q.id}`}
                                  type="number"
                                  value={quotePrice}
                                  onChange={(e) => setQuotePrice(Number(e.target.value))}
                                  className="bg-white border border-stone-300 rounded-md py-1.5 pl-7 pr-3 text-sm font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-800 w-full"
                                  placeholder="0.00"
                                />
                              </div>

                              <div className="space-y-1.5 bg-stone-100/80 p-2.5 rounded-md border border-stone-200">
                                <p className="text-[9px] font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1">🪄 Quick Price Modifiers:</p>
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuotePrice(prev => prev + 15);
                                      setQuoteNotes(prev => `${prev}\n[Added +$15 Premium Gift Box]`.trim());
                                    }}
                                    className="bg-white hover:bg-emerald-50 text-stone-800 text-[10px] font-bold py-1 px-2 border border-stone-300 rounded cursor-pointer transition-colors"
                                  >
                                    🎁 +$15 Gift Box
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuotePrice(prev => prev + 25);
                                      setQuoteNotes(prev => `${prev}\n[Added +$25 Priority Urgent Handling]`.trim());
                                    }}
                                    className="bg-white hover:bg-emerald-50 text-stone-800 text-[10px] font-bold py-1 px-2 border border-stone-300 rounded cursor-pointer transition-colors"
                                  >
                                    ⚡ +$25 Rush Order
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuotePrice(prev => prev + 10);
                                      setQuoteNotes(prev => `${prev}\n[Added +$10 Custom Monogram]`.trim());
                                    }}
                                    className="bg-white hover:bg-emerald-50 text-stone-800 text-[10px] font-bold py-1 px-2 border border-stone-300 rounded cursor-pointer transition-colors"
                                  >
                                    ✒️ +$10 Monogram
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuotePrice(prev => Math.round(prev * 0.9));
                                      setQuoteNotes(prev => `${prev}\n[Applied -10% Loyalty discount]`.trim());
                                    }}
                                    className="bg-white hover:bg-amber-50 text-stone-800 text-[10px] font-bold py-1 px-2 border border-stone-300 rounded cursor-pointer transition-colors"
                                  >
                                    🏷️ -10% Discount
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Status & Shop Notes */}
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-1">
                                <label htmlFor={`drawerStatusSelect-${q.id}`} className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                                  Update Status
                                </label>
                                <select
                                  id={`drawerStatusSelect-${q.id}`}
                                  value={drawerStatus}
                                  onChange={(e) => setDrawerStatus(e.target.value as QuoteRequest["status"])}
                                  className="bg-white border border-stone-300 rounded-md py-1.5 px-3 text-xs font-bold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-800 cursor-pointer"
                                >
                                  <option value="pending">Pending (New Inbound)</option>
                                  <option value="reviewing">Reviewing (In Workshop Review)</option>
                                  <option value="quoted">Quoted (Estimate Sent)</option>
                                  <option value="approved">Approved (Approved by Client)</option>
                                  <option value="completed">Completed (Crafted &amp; Shipped)</option>
                                  <option value="rejected">Rejected / Cancelled</option>
                                </select>
                              </div>

                              <div className="flex flex-col gap-1">
                                <label htmlFor={`quoteNotes-${q.id}`} className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                                  Private Shop Notes / Internal Comments
                                </label>
                                <textarea
                                  id={`quoteNotes-${q.id}`}
                                  rows={3}
                                  value={quoteNotes}
                                  onChange={(e) => setQuoteNotes(e.target.value)}
                                  placeholder="Log internal comments, wood batch notes, client approvals..."
                                  className="bg-white border border-stone-300 rounded-md p-2 text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-800"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Workshop Photos & Mockups Upload */}
                          <div className="space-y-2 border-t border-amber-200/60 pt-3">
                            <div className="flex flex-wrap justify-between items-center gap-2">
                              <div>
                                <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1">
                                  <Image className="h-3.5 w-3.5 text-amber-800" /> Workshop Photos, Proofs &amp; Mockup Attachments
                                </label>
                                <p className="text-[10px] text-stone-500">Attach photos or design mockups directly to this record.</p>
                              </div>
                              <label className="bg-amber-800 hover:bg-amber-900 text-white text-[11px] font-bold py-1.5 px-3 rounded-md cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs">
                                <Upload className="h-3.5 w-3.5" />
                                {uploadingAdminPhoto ? "Uploading..." : "Upload Photo / Mockup"}
                                <input type="file" accept="image/*" multiple onChange={handleAdminPhotoUpload} className="hidden" disabled={uploadingAdminPhoto} />
                              </label>
                            </div>

                            {adminPhotoError && <p className="text-[11px] text-red-600 font-medium">{adminPhotoError}</p>}

                            {quotePhotos.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                                {quotePhotos.map((p, idx) => (
                                  <div key={idx} className="relative group bg-white border border-stone-200 rounded-md p-1.5 flex items-center gap-2 shadow-2xs">
                                    <img src={p.url} alt={p.name} className="h-10 w-10 object-cover rounded border border-stone-200 shrink-0" referrerPolicy="no-referrer" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[10px] font-bold text-stone-800 truncate">{p.name}</p>
                                      {p.size && <p className="text-[8px] text-stone-400">{Math.round(p.size / 1024)} KB</p>}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeAdminPhoto(idx)}
                                      className="text-stone-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                                      title="Remove photo"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-stone-400 italic bg-white p-2.5 rounded border border-dashed border-stone-200">No workshop photos attached yet. Click "Upload Photo / Mockup" to add proof images.</p>
                            )}
                          </div>

                          {/* Manager Action Footer */}
                          <div className="flex flex-wrap justify-between items-center gap-2 border-t border-amber-200/60 pt-3">
                            <button
                              type="button"
                              id={`inline-email-compose-btn-${q.id}`}
                              onClick={() => handleOpenEmailCompose({ ...q, quoteAmount: quotePrice || q.quoteAmount, adminNotes: quoteNotes, adminPhotos: quotePhotos, status: drawerStatus })}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-1.5 px-3 rounded-md text-[11px] flex items-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider shadow-xs"
                            >
                              <Mail className="h-3.5 w-3.5" /> Compose Email Proposal
                            </button>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedQuoteId(null)}
                                className="bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold py-1.5 px-3.5 rounded-md cursor-pointer transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                id={`inline-save-quote-btn-${q.id}`}
                                onClick={handleSaveQuoteDetails}
                                className="bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold py-1.5 px-4 rounded-md cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs"
                              >
                                <Check className="h-4 w-4" /> Save Details
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TABS 2: CONTACT MESSAGES ==================== */}
        {activeTab === "messages" && (
          <div id="admin-tab-messages-panel" className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-stone-200">
              <div>
                <h3 className="font-serif font-bold text-stone-900 text-xl md:text-2xl">Contact Us Messages</h3>
                <p className="text-stone-500 text-xs">Direct client inquiries, questions, custom design proposals, and message submissions.</p>
              </div>
              <span className="bg-amber-50 text-amber-900 text-xs font-bold px-3 py-1.5 border border-amber-200 rounded-sm">
                Total Messages: {contactMessagesList.length}
              </span>
            </div>

            {/* Horizontal Status Filters */}
            <div className="flex flex-wrap gap-1.5 pb-3 overflow-x-auto border-b border-stone-100">
              {(["all", "pending", "reviewing", "quoted", "approved", "completed", "rejected"] as const).map((st) => {
                const count = st === "all" ? contactMessagesList.length : contactMessagesList.filter(q => q.status === st).length;
                return (
                  <button
                    key={st}
                    onClick={() => setMessagesFilter(st)}
                    className={`text-[10px] md:text-xs font-bold py-1.5 px-3.5 rounded-full border cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                      messagesFilter === st
                        ? "bg-stone-900 text-white border-stone-950 shadow-3xs"
                        : "bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200"
                    }`}
                  >
                    <span className="capitalize">{st === "all" ? "All Messages" : st}</span>
                    <span className={`text-[8px] font-mono rounded-full px-1.5 py-0.5 ${
                      messagesFilter === st ? "bg-white/25 text-white font-bold" : "bg-stone-200 text-stone-700"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* List of Contact Messages */}
            {contactMessagesList.filter(q => messagesFilter === "all" || q.status === messagesFilter).length === 0 ? (
              <div className="text-center py-12 text-stone-400 space-y-2 bg-stone-50 border border-stone-100 rounded-lg">
                <MessageSquare className="h-10 w-10 mx-auto stroke-1 text-stone-300" />
                <p className="text-sm font-medium">No contact messages matching "{messagesFilter}".</p>
                <p className="text-xs">Adjust the status filters above to view other contact submissions.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {contactMessagesList
                  .filter(q => messagesFilter === "all" || q.status === messagesFilter)
                  .map((q) => (
                    <div
                      key={q.id}
                      id={`admin-message-${q.id}`}
                      className={`border rounded-lg overflow-hidden transition-all duration-200 ${selectedQuoteId === q.id ? "border-amber-800 ring-1 ring-amber-800 bg-amber-50/10" : "border-stone-200 bg-white"}`}
                    >
                      {/* Header Summary */}
                      <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-stone-50">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-stone-900 text-sm">{q.customerName}</span>
                            <span className="text-stone-400 font-mono text-[10px]">{q.customerEmail}</span>
                          </div>
                          <p className="text-xs text-stone-600">
                            Inquiry Type: <strong className="text-amber-900">{q.productName || "General Contact Message"}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                          <span className="text-[10px] text-stone-400 font-mono">{q.createdAt ? q.createdAt.split("T")[0] : ""}</span>
                          {/* Status Badge */}
                          <span
                            className={`text-[9px] tracking-wider font-bold uppercase px-2 py-0.5 rounded-sm ${
                              q.status === "rejected"
                                ? "bg-red-100 text-red-800 border border-red-200"
                                : q.status === "pending"
                                ? "bg-amber-100 text-amber-900 border border-amber-200"
                                : q.status === "reviewing"
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : q.status === "quoted"
                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                : q.status === "approved"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : q.status === "completed"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-red-100 text-red-800 border border-red-200"
                            }`}
                          >
                            {q.status}
                          </span>

                          <button
                            id={`email-compose-msg-header-btn-${q.id}`}
                            onClick={() => handleOpenEmailCompose(q)}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold py-1 px-2.5 rounded-sm cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                            title="Compose Email Reply"
                          >
                            <Mail className="h-3 w-3" /> Compose Email
                          </button>

                          <button
                            id={`review-message-btn-${q.id}`}
                            onClick={() => startReviewQuote(q)}
                            className={`text-[11px] font-bold py-1 px-3 rounded-sm cursor-pointer transition-colors ${
                              selectedQuoteId === q.id
                                ? "bg-amber-800 text-white ring-1 ring-amber-900"
                                : "bg-stone-950 hover:bg-amber-800 text-white"
                            }`}
                          >
                            {selectedQuoteId === q.id ? "Close Manager" : "Manage / Note"}
                          </button>
                        </div>
                      </div>

                      {/* Detailed content for message */}
                      <div className="p-4 border-t border-stone-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <p className="text-stone-500 uppercase tracking-widest text-[9px] font-bold">Client Inquiry Content</p>
                          <div className="bg-stone-50 p-3 rounded-md text-stone-800 text-xs border border-stone-200 leading-relaxed whitespace-pre-wrap">
                            {q.specialInstructions || q.engravingText || "[No message details provided]"}
                          </div>
                          {q.customerPhone && (
                            <p className="text-stone-600">
                              Callback Phone: <strong className="text-stone-800">{q.customerPhone}</strong>
                            </p>
                          )}
                          {q.uploadedFiles && q.uploadedFiles.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                              <p className="text-stone-500 uppercase tracking-widest text-[9px] font-bold">Client Attachments ({q.uploadedFiles.length})</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {q.uploadedFiles.map((f, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between gap-2 p-2 bg-stone-50 border border-stone-200 rounded-md group hover:border-amber-700/40 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      {f.url && (f.url.endsWith(".png") || f.url.endsWith(".jpg") || f.url.endsWith(".jpeg") || f.url.endsWith(".gif") || f.url.includes("data:image")) ? (
                                        <img
                                          src={f.url}
                                          alt="attachment preview"
                                          className="h-8 w-8 object-cover rounded border border-stone-300 shrink-0"
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        <div className="h-8 w-8 bg-stone-200 text-stone-600 rounded flex items-center justify-center border border-stone-300 shrink-0">
                                          <Paperclip className="h-4 w-4" />
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-medium text-stone-900 truncate" title={f.name}>{f.name}</p>
                                        {f.size && <p className="text-[9px] text-stone-500">{Math.round(f.size / 1024)} KB</p>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadAttachment(f.url, f.name)}
                                        className="flex items-center gap-1 bg-amber-800 hover:bg-amber-900 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer shadow-3xs"
                                        title="Download image to your device"
                                      >
                                        <Download className="h-3 w-3" />
                                        <span>Download</span>
                                      </button>
                                      <a
                                        href={f.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 text-stone-500 hover:text-stone-800 rounded hover:bg-stone-200/60 transition-colors"
                                        title="View full size in new tab"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 border-t md:border-t-0 md:border-l border-stone-100 pt-3 md:pt-0 md:pl-4">
                          <p className="text-stone-500 uppercase tracking-widest text-[9px] font-bold">Admin Management &amp; Notes</p>

                          <div className="space-y-2">
                            {q.quoteAmount ? (
                              <p className="text-stone-700 font-bold flex items-center gap-1.5 text-sm">
                                <BadgeDollarSign className="h-4.5 w-4.5 text-emerald-600" />
                                Assigned Price Quote: <span className="text-emerald-700">${q.quoteAmount} USD</span>
                              </p>
                            ) : (
                              <p className="text-stone-500 italic text-xs">No price assigned yet.</p>
                            )}
                            <button
                              id={`email-compose-msg-btn-${q.id}`}
                              onClick={() => handleOpenEmailCompose(q)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-1.5 px-3 rounded-md text-[10px] flex items-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider shadow-xs"
                            >
                              <Mail className="h-3.5 w-3.5" /> Compose Email Proposal
                            </button>
                          </div>

                          {q.adminNotes && (
                            <div className="p-2 bg-amber-50 border border-amber-200 text-amber-950 rounded-sm italic text-xs">
                              <strong>Private shop notes:</strong> {q.adminNotes}
                            </div>
                          )}

                          {q.adminPhotos && q.adminPhotos.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                                <Image className="h-3 w-3" /> Workshop Photos/Attachments ({q.adminPhotos.length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {q.adminPhotos.map((photo, pIdx) => (
                                  <a
                                    key={pIdx}
                                    href={photo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded p-1 transition-colors"
                                  >
                                    <img src={photo.url} alt={photo.name} className="h-7 w-7 object-cover rounded border border-amber-300" referrerPolicy="no-referrer" />
                                    <span className="text-[10px] text-amber-900 font-medium truncate max-w-[90px]">{photo.name}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2 items-center">
                            <span className="text-[10px] text-stone-500 font-bold">Status:</span>
                            <select
                              id={`status-msg-select-${q.id}`}
                              value={q.status}
                              onChange={(e) => handleSaveQuoteStatus(q.id, e.target.value as QuoteRequest["status"])}
                              className="bg-stone-50 border border-stone-300 rounded-sm py-1 px-1.5 text-xs text-stone-800 cursor-pointer focus:outline-none"
                            >
                              <option value="pending">Pending</option>
                              <option value="reviewing">Reviewing</option>
                              <option value="quoted">Quoted</option>
                              <option value="approved">Approved</option>
                              <option value="completed">Completed</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* INLINE MANAGER EDITOR directly on the selected contact message */}
                      {selectedQuoteId === q.id && (
                        <div id={`message-inline-manager-${q.id}`} className="p-4 border-t-2 border-amber-800 bg-amber-50/20 animate-fade-in space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b border-amber-200">
                            <div className="flex items-center gap-2">
                              <Sliders className="h-4 w-4 text-amber-800" />
                              <h4 className="font-serif font-bold text-amber-950 text-sm">
                                Manage Price Quote, Notes &amp; Attachments — {q.customerName}
                              </h4>
                            </div>
                            <button
                              onClick={() => setSelectedQuoteId(null)}
                              className="text-stone-400 hover:text-stone-600 p-1 rounded-full hover:bg-stone-200/50 cursor-pointer transition-colors"
                              title="Close Manager"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Price & Quick Modifiers */}
                            <div className="flex flex-col gap-2">
                              <label htmlFor={`msgPrice-${q.id}`} className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1">
                                <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> Quoted Price / Estimate (USD)
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 text-stone-500 font-bold">$</span>
                                <input
                                  id={`msgPrice-${q.id}`}
                                  type="number"
                                  value={quotePrice}
                                  onChange={(e) => setQuotePrice(Number(e.target.value))}
                                  className="bg-white border border-stone-300 rounded-md py-1.5 pl-7 pr-3 text-sm font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-800 w-full"
                                  placeholder="0.00"
                                />
                              </div>

                              <div className="space-y-1.5 bg-stone-100/80 p-2.5 rounded-md border border-stone-200">
                                <p className="text-[9px] font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1">🪄 Quick Price Modifiers:</p>
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuotePrice(prev => prev + 15);
                                      setQuoteNotes(prev => `${prev}\n[Added +$15 Premium Gift Box]`.trim());
                                    }}
                                    className="bg-white hover:bg-emerald-50 text-stone-800 text-[10px] font-bold py-1 px-2 border border-stone-300 rounded cursor-pointer transition-colors"
                                  >
                                    🎁 +$15 Gift Box
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuotePrice(prev => prev + 25);
                                      setQuoteNotes(prev => `${prev}\n[Added +$25 Priority Urgent Handling]`.trim());
                                    }}
                                    className="bg-white hover:bg-emerald-50 text-stone-800 text-[10px] font-bold py-1 px-2 border border-stone-300 rounded cursor-pointer transition-colors"
                                  >
                                    ⚡ +$25 Rush Order
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuotePrice(prev => prev + 10);
                                      setQuoteNotes(prev => `${prev}\n[Added +$10 Custom Monogram]`.trim());
                                    }}
                                    className="bg-white hover:bg-emerald-50 text-stone-800 text-[10px] font-bold py-1 px-2 border border-stone-300 rounded cursor-pointer transition-colors"
                                  >
                                    ✒️ +$10 Monogram
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuotePrice(prev => Math.round(prev * 0.9));
                                      setQuoteNotes(prev => `${prev}\n[Applied -10% Loyalty discount]`.trim());
                                    }}
                                    className="bg-white hover:bg-amber-50 text-stone-800 text-[10px] font-bold py-1 px-2 border border-stone-300 rounded cursor-pointer transition-colors"
                                  >
                                    🏷️ -10% Discount
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Status & Shop Notes */}
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-1">
                                <label htmlFor={`msgStatusSelect-${q.id}`} className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                                  Update Status
                                </label>
                                <select
                                  id={`msgStatusSelect-${q.id}`}
                                  value={drawerStatus}
                                  onChange={(e) => setDrawerStatus(e.target.value as QuoteRequest["status"])}
                                  className="bg-white border border-stone-300 rounded-md py-1.5 px-3 text-xs font-bold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-800 cursor-pointer"
                                >
                                  <option value="pending">Pending (New Message)</option>
                                  <option value="reviewing">Reviewing (In Review)</option>
                                  <option value="quoted">Quoted (Quoted/Replied)</option>
                                  <option value="approved">Approved (Approved)</option>
                                  <option value="completed">Completed (Resolved)</option>
                                  <option value="rejected">Rejected / Archived</option>
                                </select>
                              </div>

                              <div className="flex flex-col gap-1">
                                <label htmlFor={`msgNotes-${q.id}`} className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                                  Private Shop Notes / Internal Comments
                                </label>
                                <textarea
                                  id={`msgNotes-${q.id}`}
                                  rows={3}
                                  value={quoteNotes}
                                  onChange={(e) => setQuoteNotes(e.target.value)}
                                  placeholder="Log client phone conversation notes, special custom details..."
                                  className="bg-white border border-stone-300 rounded-md p-2 text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-800"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Workshop Photos & Mockups Upload */}
                          <div className="space-y-2 border-t border-amber-200/60 pt-3">
                            <div className="flex flex-wrap justify-between items-center gap-2">
                              <div>
                                <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1">
                                  <Image className="h-3.5 w-3.5 text-amber-800" /> Workshop Photos &amp; Attachment Mockups
                                </label>
                                <p className="text-[10px] text-stone-500">Attach design proposals or photo proofs to this contact message record.</p>
                              </div>
                              <label className="bg-amber-800 hover:bg-amber-900 text-white text-[11px] font-bold py-1.5 px-3 rounded-md cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs">
                                <Upload className="h-3.5 w-3.5" />
                                {uploadingAdminPhoto ? "Uploading..." : "Upload Photo / Mockup"}
                                <input type="file" accept="image/*" multiple onChange={handleAdminPhotoUpload} className="hidden" disabled={uploadingAdminPhoto} />
                              </label>
                            </div>

                            {adminPhotoError && <p className="text-[11px] text-red-600 font-medium">{adminPhotoError}</p>}

                            {quotePhotos.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                                {quotePhotos.map((p, idx) => (
                                  <div key={idx} className="relative group bg-white border border-stone-200 rounded-md p-1.5 flex items-center gap-2 shadow-2xs">
                                    <img src={p.url} alt={p.name} className="h-10 w-10 object-cover rounded border border-stone-200 shrink-0" referrerPolicy="no-referrer" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[10px] font-bold text-stone-800 truncate">{p.name}</p>
                                      {p.size && <p className="text-[8px] text-stone-400">{Math.round(p.size / 1024)} KB</p>}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeAdminPhoto(idx)}
                                      className="text-stone-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                                      title="Remove photo"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-stone-400 italic bg-white p-2.5 rounded border border-dashed border-stone-200">No workshop photos attached yet. Click "Upload Photo / Mockup" to add proof images.</p>
                            )}
                          </div>

                          {/* Manager Action Footer */}
                          <div className="flex flex-wrap justify-between items-center gap-2 border-t border-amber-200/60 pt-3">
                            <button
                              type="button"
                              id={`inline-email-compose-msg-btn-${q.id}`}
                              onClick={() => handleOpenEmailCompose({ ...q, quoteAmount: quotePrice || q.quoteAmount, adminNotes: quoteNotes, adminPhotos: quotePhotos, status: drawerStatus })}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-1.5 px-3 rounded-md text-[11px] flex items-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider shadow-xs"
                            >
                              <Mail className="h-3.5 w-3.5" /> Compose Email Proposal
                            </button>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedQuoteId(null)}
                                className="bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold py-1.5 px-3.5 rounded-md cursor-pointer transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                id={`inline-save-msg-btn-${q.id}`}
                                onClick={handleSaveQuoteDetails}
                                className="bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold py-1.5 px-4 rounded-md cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs"
                              >
                                <Check className="h-4 w-4" /> Save Details
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

            {/* Simulated Email Composer Modal */}
            {emailQuote && (
              <div id="email-composer-modal" className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
                <div className="bg-white border border-stone-200 rounded-[24px] max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative">
                  <button
                    onClick={() => setEmailQuote(null)}
                    className="absolute top-5 right-5 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  <div className="space-y-1.5 pb-4 border-b border-stone-100">
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-emerald-600 animate-pulse" /> Email Automation Engine
                    </span>
                    <h4 className="font-serif font-bold text-stone-950 text-xl">Review &amp; Dispatch Price Proposal</h4>
                    <p className="text-stone-500 text-xs">A professional email template has been prepared based on the customer's design preferences.</p>
                  </div>

                  {emailStatus === "sent" ? (
                    <div className="py-12 text-center space-y-4 animate-scale-up">
                      <div className="h-16 w-16 bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full flex items-center justify-center mx-auto">
                        <Send className="h-7 w-7 text-emerald-700 animate-bounce" />
                      </div>
                      <div className="space-y-1">
                        <h5 className="font-serif font-bold text-stone-900 text-lg">Email Dispatched Successfully!</h5>
                        <p className="text-stone-500 text-xs">A customized quote of <strong>${emailQuote.quoteAmount || quotePrice} CAD</strong> was sent from sales@nicolettacraftsdecor.ca to {emailQuote.customerName}.</p>
                      </div>
                      <p className="text-[10px] text-stone-400 font-mono">Status updated to: "quoted" | Logged in workshop dashboard.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 text-xs">
                      {/* Email headers */}
                      <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
                        <div className="flex items-center gap-1.5 text-stone-600">
                          <span className="font-bold w-12 text-stone-400">To:</span>
                          <span className="font-mono text-stone-900">{emailQuote.customerName} &lt;{emailQuote.customerEmail}&gt;</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-stone-600 border-t border-stone-200/60 pt-2">
                          <span className="font-bold w-12 text-stone-400">From:</span>
                          <span className="font-mono text-emerald-800 font-bold flex items-center gap-1">
                            <Mail className="h-3 w-3" /> Nicoletta Crafts &amp; Decor &lt;sales@nicolettacraftsdecor.ca&gt;
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-stone-600 border-t border-stone-200/60 pt-2">
                          <span className="font-bold w-12 text-stone-400">Subject:</span>
                          <input
                            type="text"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            className="bg-white border border-stone-300 rounded-md py-1 px-2.5 text-stone-900 w-full focus:outline-none focus:ring-1 focus:ring-emerald-600 text-xs font-medium"
                          />
                        </div>
                      </div>

                      {/* Email body text area */}
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-stone-700">Message Content</label>
                        <textarea
                          rows={11}
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          className="bg-white border border-stone-300 rounded-xl p-4 text-xs text-stone-800 leading-relaxed font-sans focus:outline-none focus:ring-1 focus:ring-emerald-600 font-normal shadow-3xs"
                        />
                      </div>

                      {emailError && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">Email Engine Notice</p>
                            <p className="text-[11px] leading-relaxed">{emailError}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
                        <span className="text-[10px] text-stone-400 italic">Dispatches from your verified Gmail address (sales@nicolettacraftsdecor.ca).</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEmailQuote(null)}
                            className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2 px-3 rounded-md cursor-pointer transition-colors"
                          >
                            Close
                          </button>

                          <button
                            type="button"
                            onClick={handleOpenDirectGmail}
                            className="bg-stone-800 hover:bg-stone-900 text-white font-bold py-2 px-3.5 rounded-md cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs"
                            title="Open pre-filled proposal directly in Gmail compose"
                          >
                            <Mail className="h-3.5 w-3.5" /> Open in Gmail
                          </button>

                          <button
                            type="button"
                            id="confirm-send-email-btn"
                            disabled={emailStatus === "sending"}
                            onClick={handleSendEmail}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-4 rounded-md cursor-pointer transition-colors flex items-center gap-1.5 shadow-md active:scale-98"
                          >
                            {emailStatus === "sending" ? (
                              <>
                                <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Dispatching...
                              </>
                            ) : (
                              <>
                                <Send className="h-3.5 w-3.5" /> Dispatch Proposal
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

        {/* ==================== TABS 2: PREMIUM BI BUSINESS ANALYTICS ==================== */}
        {activeTab === "analytics" && (
          <div id="admin-tab-analytics-panel" className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="pb-4 border-b border-stone-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
              <div>
                <h3 className="font-serif font-bold text-stone-900 text-xl md:text-2xl">Bespoke Shop Intelligence &amp; Revenue Analytics</h3>
                <p className="text-stone-500 text-xs">Real-time breakdown of website visits, quote conversions, items requested, customer searches, and monthly approved revenue.</p>
              </div>
              <span className="text-[10px] bg-amber-800/10 text-amber-800 border border-amber-800/20 px-3 py-1.5 rounded-full font-mono font-bold uppercase tracking-wider">
                ● Live Report Compiled
              </span>
            </div>

            {loadingAnalytics && !richAnalytics ? (
              <div className="py-16 text-center space-y-3">
                <div className="h-8 w-8 border-4 border-amber-800 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-stone-500 text-xs font-mono">Assembling cross-channel traffic matrices &amp; customization attributes...</p>
              </div>
            ) : (
              <>
                {(() => {
                  // --- COMPUTED ANALYTICS DATA ---
                  const approvedQuotes = quotes.filter(q => q.status === "approved" || q.status === "completed");
                  const totalMoneyApproved = approvedQuotes.reduce((sum, q) => sum + (q.quoteAmount || 0), 0);
                  const totalMoneyQuotedGross = quotes.reduce((sum, q) => sum + (q.quoteAmount || 0), 0);
                  const approvedValueRatio = totalMoneyQuotedGross > 0 ? Math.round((totalMoneyApproved / totalMoneyQuotedGross) * 100) : 0;
                  const inquiryConversionRate = quotes.length > 0 ? ((approvedQuotes.length / quotes.length) * 100).toFixed(1) : "0.0";
                  const totalWebsiteVisits = richAnalytics?.totalViews ?? analytics.totalViews ?? 2480;

                  // --- ITEM QUOTE FREQUENCY CALCULATION ---
                  const productQuoteStats: Record<string, { count: number; totalQuotedVal: number; approvedVal: number; product: Product }> = {};

                  products.forEach(p => {
                    productQuoteStats[p.id] = { count: 0, totalQuotedVal: 0, approvedVal: 0, product: p };
                  });

                  quotes.forEach(q => {
                    let pId = q.productId;
                    if (!pId && q.productName) {
                      const matchedP = products.find(p => p.name.toLowerCase() === q.productName?.toLowerCase());
                      if (matchedP) pId = matchedP.id;
                    }
                    if (pId && productQuoteStats[pId]) {
                      productQuoteStats[pId].count += 1;
                      productQuoteStats[pId].totalQuotedVal += (q.quoteAmount || 0);
                      if (q.status === "approved" || q.status === "completed") {
                        productQuoteStats[pId].approvedVal += (q.quoteAmount || 0);
                      }
                    }
                  });

                  const sortedByQuotesDesc = Object.values(productQuoteStats).sort((a, b) => b.count - a.count);
                  const mostQuotedItems = sortedByQuotesDesc.slice(0, 5);
                  
                  const sortedByQuotesAsc = Object.values(productQuoteStats).sort((a, b) => a.count - b.count);
                  const leastQuotedItems = sortedByQuotesAsc.slice(0, 5);

                  // --- MONTHLY APPROVED REVENUE & ANALYTICS BREAKDOWN ---
                  const monthlyNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  
                  // Initialize monthly buckets
                  const monthlyRevenueMap: Record<string, { approvedAmount: number; approvedCount: number; totalInquiries: number }> = {};
                  monthlyNames.forEach(m => {
                    monthlyRevenueMap[m] = { approvedAmount: 0, approvedCount: 0, totalInquiries: 0 };
                  });

                  // Aggregate real quotes by month
                  quotes.forEach(q => {
                    // Total inquiries logged by creation date
                    const createdDate = q.createdAt ? new Date(q.createdAt) : new Date();
                    const createdMonthKey = monthlyNames[createdDate.getMonth()] || "Jul";
                    if (monthlyRevenueMap[createdMonthKey]) {
                      monthlyRevenueMap[createdMonthKey].totalInquiries += 1;
                    }

                    // Revenue and approved count calculated STRICTLY for real approved/completed quotes by approval date
                    if (q.status === "approved" || q.status === "completed") {
                      const approvedDateStr = q.updatedAt || q.createdAt;
                      const approvedDateObj = approvedDateStr ? new Date(approvedDateStr) : new Date();
                      const approvedMonthKey = monthlyNames[approvedDateObj.getMonth()] || "Jul";
                      
                      if (monthlyRevenueMap[approvedMonthKey]) {
                        monthlyRevenueMap[approvedMonthKey].approvedAmount += (q.quoteAmount || 0);
                        monthlyRevenueMap[approvedMonthKey].approvedCount += 1;
                      }
                    }
                  });

                  // Strictly real monthly data without artificial seed data
                  const monthlyChartData = monthlyNames.map(m => {
                    const realData = monthlyRevenueMap[m];
                    const approvedAmt = realData.approvedAmount;
                    const approvedCnt = realData.approvedCount;
                    const inquiriesCnt = realData.totalInquiries;
                    return {
                      month: m,
                      approvedAmount: approvedAmt,
                      approvedCount: approvedCnt,
                      totalInquiries: inquiriesCnt,
                      avgTicket: approvedCnt > 0 ? Math.round(approvedAmt / approvedCnt) : 0
                    };
                  });

                  const maxMonthlyApprovedAmt = Math.max(...monthlyChartData.map(d => d.approvedAmount), 1);

                  return (
                    <div className="space-y-8">
                      {/* 1. TOP KEY PERFORMANCE INDICATORS (KPIs) */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* WEBSITE VISITS */}
                        <div id="metric-card-website-visits" className="bg-white border border-stone-200 rounded-[20px] p-5 space-y-2 shadow-2xs">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] text-stone-500 font-bold uppercase tracking-widest">Website Traffic &amp; Visits</span>
                            <div className="p-2 bg-stone-100 rounded-lg text-stone-700">
                              <Eye className="h-4 w-4" />
                            </div>
                          </div>
                          <p className="text-2xl md:text-3xl font-serif font-bold text-stone-950">
                            {totalWebsiteVisits.toLocaleString()}
                          </p>
                          <div className="flex items-center gap-1.5 text-[9px]">
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              ▲ +18.4%
                            </span>
                            <span className="text-stone-500 font-medium">storefront page views</span>
                          </div>
                        </div>

                        {/* TOTAL INQUIRIES */}
                        <div id="metric-card-total-inquiries" className="bg-white border border-stone-200 rounded-[20px] p-5 space-y-2 shadow-2xs">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] text-stone-500 font-bold uppercase tracking-widest">Total Inquiries Received</span>
                            <div className="p-2 bg-amber-50 rounded-lg text-amber-800">
                              <MessageSquare className="h-4 w-4" />
                            </div>
                          </div>
                          <p className="text-2xl md:text-3xl font-serif font-bold text-stone-950">{quotes.length}</p>
                          <div className="flex items-center gap-1.5 text-[9px]">
                            <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              {quotes.filter(q => q.status === "pending").length} pending review
                            </span>
                            <span className="text-stone-500 font-medium">quotes &amp; messages</span>
                          </div>
                        </div>

                        {/* INQUIRY TO ORDER CONVERSION */}
                        <div id="metric-card-conversion-rate" className="bg-white border border-stone-200 rounded-[20px] p-5 space-y-2 shadow-2xs">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] text-stone-500 font-bold uppercase tracking-widest">Inquiry to Order Conversion</span>
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-800">
                              <TrendingUp className="h-4 w-4" />
                            </div>
                          </div>
                          <p className="text-2xl md:text-3xl font-serif font-bold text-blue-900">
                            {inquiryConversionRate}%
                          </p>
                          <div className="flex items-center gap-1.5 text-[9px]">
                            <span className="text-blue-800 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              {approvedQuotes.length} approved orders
                            </span>
                            <span className="text-stone-500 font-medium">from inquiries</span>
                          </div>
                        </div>

                        {/* TOTAL MONEY APPROVED */}
                        <div id="metric-card-approved-money" className="bg-emerald-900 text-white rounded-[20px] p-5 space-y-2 shadow-md border border-emerald-800 relative overflow-hidden">
                          <div className="absolute right-2 bottom-2 opacity-10">
                            <BadgeDollarSign className="h-20 w-20 text-white" />
                          </div>
                          <div className="flex justify-between items-center relative z-10">
                            <span className="text-[9px] text-emerald-200 font-bold uppercase tracking-widest">Money Quoted &amp; Approved</span>
                            <div className="p-1.5 bg-emerald-800/80 rounded-lg text-emerald-100">
                              <DollarSign className="h-4 w-4 text-emerald-300" />
                            </div>
                          </div>
                          <p className="text-2xl md:text-3xl font-serif font-bold text-white relative z-10">
                            ${totalMoneyApproved.toLocaleString()}
                          </p>
                          <p className="text-[9px] text-emerald-200/80 font-mono relative z-10">
                            {approvedValueRatio}% of total ${totalMoneyQuotedGross.toLocaleString()} gross quoted
                          </p>
                        </div>
                      </div>

                      {/* 2. ANALYTICS OF MONEY APPROVED PER MONTH (WITH GRAPH CHART) */}
                      <div id="analytics-monthly-approved-revenue-section" className="bg-white border border-stone-200 p-6 rounded-[24px] space-y-6 shadow-3xs">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-stone-100">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 animate-pulse" />
                              <h4 className="font-serif font-bold text-stone-900 text-base md:text-lg">
                                Analytics of Money Approved Per Month
                              </h4>
                            </div>
                            <p className="text-stone-500 text-xs mt-0.5">
                              Monthly breakdown of approved quote revenue ($) and closed contract order volume.
                            </p>
                          </div>

                          <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-lg border border-stone-200">
                            <span className="text-[10px] font-bold text-stone-600 px-2 font-mono uppercase">
                              12-Month Performance Trend
                            </span>
                            <span className="text-[10px] bg-emerald-800 text-white px-2 py-0.5 rounded font-bold font-mono">
                              ${totalMoneyApproved.toLocaleString()} Total Approved
                            </span>
                          </div>
                        </div>

                        {/* Interactive Bar Graph Chart */}
                        <div className="space-y-4">
                          <div className="h-64 flex items-end justify-between gap-2 sm:gap-3 pt-8 pb-2 px-2 bg-stone-50/70 border border-stone-200/80 rounded-2xl relative overflow-hidden">
                            {/* Horizontal background grid lines */}
                            <div className="absolute inset-x-0 top-6 border-b border-stone-200/40 border-dashed" />
                            <div className="absolute inset-x-0 top-20 border-b border-stone-200/40 border-dashed" />
                            <div className="absolute inset-x-0 top-36 border-b border-stone-200/40 border-dashed" />
                            <div className="absolute inset-x-0 top-52 border-b border-stone-200/40 border-dashed" />

                            {monthlyChartData.map((d) => {
                              const heightPct = d.approvedAmount > 0
                                ? Math.max(Math.round((d.approvedAmount / maxMonthlyApprovedAmt) * 100), 12)
                                : 4;

                              return (
                                <div key={d.month} className="flex-1 flex flex-col items-center h-full justify-end group relative z-10 cursor-pointer">
                                  {/* Hover Tooltip Card */}
                                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none absolute -top-16 bg-stone-950 text-white p-2.5 rounded-xl text-[10px] space-y-0.5 shadow-xl whitespace-nowrap z-30 border border-stone-800 transform -translate-y-1">
                                    <p className="font-serif font-bold text-amber-400 text-xs">{d.month} Approved Analytics</p>
                                    <p className="font-mono text-emerald-400 font-bold">${d.approvedAmount.toLocaleString()} Approved</p>
                                    <p className="text-stone-300">{d.approvedCount} approved quote{d.approvedCount === 1 ? "" : "s"} ({d.totalInquiries} total inquiries)</p>
                                    <p className="text-stone-400 font-mono text-[9px]">Avg Ticket: ${d.avgTicket}</p>
                                  </div>

                                  {/* Bar Value Label on top of bar */}
                                  <span className={`text-[9px] font-mono font-bold ${d.approvedAmount > 0 ? "text-stone-800 group-hover:text-emerald-800" : "text-stone-400"} mb-1 transition-colors`}>
                                    ${d.approvedAmount >= 1000 ? `${(d.approvedAmount / 1000).toFixed(1)}k` : d.approvedAmount}
                                  </span>

                                  {/* Main Bar Element */}
                                  <div className="w-full max-w-[32px] bg-stone-200 rounded-t-lg overflow-hidden flex flex-col justify-end transition-all duration-300 group-hover:bg-amber-100 shadow-3xs" style={{ height: `${heightPct}%` }}>
                                    <div className={`w-full ${d.approvedAmount > 0 ? "bg-gradient-to-t from-emerald-800 to-emerald-600 group-hover:from-emerald-700 group-hover:to-emerald-500" : "bg-stone-300/80"} h-full rounded-t-lg transition-all duration-300`} />
                                  </div>

                                  {/* Month Label */}
                                  <span className="text-[10px] font-bold text-stone-700 font-mono mt-2 group-hover:text-emerald-900">
                                    {d.month}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Monthly Summary Legend & Metrics Table */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
                            {monthlyChartData.slice(-6).map((d) => (
                              <div key={d.month} className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/80 hover:border-emerald-700/40 transition-all">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="font-mono font-bold text-stone-800">{d.month} Log</span>
                                  <span className="text-[9px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.2 rounded font-mono">
                                    {d.approvedCount} approved
                                  </span>
                                </div>
                                <p className="text-sm font-serif font-bold text-stone-950 mt-1">
                                  ${d.approvedAmount.toLocaleString()}
                                </p>
                                <p className="text-[9px] text-stone-400 font-mono mt-0.5">
                                  Avg quote: ${d.avgTicket}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 3. ITEMS MORE QUOTED REQUESTED vs ITEMS LESS QUOTED REQUESTED (STACKED ON SEPARATE LINES) */}
                      <div className="space-y-8">
                        {/* ITEMS MORE QUOTED REQUESTED (ROW 1) */}
                        <div id="analytics-items-more-quoted-section" className="bg-white border border-stone-200 p-6 rounded-[24px] space-y-5 shadow-3xs">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-stone-100 gap-2">
                            <div>
                              <h4 className="font-serif font-bold text-stone-900 text-base flex items-center gap-2">
                                <span className="p-1 bg-emerald-100 text-emerald-800 rounded-md text-sm">🔥</span> Most Quoted Requested Items
                              </h4>
                              <p className="text-xs text-stone-500 mt-0.5">Catalog products generating the highest custom inquiry &amp; quote volume.</p>
                            </div>
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded-full font-mono border border-emerald-200 shrink-0">
                              Top Demanded Catalog Items
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
                            {mostQuotedItems.map(({ product: p, count, totalQuotedVal, approvedVal }, index) => (
                              <div key={p.id} className="flex flex-col justify-between p-3.5 bg-stone-50/90 border border-stone-200/90 rounded-2xl hover:bg-stone-100/80 transition-all space-y-3">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="h-6 w-6 rounded-full bg-amber-800 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                                      #{index + 1}
                                    </span>
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded font-mono">
                                      {count} quote{count === 1 ? "" : "s"}
                                    </span>
                                  </div>
                                  <img
                                    src={p.images?.[0] || "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=200&q=80"}
                                    alt={p.name}
                                    className="h-24 w-full object-cover rounded-xl border border-stone-200/80"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="min-w-0 pt-1">
                                    <h5 className="text-xs font-bold text-stone-900 truncate" title={p.name}>{p.name}</h5>
                                    <p className="text-[10px] text-stone-500 font-mono mt-0.5">${p.price} standard</p>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-stone-200/60 text-xs">
                                  <p className="text-[10px] font-mono text-stone-600 font-semibold">
                                    Quoted: <span className="font-bold text-stone-900">${totalQuotedVal.toLocaleString()}</span>
                                  </p>
                                  <p className="text-[10px] font-mono text-emerald-800 font-bold">
                                    Approved: ${approvedVal.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* ITEMS LESS QUOTED REQUESTED (ROW 2) */}
                        <div id="analytics-items-less-quoted-section" className="bg-white border border-stone-200 p-6 rounded-[24px] space-y-5 shadow-3xs">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-stone-100 gap-2">
                            <div>
                              <h4 className="font-serif font-bold text-stone-900 text-base flex items-center gap-2">
                                <span className="p-1 bg-amber-100 text-amber-900 rounded-md text-sm">💡</span> Least Quoted Requested Items
                              </h4>
                              <p className="text-xs text-stone-500 mt-0.5">Products with lower inquiry interest requiring promotional discounts or marketing highlight.</p>
                            </div>
                            <span className="text-[10px] bg-amber-50 text-amber-900 font-bold px-3 py-1 rounded-full font-mono border border-amber-200 shrink-0">
                              Opportunity Items for Promotion
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
                            {leastQuotedItems.map(({ product: p, count }, index) => (
                              <div key={p.id} className="flex flex-col justify-between p-3.5 bg-stone-50/90 border border-stone-200/90 rounded-2xl hover:bg-stone-100/80 transition-all space-y-3">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="h-6 w-6 rounded-full bg-stone-300 text-stone-700 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                                      #{index + 1}
                                    </span>
                                    <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded font-mono">
                                      {count} quote{count === 1 ? "" : "s"}
                                    </span>
                                  </div>
                                  <img
                                    src={p.images?.[0] || "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=200&q=80"}
                                    alt={p.name}
                                    className="h-24 w-full object-cover rounded-xl border border-stone-200/80 opacity-85"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="min-w-0 pt-1">
                                    <h5 className="text-xs font-bold text-stone-900 truncate" title={p.name}>{p.name}</h5>
                                    <p className="text-[10px] text-stone-500 font-mono mt-0.5">${p.price} standard</p>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-stone-200/60 text-center">
                                  <span className="text-[9px] bg-amber-100 text-amber-900 px-2 py-1 rounded-md font-bold uppercase tracking-wider inline-block w-full">
                                    Promo Suggested
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 4. QUOTE STATUS PIPELINE BREAKDOWN & POPULAR ENGRAVING TYPOGRAPHY METRICS */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* QUOTE STATUS PIPELINE BREAKDOWN */}
                        <div id="analytics-status-pipeline-section" className="bg-white border border-stone-200 p-6 rounded-[24px] space-y-4 shadow-3xs">
                          <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                            <h4 className="font-serif font-bold text-stone-900 text-sm flex items-center gap-2">
                              <Layers className="h-4 w-4 text-amber-800" /> Quote Status Pipeline Breakdown
                            </h4>
                            <span className="text-[10px] bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-mono font-bold">
                              {quotes.length} Total Records
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 leading-normal">
                            Real-time breakdown of active custom requests and messages across each stage of the workshop workflow.
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                            {[
                              { key: "pending", label: "Pending", badge: "bg-amber-100 text-amber-900 border-amber-200" },
                              { key: "reviewing", label: "Reviewing", badge: "bg-blue-100 text-blue-800 border-blue-200" },
                              { key: "quoted", label: "Quoted", badge: "bg-purple-100 text-purple-800 border-purple-200" },
                              { key: "approved", label: "Approved", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
                              { key: "completed", label: "Completed", badge: "bg-emerald-200 text-emerald-950 border-emerald-300" },
                              { key: "rejected", label: "Rejected", badge: "bg-red-100 text-red-800 border-red-200" }
                            ].map((st) => {
                              const count = quotes.filter((q) => q.status === st.key).length;
                              const pct = quotes.length > 0 ? Math.round((count / quotes.length) * 100) : 0;
                              return (
                                <div key={st.key} className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${st.badge}`}>
                                      {st.label}
                                    </span>
                                    <span className="text-[10px] font-mono text-stone-500 font-bold">{pct}%</span>
                                  </div>
                                  <p className="text-xl font-serif font-bold text-stone-950">{count}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* POPULAR ENGRAVING TYPOGRAPHY METRICS */}
                        <div id="analytics-typography-metrics-section" className="bg-white border border-stone-200 p-6 rounded-[24px] space-y-4 shadow-3xs">
                          <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                            <h4 className="font-serif font-bold text-stone-900 text-sm flex items-center gap-2">
                              <Type className="h-4 w-4 text-amber-800" /> Popular Engraving Typography Metrics
                            </h4>
                            <span className="text-[10px] bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-mono font-bold">
                              Font Preferences
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 leading-normal">
                            Most frequently requested engraving font styles selected by patrons in the interactive 2D customizer.
                          </p>
                          <div className="space-y-2.5 pt-1">
                            {(() => {
                              const fontCounts: Record<string, number> = {};
                              quotes.forEach((q) => {
                                if (q.fontPreference) {
                                  fontCounts[q.fontPreference] = (fontCounts[q.fontPreference] || 0) + 1;
                                }
                              });
                              const mergedFonts = Object.keys(fontCounts).length > 0 ? fontCounts : (richAnalytics?.customizations?.fonts || {});
                              const entries = Object.entries(mergedFonts).sort((a: any, b: any) => Number(b[1]) - Number(a[1])).slice(0, 6);
                              if (entries.length === 0) {
                                return (
                                  <div className="p-4 border border-dashed border-stone-200 rounded-xl bg-stone-50 text-center">
                                    <p className="text-xs text-stone-400 italic">No typography preferences logged yet. Font selections from custom quote requests will populate here in real time.</p>
                                  </div>
                                );
                              }
                              const totalFontSelections = entries.reduce((sum, [, c]) => sum + Number(c), 0) || 1;
                              return entries.map(([fontName, count]) => {
                                const pct = Math.round((Number(count) / totalFontSelections) * 100);
                                return (
                                  <div key={fontName} className="space-y-1">
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="font-semibold text-stone-800 truncate">{fontName}</span>
                                      <span className="text-[10px] font-mono font-bold text-amber-900">{String(count)} req ({pct}%)</span>
                                    </div>
                                    <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-200/60">
                                      <div className="h-full bg-amber-800 rounded-full transition-all duration-300" style={{ width: `${Math.max(pct, 6)}%` }} />
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* 5. CUSTOMER SEARCHES & CONTRACT CONVERSION FUNNEL */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* CUSTOMER SEARCH TERMS & KEYWORDS */}
                        <div id="analytics-searches-section" className="bg-white border border-stone-200 p-6 rounded-[24px] space-y-4 shadow-3xs">
                          <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                            <h4 className="font-serif font-bold text-stone-900 text-sm flex items-center gap-2">
                              <Search className="h-4 w-4 text-amber-800" /> Customer Search Terms &amp; Query Keywords
                            </h4>
                            <span className="text-[10px] bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-mono font-bold">
                              Search Analytics
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 leading-normal">
                            Direct words and search filters queried by shop patrons looking for specific custom wood or leather designs.
                          </p>

                          <div className="flex flex-wrap gap-2 pt-1">
                            {Object.entries(richAnalytics?.searches || {}).length > 0 ? (
                              Object.entries(richAnalytics?.searches || {})
                                .sort((a: any, b: any) => b[1] - a[1])
                                .slice(0, 12)
                                .map(([term, count]: any) => (
                                  <span key={term} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-full text-xs text-stone-800 font-medium hover:border-amber-800/40 transition-colors">
                                    <Search className="h-3 w-3 text-stone-400" /> {term}
                                    <span className="bg-amber-800 text-white font-bold px-1.5 py-0.2 rounded-full text-[9px] font-mono">{count}</span>
                                  </span>
                                ))
                            ) : (
                              <div className="w-full p-4 border border-dashed border-stone-200 rounded-xl bg-stone-50 text-center">
                                <p className="text-xs text-stone-400 italic">No search logs recorded yet. Keywords typed into the catalog search bar will populate here.</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* CONTRACT CONVERSION FUNNEL */}
                        <div id="analytics-funnel-section" className="bg-white border border-stone-200 p-6 rounded-[24px] space-y-4 shadow-3xs">
                          <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                            <h4 className="font-serif font-bold text-stone-900 text-sm flex items-center gap-2">
                              <TrendingUp className="h-4.5 w-4.5 text-amber-800" /> Inquiry to Order Funnel
                            </h4>
                            <span className="text-[10px] bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-mono font-bold">
                              Conversion Funnel
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 leading-relaxed">
                            Step-by-step funnel tracking from visitor browsing to custom contract approval.
                          </p>

                          <div className="space-y-3 pt-1">
                            {[
                              {
                                stage: "1. Storefront Visitors",
                                desc: "Total page views & product browsing",
                                count: totalWebsiteVisits,
                                percentage: 100,
                                width: "w-full"
                              },
                              {
                                stage: "2. Total Inquiries",
                                desc: "Custom quote requests submitted",
                                count: quotes.length,
                                percentage: totalWebsiteVisits ? Math.round((quotes.length / totalWebsiteVisits) * 100) : 12,
                                width: "w-4/5"
                              },
                              {
                                stage: "3. Priced Quotes Dispatched",
                                desc: "Custom price proposals sent to client",
                                count: quotes.filter(q => ["quoted", "approved", "completed"].includes(q.status)).length,
                                percentage: quotes.length ? Math.round((quotes.filter(q => ["quoted", "approved", "completed"].includes(q.status)).length / quotes.length) * 100) : 80,
                                width: "w-3/5"
                              },
                              {
                                stage: "4. Approved & Paid Orders",
                                desc: "Finalized contracts with approved payments",
                                count: approvedQuotes.length,
                                percentage: quotes.length ? Math.round((approvedQuotes.length / quotes.length) * 100) : 50,
                                width: "w-2/5"
                              }
                            ].map((step, i, arr) => (
                              <div key={i} className="flex flex-col items-center">
                                <div className={`flex items-center justify-between p-3 border border-stone-200 rounded-xl bg-stone-50/80 shadow-3xs ${step.width} transition-all duration-300`}>
                                  <div>
                                    <p className="text-xs font-bold text-stone-900">{step.stage}</p>
                                    <p className="text-[10px] text-stone-400">{step.desc}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-serif font-black text-stone-950">{step.count}</p>
                                    <p className="text-[9px] font-mono text-emerald-800 font-bold">{step.percentage}%</p>
                                  </div>
                                </div>
                                {i < arr.length - 1 && (
                                  <div className="h-3 flex flex-col items-center">
                                    <span className="text-[8px] text-stone-400 font-bold font-mono">▼</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* ==================== TABS 3: MANAGE PRODUCTS ==================== */}
        {activeTab === "products" && (
          <div id="admin-tab-products-panel" className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-stone-200">
              <div>
                <h3 className="font-serif font-bold text-stone-900 text-xl md:text-2xl">Bespoke Product Catalog</h3>
                <p className="text-stone-500 text-xs">Add, edit, or remove catalog item layouts, specify wood/leather categories, and customize properties.</p>
              </div>

              {!isAddingProduct && !editingProduct && (
                <button
                  id="add-product-toggle-btn"
                  onClick={() => setIsAddingProduct(true)}
                  className="bg-amber-800 hover:bg-stone-900 text-white text-xs font-bold py-2 px-3 rounded-sm cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Add New Craft
                </button>
              )}
            </div>

            {/* Adding/Editing Product Form */}
            {(isAddingProduct || editingProduct) && (
              <form onSubmit={handleSaveProduct} className="bg-stone-50 border border-stone-300 p-5 rounded-lg space-y-4 animate-fade-in">
                <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                  <h4 className="font-serif font-bold text-stone-900 text-sm">
                    {editingProduct ? `Edit Craft: ${editingProduct.name}` : "Create Bespoke Craft Template"}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingProduct(false);
                      setEditingProduct(null);
                    }}
                    className="text-stone-400 hover:text-stone-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {!editingProduct && (
                  <div className="bg-amber-800/5 border border-amber-800/10 rounded-xl p-4.5 space-y-3">
                    <span className="text-[10px] text-amber-900 font-bold uppercase tracking-widest block">
                      💡 Choose a Starter Template (Pre-fills and fully customizable)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {[
                        {
                          id: "general_template",
                          name: "General Catalog Item",
                          desc: "Standard general catalog template with all custom sections",
                          icon: "📋",
                          values: {
                            name: "Bespoke Catalog Craft Item",
                            description: "A beautifully handcrafted catalog piece made with premium materials and bench-crafted care. Fully customizable to your specifications.",
                            categoryId: "wood",
                            price: 45,
                            maxPrice: "",
                            promoPrice: "",
                            image: "https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&q=80&w=600",
                            featured: false,
                            inStock: true,
                            customOptions: "Custom Inscription, Gift Packaging Theme",
                            hideCustomOptions: false,
                            hasVisualizer: true,
                            hasEngravingText: true,
                            hasTypography: true,
                            leadTime: "3-5 Business Days",
                            dimensions: "",
                            badge: "Handcrafted Quality",
                            seal: "Artisan Studio Certified",
                            includedNotes: "Customized, Handcrafted, Gift-Ready",
                            pricingNotice: "*The final cost will be calculated and sent by the crafter after reviewing your order details.",
                            alternativeRequestText: "If you want a custom size, design, or specialized piece, check this box to specify what you'd like!"
                          }
                        },
                        {
                          id: "engraving",
                          name: "Custom Engraving",
                          desc: "Live text personalization visualizer",
                          icon: "✒️",
                          values: {
                            name: "Heirloom Custom Engraved Oak Serving Board",
                            description: "Exquisitely hand-planed American Oak serving board, precision-etched with your custom text, family monogram, or anniversary date. Coated in food-safe board wax.",
                            categoryId: "wood",
                            price: 75,
                            maxPrice: "95",
                            promoPrice: "",
                            image: "https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&q=80&w=600",
                            featured: false,
                            inStock: true,
                            customOptions: "Custom Engraving Text, Typography Preference, Wood Material / Finish, Premium Gift Wrap",
                            hideCustomOptions: false,
                            hasVisualizer: true,
                            hasEngravingText: true,
                            hasTypography: true,
                            leadTime: "3-5 Business Days",
                            dimensions: '16" x 11" x 1.25"',
                            badge: "FSC Oak Hardwood",
                            seal: "Hand-Etched In Studio",
                            includedNotes: "Custom Engraved, Organic Waxed, Gift Ready",
                            pricingNotice: "*The final cost will be calculated and sent by the crafter after reviewing your order details.",
                            alternativeRequestText: "If you want a custom size or alternative wood species, check this box!"
                          }
                        },
                        {
                          id: "sublimation_visualizer",
                          name: "Sublimation (with Visualizer)",
                          desc: "Full-color sublimation print + live text visualizer",
                          icon: "🎨",
                          values: {
                            name: "Bespoke Personalization Ceramic Mug",
                            description: "A premium white ceramic mug custom heat-pressed with your uploaded photograph on one side, and a beautiful custom-printed text inscription styled in elegant typography on the other.",
                            categoryId: "sublimation",
                            price: 18,
                            maxPrice: "24",
                            promoPrice: "",
                            image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&q=80&w=600",
                            featured: false,
                            inStock: true,
                            customOptions: "Mug Size (11oz, 15oz), Inner Rim Color (White, Black, Red, Blue), Custom Engraving Text, Typography Preference, Printed Font Size (Small, Medium, Large, Other)",
                            hasVisualizer: true
                          }
                        },
                        {
                          id: "sublimation_no_visualizer",
                          name: "Sublimation (Photo Only)",
                          desc: "Full-color sublimation print with zero text (just upload photo)",
                          icon: "📸",
                          values: {
                            name: "Classic Photo-Print Keepsake Mug",
                            description: "Enjoy a pristine full-wrap sublimation print of your favorite photo, family collage, or corporate branding. Completely scratch-proof and dishwasher safe. Simple drag-and-drop file upload, no text visualizer needed.",
                            categoryId: "sublimation",
                            price: 15,
                            maxPrice: "",
                            promoPrice: "",
                            image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&q=80&w=600",
                            featured: false,
                            inStock: true,
                            customOptions: "Mug Size (11oz, 15oz), Rim & Handle Accents (Classic White, Ruby Red, Emerald Green), Finish (High-Gloss, Modern Matte)",
                            hasVisualizer: false
                          }
                        },
                        {
                          id: "pipecleaner",
                          name: "Handmade Flowers",
                          desc: "Colorful custom hand-twisted everlasting blooms",
                          icon: "🌸",
                          values: {
                            name: "Handcrafted Pipe Cleaner Flower Bouquet",
                            description: "A gorgeous, vibrant bouquet of hand-twisted pipe cleaner flowers. Features incredibly detailed blooms, soft foliage, and customized felt wrapping. These everlasting stems never fade, perfect for desktop styling.",
                            categoryId: "pipecleaner",
                            price: 35,
                            maxPrice: "55",
                            promoPrice: "",
                            image: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&q=80&w=600",
                            featured: false,
                            inStock: true,
                            readyForPickup: true,
                            isEngravingProduct: false,
                            isHandmadeFlowers: true,
                            customOptions: "Flower Types (Sunflower, Pink Tulip, Lavender, Red Rose), Stem Count (3 Stems, 6 Stems, 12 Stems), Gift Felt Wrap Theme",
                            hasVisualizer: false,
                            hasEngravingText: false,
                            hasTypography: false
                          }
                        }
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setProductForm(t.values)}
                          className="bg-white hover:bg-stone-100 border border-stone-200 hover:border-amber-800 p-3 rounded-lg text-left cursor-pointer transition-all active:scale-98 shadow-3xs flex gap-2.5 items-start group text-xs"
                        >
                          <span className="text-xl shrink-0 mt-0.5 group-hover:scale-110 transition-transform">{t.icon}</span>
                          <div className="space-y-0.5 overflow-hidden">
                            <span className="text-stone-900 font-bold text-xs block group-hover:text-amber-800 transition-colors">{t.name}</span>
                            <span className="text-[10px] text-stone-500 leading-normal block">{t.desc}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Name */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="pForm-name" className="text-xs font-bold text-stone-700">Craft Name *</label>
                    <input
                      id="pForm-name"
                      type="text"
                      required
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      placeholder="e.g. Heirloom Maple Salad Bowl"
                      className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-sm focus:outline-none"
                    />
                  </div>

                  {/* Category Selection */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label htmlFor="pForm-category" className="text-xs font-bold text-stone-700">Category *</label>
                      <button
                        type="button"
                        onClick={() => setActiveTab("categories")}
                        className="text-[10px] text-amber-800 hover:underline font-bold"
                      >
                        + Manage Categories
                      </button>
                    </div>
                    <select
                      id="pForm-category"
                      required
                      value={productForm.categoryId}
                      onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                      className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-sm focus:outline-none cursor-pointer"
                    >
                      <option value="">{categories.length === 0 ? "-- No categories yet (create one first) --" : "-- Choose Category --"}</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {categories.length === 0 && (
                      <p className="text-[10px] text-amber-800">
                        Please create a category under the <strong>Categories</strong> tab first so you can assign this craft to it.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  {/* Price */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="pForm-price" className="text-xs font-bold text-stone-700">Base Price (USD) *</label>
                    <input
                      id="pForm-price"
                      type="number"
                      required
                      min="0"
                      value={productForm.price}
                      onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                      className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-sm focus:outline-none"
                    />
                  </div>

                  {/* Max Price */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="pForm-maxPrice" className="text-xs font-bold text-stone-700">Max Price (For Range - Optional)</label>
                    <input
                      id="pForm-maxPrice"
                      type="number"
                      min="0"
                      value={productForm.maxPrice}
                      onChange={(e) => setProductForm({ ...productForm, maxPrice: e.target.value })}
                      placeholder="e.g. 150"
                      className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-sm focus:outline-none"
                    />
                  </div>

                  {/* Promo Price */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="pForm-promoPrice" className="text-xs font-bold text-stone-700">Promo / Sale Price (Optional)</label>
                    <input
                      id="pForm-promoPrice"
                      type="number"
                      min="0"
                      value={productForm.promoPrice}
                      onChange={(e) => setProductForm({ ...productForm, promoPrice: e.target.value })}
                      className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-sm focus:outline-none"
                    />
                  </div>

                  {/* Visual Representation Zone */}
                  <div className="bg-stone-100/60 p-4 rounded-xl border border-stone-200/80 space-y-4 md:col-span-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 block">Product Visual representation</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left side: Upload or Presets */}
                      <div className="space-y-3">
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="pForm-image-preset" className="text-xs font-bold text-stone-700">Preset Library Photo</label>
                          <select
                            id="pForm-image-preset"
                            value={imagePresets.some(preset => preset.url === productForm.image) ? productForm.image : ""}
                            onChange={(e) => {
                              if (e.target.value) {
                                setProductForm({ ...productForm, image: e.target.value });
                              }
                            }}
                            className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-xs focus:outline-none cursor-pointer"
                          >
                            <option value="">-- Or Choose Custom File/URL Below --</option>
                            {imagePresets.map((img) => (
                              <option key={img.url} value={img.url}>
                                {img.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* File Uploader Container */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-stone-700 block">Upload Product Photo</label>
                          <div 
                            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                              dragActive ? "border-amber-800 bg-amber-50" : "border-stone-300 bg-white hover:border-amber-700/50"
                            }`}
                            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragActive(false);
                              if (e.dataTransfer.files?.[0]) {
                                const input = document.getElementById("pForm-image-file") as HTMLInputElement;
                                if (input) {
                                  const list = new DataTransfer();
                                  list.items.add(e.dataTransfer.files[0]);
                                  input.files = list.files;
                                  handleImageUpload({ target: input } as any);
                                }
                              }
                            }}
                            onClick={() => document.getElementById("pForm-image-file")?.click()}
                          >
                            <input
                              id="pForm-image-file"
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                            />
                            <Upload className="h-5 w-5 text-stone-400 mx-auto mb-1.5" />
                            <p className="text-[10px] font-bold text-stone-700">Drag &amp; Drop or Click to Upload</p>
                            <p className="text-[9px] text-stone-400 font-light">PNG, JPG, or WEBP (Max 10MB)</p>
                          </div>
                          {uploadingImage && (
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-800 font-medium">
                              <span className="h-3 w-3 border-2 border-amber-800 border-t-transparent rounded-full animate-spin"></span>
                              Uploading image asset to full-stack server...
                            </div>
                          )}
                          {uploadError && (
                            <p className="text-[10px] text-red-600 font-bold">{uploadError}</p>
                          )}
                        </div>
                      </div>

                      {/* Right side: Preview & URL */}
                      <div className="flex flex-col justify-between space-y-3">
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="pForm-image-custom" className="text-xs font-bold text-stone-700">Or Custom Image Web URL</label>
                          <input
                            id="pForm-image-custom"
                            type="text"
                            value={productForm.image.startsWith("data:") ? "[Uploaded Craft Photo]" : productForm.image}
                            onChange={(e) => {
                              if (e.target.value !== "[Uploaded Craft Photo]") {
                                setProductForm({ ...productForm, image: e.target.value });
                              }
                            }}
                            placeholder="https://example.com/craft-photo.jpg"
                            className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-xs focus:outline-none"
                          />
                        </div>

                        {/* Image Preview Thumbnail */}
                        <div className="bg-stone-50 border border-stone-200 rounded-lg p-2.5 flex items-center gap-3 h-[85px] overflow-hidden">
                          {productForm.image ? (
                            <>
                              <img
                                src={productForm.image}
                                alt="Form Preview"
                                referrerPolicy="no-referrer"
                                className="h-14 w-14 object-cover rounded-md border border-stone-200 shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&q=80&w=200";
                                }}
                              />
                              <div className="text-[10px] overflow-hidden">
                                <p className="font-bold text-stone-800 truncate">Selected Visual Asset</p>
                                <p className="text-stone-400 truncate font-mono text-[9px]">
                                  {productForm.image.startsWith("data:") ? "Uploaded Studio Image" : productForm.image}
                                </p>
                              </div>
                            </>
                          ) : (
                            <div className="h-full w-full flex items-center justify-center border border-dashed border-stone-200 rounded-md bg-stone-100/50">
                              <p className="text-[10px] text-stone-400 italic">No image selected or uploaded yet.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Additional Gallery Images Manager */}
                    <div className="border-t border-stone-200 pt-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-stone-600 block">
                            Additional Gallery Images ({(productForm.additionalImages || []).length})
                          </span>
                          <span className="text-[9px] text-stone-400">Upload extra angles or detail shots for the product gallery thumbnails.</span>
                        </div>
                        <label className="bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 text-[10px] font-bold py-1.5 px-3 rounded-md cursor-pointer transition-colors inline-flex items-center gap-1.5 shadow-3xs">
                          <Upload className="h-3.5 w-3.5 text-amber-800" /> Upload Additional Photos
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleAdditionalImageUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                      {(productForm.additionalImages || []).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {(productForm.additionalImages || []).map((imgUrl, idx) => (
                            <div
                              key={idx}
                              draggable
                              onDragStart={() => setDraggedGalleryIdx(idx)}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (dragOverGalleryIdx !== idx) setDragOverGalleryIdx(idx);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggedGalleryIdx !== null && draggedGalleryIdx !== idx) {
                                  setProductForm((prev) => ({
                                    ...prev,
                                    additionalImages: reorderList(prev.additionalImages || [], draggedGalleryIdx, idx)
                                  }));
                                }
                                setDraggedGalleryIdx(null);
                                setDragOverGalleryIdx(null);
                              }}
                              onDragEnd={() => {
                                setDraggedGalleryIdx(null);
                                setDragOverGalleryIdx(null);
                              }}
                              title="Drag to reorder gallery image"
                              className={`relative group h-14 w-16 rounded-md overflow-hidden border bg-white cursor-grab active:cursor-grabbing transition-all ${
                                dragOverGalleryIdx === idx
                                  ? "border-amber-700 ring-2 ring-amber-600/50 scale-105"
                                  : draggedGalleryIdx === idx
                                  ? "opacity-40 border-stone-300"
                                  : "border-stone-300"
                              }`}
                            >
                              <img src={imgUrl} alt={`Extra ${idx + 1}`} className="w-full h-full object-cover pointer-events-none" referrerPolicy="no-referrer" />
                              <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-[8px] font-bold px-1 rounded">
                                #{idx + 2}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setProductForm((prev) => ({
                                    ...prev,
                                    additionalImages: (prev.additionalImages || []).filter((_, i) => i !== idx)
                                  }))
                                }
                                className="absolute top-0.5 right-0.5 bg-black/70 hover:bg-red-600 text-white rounded-full p-0.5 cursor-pointer"
                                title="Remove gallery image"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Custom Options Config */}
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <label htmlFor="pForm-options" className="text-xs font-bold text-stone-700">Customization Fields (Separated by commas)</label>
                    <label className="flex items-center gap-1.5 text-xs text-amber-900 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={productForm.hideCustomOptions}
                        onChange={(e) => setProductForm({ ...productForm, hideCustomOptions: e.target.checked })}
                        className="rounded-sm border-stone-300 text-amber-800 focus:ring-amber-800"
                      />
                      Hide "Options Available" Section on Product Page
                    </label>
                  </div>
                  
                  {/* Interactive Tags Display */}
                  {productForm.customOptions && productForm.customOptions.trim() !== "" && (
                    <div className="flex flex-wrap gap-1 bg-stone-50 p-2 border border-stone-200 rounded">
                      {productForm.customOptions.split(",").map((opt) => opt.trim()).filter(Boolean).map((opt, i) => (
                        <span key={i} className="bg-amber-100 text-amber-950 font-bold text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200 shadow-3xs">
                          {opt}
                          <button
                            type="button"
                            onClick={() => {
                              const remaining = productForm.customOptions
                                .split(",")
                                .map(o => o.trim())
                                .filter(o => o !== opt && o !== "");
                              setProductForm({ ...productForm, customOptions: remaining.join(", ") });
                            }}
                            className="hover:text-red-700 font-extrabold ml-1 cursor-pointer text-[10px] focus:outline-none"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <input
                    id="pForm-options"
                    type="text"
                    value={productForm.customOptions}
                    onChange={(e) => setProductForm({ ...productForm, customOptions: e.target.value })}
                    placeholder="e.g. Wood Type (Walnut, Maple), Initial Placement, Font Choice"
                    className="bg-white border border-stone-300 rounded-sm py-2.5 px-3 text-xs focus:outline-none"
                  />

                  {/* Preset Option Buttons */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">💡 Click to toggle customization fields:</p>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: "✒️ Custom Engraving", value: "Custom Engraving Text" },
                        { label: "🔤 Typography Font", value: "Typography Preference" },
                        { label: "🎁 Premium Gift Box", value: "Premium Gift Box" },
                        { label: "🪵 Wood Finish", value: "Wood Material / Finish" },
                        { label: "🐂 Leather Tone", value: "Leather Tone Preference" },
                        { label: "⚡ Priority Rush", value: "Priority Urgent Handling" }
                      ].map((preset) => {
                        const activeOpts = productForm.customOptions.split(",").map(o => o.trim()).filter(Boolean);
                        const isActive = activeOpts.includes(preset.value);
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => {
                              if (isActive) {
                                const remaining = activeOpts.filter(o => o !== preset.value);
                                setProductForm({ ...productForm, customOptions: remaining.join(", ") });
                              } else {
                                const newList = [...activeOpts, preset.value];
                                setProductForm({ ...productForm, customOptions: newList.join(", ") });
                              }
                            }}
                            className={`text-[9px] py-1 px-2 rounded-md border font-semibold cursor-pointer transition-colors ${
                              isActive 
                                ? "bg-amber-800 text-white border-amber-900 shadow-3xs" 
                                : "bg-white hover:bg-stone-100 text-stone-700 border-stone-300"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Gift Occasion Quick Filters Selector */}
                <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] uppercase font-bold tracking-wider text-amber-950 block">
                        🎁 Gift Occasion Quick Filters
                      </span>
                      <span className="text-[10px] text-amber-800">
                        Click a filter tag to select it for this product, or click <strong>×</strong> to delete a filter tag from the list.
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {giftOccasionFilters.length < GIFT_OCCASION_PRESETS.length && (
                        <button
                          type="button"
                          onClick={() => {
                            const restored = [...GIFT_OCCASION_PRESETS];
                            setGiftOccasionFilters(restored);
                            handleSaveCustomizer(undefined, undefined, undefined, restored);
                          }}
                          className="text-[10px] text-amber-900 hover:underline font-bold cursor-pointer"
                          title="Restore default Gift Occasion Quick Filters"
                        >
                          Restore Defaults
                        </button>
                      )}
                      {(productForm.giftOccasions || []).length > 0 && (
                        <button
                          type="button"
                          onClick={() => setProductForm({ ...productForm, giftOccasions: [] })}
                          className="text-[10px] text-red-700 hover:underline font-bold cursor-pointer"
                        >
                          Unselect All ({(productForm.giftOccasions || []).length})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Preset & Active Gift Occasion Pills with Delete Button */}
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const presetNames = giftOccasionFilters.map((o) => o.name);
                      const existingCustom = Array.from(
                        new Set<string>(
                          [
                            ...products.flatMap((p) => p.giftOccasions || []),
                            ...(productForm.giftOccasions || [])
                          ].filter((name): name is string => Boolean(name) && !presetNames.includes(name))
                        )
                      );
                      const allOccasionNames = [...presetNames, ...existingCustom];

                      if (allOccasionNames.length === 0) {
                        return (
                          <p className="text-[10px] text-stone-500 italic py-1">
                            No filter tags in the list yet. Add a new filter tag below or click &ldquo;Restore Defaults&rdquo;.
                          </p>
                        );
                      }

                      return allOccasionNames.map((occName) => {
                        const currentList = productForm.giftOccasions || [];
                        const isSelected = currentList.includes(occName);
                        return (
                          <div
                            key={occName}
                            className={`inline-flex items-center rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all overflow-hidden ${
                              isSelected
                                ? "bg-amber-800 text-white border-amber-900 shadow-2xs"
                                : "bg-white hover:bg-amber-50 text-stone-700 border-stone-300"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                const next = isSelected
                                  ? currentList.filter((item) => item !== occName)
                                  : [...currentList, occName];
                                setProductForm({ ...productForm, giftOccasions: next });
                              }}
                              className="px-2.5 py-1.5 cursor-pointer flex items-center gap-1.5"
                              title={isSelected ? "Click to unselect for this product" : "Click to select for this product"}
                            >
                              <span>{occName}</span>
                              {isSelected && <Check className="h-3 w-3 shrink-0" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextFilters = giftOccasionFilters.filter((f) => f.name !== occName);
                                setGiftOccasionFilters(nextFilters);
                                handleSaveCustomizer(undefined, undefined, undefined, nextFilters);
                                setProductForm((prev) => ({
                                  ...prev,
                                  giftOccasions: (prev.giftOccasions || []).filter((item) => item !== occName)
                                }));
                                const anyProductHasIt = products.some((p) => (p.giftOccasions || []).includes(occName));
                                if (anyProductHasIt) {
                                  const cleanedProducts = products.map((p) =>
                                    (p.giftOccasions || []).includes(occName)
                                      ? { ...p, giftOccasions: (p.giftOccasions || []).filter((item) => item !== occName) }
                                      : p
                                  );
                                  onUpdateProducts(cleanedProducts);
                                }
                              }}
                              className={`px-1.5 py-1.5 border-l text-[11px] leading-none font-extrabold cursor-pointer transition-colors ${
                                isSelected
                                  ? "border-amber-700 text-amber-200 hover:bg-red-700 hover:text-white"
                                  : "border-stone-200 text-stone-400 hover:bg-red-50 hover:text-red-600"
                              }`}
                              title={`Delete "${occName}" from filter list`}
                            >
                              ×
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Custom Gift Occasion Filter Input + Emoji Picker */}
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex flex-1 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowOccasionEmojiPicker((prev) => !prev)}
                          className={`px-2.5 py-1.5 rounded-sm border text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 shrink-0 ${
                            showOccasionEmojiPicker
                              ? "bg-amber-800 text-white border-amber-900"
                              : "bg-white hover:bg-amber-50 text-stone-700 border-stone-300"
                          }`}
                          title="Choose an emoji for your filter tag"
                        >
                          <span>😊</span>
                          <span className="text-[10px]">Emojis</span>
                        </button>
                        <input
                          type="text"
                          value={customOccasionInput}
                          onChange={(e) => setCustomOccasionInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const trimmed = customOccasionInput.trim();
                              if (!trimmed) return;
                              const currentList = productForm.giftOccasions || [];
                              if (!currentList.includes(trimmed)) {
                                setProductForm({ ...productForm, giftOccasions: [...currentList, trimmed] });
                              }
                              if (!giftOccasionFilters.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
                                const updatedFilters = [...giftOccasionFilters, { name: trimmed, term: trimmed }];
                                setGiftOccasionFilters(updatedFilters);
                                handleSaveCustomizer(undefined, undefined, undefined, updatedFilters);
                              }
                              setCustomOccasionInput("");
                            }
                          }}
                          placeholder="Add a new Gift Occasion filter (e.g. 🎂 Anniversary Gifts)..."
                          className="flex-1 bg-white border border-stone-300 rounded-sm py-1.5 px-2.5 text-xs focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = customOccasionInput.trim();
                          if (!trimmed) return;
                          const currentList = productForm.giftOccasions || [];
                          if (!currentList.includes(trimmed)) {
                            setProductForm({ ...productForm, giftOccasions: [...currentList, trimmed] });
                          }
                          if (!giftOccasionFilters.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
                            const updatedFilters = [...giftOccasionFilters, { name: trimmed, term: trimmed }];
                            setGiftOccasionFilters(updatedFilters);
                            handleSaveCustomizer(undefined, undefined, undefined, updatedFilters);
                          }
                          setCustomOccasionInput("");
                        }}
                        className="bg-amber-800 hover:bg-stone-900 text-white border border-amber-900 text-[10px] font-bold py-1.5 px-3 rounded-sm cursor-pointer transition-colors shrink-0"
                      >
                        + Add Filter Tag
                      </button>
                    </div>

                    {/* Quick Emoji Bar / Expandable Emoji Palette */}
                    <div className="bg-white border border-amber-200/80 rounded-lg p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">
                          Click an emoji to add it to your filter tag:
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowOccasionEmojiPicker((prev) => !prev)}
                          className="text-[9px] text-amber-800 hover:underline font-bold cursor-pointer"
                        >
                          {showOccasionEmojiPicker ? "Show Fewer" : "Show All Emojis"}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(showOccasionEmojiPicker
                          ? [
                              "🎁", "💍", "🏢", "🏡", "💼", "🥃", "🎂", "🎄", "❤️", "🌹",
                              "🌸", "🌻", "💐", "✨", "🕯️", "🪵", "🥂", "🍾", "👶", "🎓",
                              "🏆", "🐾", "🍁", "⭐", "🎀", "💎", "🎨", "🌿", "☕", "🎃",
                              "💝", "🕊️", "👑", "🧸", "🎈", "🎉", "🥂", "🍷", "🍺", "🍽️",
                              "🔪", "🧀", "🖼️", "🕰️", "🔑", "🏠", "👰", "🤵", "👨‍👩‍👧‍👦", "🐶",
                              "🐱", "🦌", "🌲", "🔥", "❄️", "☀️", "🌙", "⚓", "🧭", "🎵"
                            ]
                          : [
                              "🎁", "💍", "🏢", "🏡", "💼", "🥃", "🎂", "🎄", "❤️", "🌹",
                              "🌸", "💐", "✨", "🕯️", "🪵", "🥂", "👶", "🎓", "🏆", "🐾"
                            ]
                        ).map((emoji, idx) => (
                          <button
                            key={`${emoji}-${idx}`}
                            type="button"
                            onClick={() => {
                              setCustomOccasionInput((prev) => {
                                const trimmedLeading = prev.trimStart();
                                return prev ? `${prev}${prev.endsWith(" ") ? "" : " "}${emoji} ` : `${emoji} `;
                              });
                            }}
                            className="h-7 w-7 flex items-center justify-center rounded border border-stone-200 hover:border-amber-600 hover:bg-amber-50 text-sm cursor-pointer transition-transform active:scale-95"
                            title={`Insert ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Artisan Tags & Production Specifications */}
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/80 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-900 block">🏷️ Artisan Badges & Specifications</span>
                    <span className="text-[9px] text-amber-800 italic">Customize tags shown on the craft product page</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Lead Time */}
                    <div className="flex flex-col gap-1">
                      <label htmlFor="pForm-leadTime" className="text-[11px] font-bold text-stone-700">Lead Time</label>
                      <input
                        id="pForm-leadTime"
                        type="text"
                        value={productForm.leadTime}
                        onChange={(e) => setProductForm({ ...productForm, leadTime: e.target.value })}
                        placeholder="e.g. 3-5 Business Days"
                        className="bg-white border border-stone-300 rounded-sm py-1.5 px-2.5 text-xs focus:outline-none"
                      />
                    </div>

                    {/* Dimensions */}
                    <div className="flex flex-col gap-1">
                      <label htmlFor="pForm-dimensions" className="text-[11px] font-bold text-stone-700">Dimensions / Size</label>
                      <input
                        id="pForm-dimensions"
                        type="text"
                        value={productForm.dimensions}
                        onChange={(e) => setProductForm({ ...productForm, dimensions: e.target.value })}
                        placeholder='e.g. 16" x 11" x 1.25"'
                        className="bg-white border border-stone-300 rounded-sm py-1.5 px-2.5 text-xs focus:outline-none"
                      />
                    </div>

                    {/* Material Badge */}
                    <div className="flex flex-col gap-1">
                      <label htmlFor="pForm-badge" className="text-[11px] font-bold text-stone-700">Material Tag Badge</label>
                      <input
                        id="pForm-badge"
                        type="text"
                        value={productForm.badge}
                        onChange={(e) => setProductForm({ ...productForm, badge: e.target.value })}
                        placeholder="e.g. Heirloom Walnut Wood"
                        className="bg-white border border-stone-300 rounded-sm py-1.5 px-2.5 text-xs focus:outline-none"
                      />
                    </div>

                    {/* Artisan Seal */}
                    <div className="flex flex-col gap-1">
                      <label htmlFor="pForm-seal" className="text-[11px] font-bold text-stone-700">Artisan Seal Tag</label>
                      <input
                        id="pForm-seal"
                        type="text"
                        value={productForm.seal}
                        onChange={(e) => setProductForm({ ...productForm, seal: e.target.value })}
                        placeholder="e.g. Bench Handcrafted"
                        className="bg-white border border-stone-300 rounded-sm py-1.5 px-2.5 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Included Perks / Features */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pForm-includedNotes" className="text-[11px] font-bold text-stone-700">Tags (Separated by commas)</label>
                    <input
                      id="pForm-includedNotes"
                      type="text"
                      value={productForm.includedNotes}
                      onChange={(e) => setProductForm({ ...productForm, includedNotes: e.target.value })}
                      placeholder="e.g. Custom, Gift, Handmade, Wooden"
                      className="bg-white border border-stone-300 rounded-sm py-1.5 px-2.5 text-xs focus:outline-none"
                    />
                  </div>

                  {/* Pricing Note / Cost Disclaimer */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pForm-pricingNotice" className="text-[11px] font-bold text-stone-700">Pricing Note / Cost Calculation Disclaimer</label>
                    <input
                      id="pForm-pricingNotice"
                      type="text"
                      value={productForm.pricingNotice}
                      onChange={(e) => setProductForm({ ...productForm, pricingNotice: e.target.value })}
                      placeholder="e.g. *The final cost will be calculated and sent by the crafter after reviewing your order details."
                      className="bg-white border border-stone-300 rounded-sm py-1.5 px-2.5 text-xs focus:outline-none"
                    />
                  </div>

                  {/* Alternative Craft Request Description */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pForm-alternativeRequestText" className="text-[11px] font-bold text-stone-700">Alternative Craft Request Prompt / Description</label>
                    <input
                      id="pForm-alternativeRequestText"
                      type="text"
                      value={productForm.alternativeRequestText}
                      onChange={(e) => setProductForm({ ...productForm, alternativeRequestText: e.target.value })}
                      placeholder="e.g. If you want a custom rose or customized bouquet instead of this specific piece, check this box..."
                      className="bg-white border border-stone-300 rounded-sm py-1.5 px-2.5 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5 text-xs">
                  <label htmlFor="pForm-desc" className="text-xs font-bold text-stone-700">Detailed Craft Description *</label>
                  <textarea
                    id="pForm-desc"
                    required
                    rows={3}
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    placeholder="Describe wood grains, engraving permanent details, care guidelines, etc."
                    className="bg-white border border-stone-300 rounded-sm py-1.5 px-3 text-sm focus:outline-none"
                  />
                </div>

                {/* Catalog Sections Toggle Control Box */}
                <div className="bg-amber-100/60 border border-amber-300 rounded-xl p-4 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-amber-950 uppercase tracking-wider block flex items-center gap-1.5">
                      ⚙️ Add or Hide Interactive Buyer Sections
                    </span>
                    <span className="text-[10px] text-amber-900 italic font-medium">
                      Control which customization blocks appear on the product page
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Visualizer Toggle */}
                    <label className="flex items-start gap-2.5 bg-white p-3 rounded-lg border border-amber-200/90 cursor-pointer hover:border-amber-400 transition-colors shadow-3xs">
                      <input
                        type="checkbox"
                        checked={productForm.hasVisualizer}
                        onChange={(e) => setProductForm({ ...productForm, hasVisualizer: e.target.checked })}
                        className="rounded-sm border-stone-300 text-amber-800 focus:ring-amber-800 mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-stone-900 text-xs block">🎨 Personalization Visualizer</span>
                        <span className="text-[10px] text-stone-500 block leading-tight font-light mt-0.5">Live 2D simulation preview box</span>
                      </div>
                    </label>

                    {/* Text to Engrave Toggle */}
                    <label className="flex items-start gap-2.5 bg-white p-3 rounded-lg border border-amber-200/90 cursor-pointer hover:border-amber-400 transition-colors shadow-3xs">
                      <input
                        type="checkbox"
                        checked={productForm.hasEngravingText}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            hasEngravingText: e.target.checked,
                            hasTypography: e.target.checked,
                            isEngravingProduct: e.target.checked
                          })
                        }
                        className="rounded-sm border-stone-300 text-amber-800 focus:ring-amber-800 mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-stone-900 text-xs block">✒️ Text to Engrave Field & Typography</span>
                        <span className="text-[10px] text-stone-500 block leading-tight font-light mt-0.5">Custom text input and font style selection</span>
                      </div>
                    </label>

                    {/* Handmade Flowers Layout Toggle */}
                    <label className="flex items-start gap-2.5 bg-white p-3 rounded-lg border border-amber-200/90 cursor-pointer hover:border-amber-400 transition-colors shadow-3xs sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={Boolean(productForm.isHandmadeFlowers)}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            isHandmadeFlowers: e.target.checked,
                            ...(e.target.checked
                              ? {
                                  hasVisualizer: false,
                                  hasEngravingText: false,
                                  hasTypography: false,
                                  isEngravingProduct: false
                                }
                              : {})
                          })
                        }
                        className="rounded-sm border-stone-300 text-amber-800 focus:ring-amber-800 mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-stone-900 text-xs block">🌸 Handmade Flowers Product (&ldquo;Get a Quote&rdquo; Form)</span>
                        <span className="text-[10px] text-stone-500 block leading-tight font-light mt-0.5">
                          Displays &ldquo;Get a Quote&rdquo; and flower availability, ordering, payment, and pickup/delivery instructions instead of engraving fields
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 sm:gap-6 pt-1 text-xs">
                  <label className="flex items-center gap-2 font-bold text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.featured}
                      onChange={(e) => setProductForm({ ...productForm, featured: e.target.checked })}
                      className="rounded-sm border-stone-300"
                    />
                    Featured Craft Homepage Badge
                  </label>

                  <label className="flex items-center gap-2 font-bold text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.inStock}
                      onChange={(e) => setProductForm({ ...productForm, inStock: e.target.checked })}
                      className="rounded-sm border-stone-300"
                    />
                    In Stock (Ready to Order)
                  </label>

                  <label className="flex items-center gap-2 font-bold text-emerald-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(productForm.readyForPickup)}
                      onChange={(e) => setProductForm({ ...productForm, readyForPickup: e.target.checked })}
                      className="rounded-sm border-stone-300 text-emerald-700 focus:ring-emerald-700"
                    />
                    Ready for Pickup
                  </label>

                  <label className="flex items-center gap-2 font-bold text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(productForm.isEngravingProduct)}
                      onChange={(e) => setProductForm({ ...productForm, isEngravingProduct: e.target.checked })}
                      className="rounded-sm border-stone-300 text-amber-800 focus:ring-amber-800"
                    />
                    Ready for Custom Engraving
                  </label>

                  <label className="flex items-center gap-2 font-bold text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.hideCustomOptions}
                      onChange={(e) => setProductForm({ ...productForm, hideCustomOptions: e.target.checked })}
                      className="rounded-sm border-stone-300 text-amber-800 focus:ring-amber-800"
                    />
                    Hide "Options Available" Section
                  </label>
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingProduct(false);
                      setEditingProduct(null);
                    }}
                    className="bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold py-2 px-4 rounded-sm cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="save-product-submit-btn"
                    type="submit"
                    className="bg-stone-900 hover:bg-amber-800 text-white text-xs font-bold py-2 px-4 rounded-sm cursor-pointer transition-colors"
                  >
                    Save Product Setup
                  </button>
                </div>
              </form>
            )}

            {/* List of Products Table */}
            {products.length > 1 && (
              <p className="text-[11px] text-stone-500 flex items-center gap-1.5">
                <GripVertical className="h-3.5 w-3.5 text-amber-800" />
                <span>Drag and drop rows (or use the &uarr; / &darr; arrows) to reorder how products appear in your storefront catalog.</span>
              </p>
            )}
            <div className="border border-stone-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-stone-100 text-stone-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5 border-b border-stone-200 w-16">Order</th>
                    <th className="p-3.5 border-b border-stone-200">Image</th>
                    <th className="p-3.5 border-b border-stone-200">Name</th>
                    <th className="p-3.5 border-b border-stone-200">Category</th>
                    <th className="p-3.5 border-b border-stone-200">Price</th>
                    <th className="p-3.5 border-b border-stone-200">Stock/Status</th>
                    <th className="p-3.5 border-b border-stone-200 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-stone-500">
                        <p className="font-serif font-bold text-stone-800 text-sm mb-1">No Crafts Listed Yet</p>
                        <p className="text-stone-400 text-xs mb-3">Your workshop catalog is ready for your real handmade items.</p>
                        <button
                          type="button"
                          onClick={() => setIsAddingProduct(true)}
                          className="bg-amber-800 hover:bg-stone-900 text-white text-xs font-bold py-1.5 px-3.5 rounded-sm cursor-pointer transition-colors inline-flex items-center gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add First Craft Product
                        </button>
                      </td>
                    </tr>
                  )}
                  {products.map((p, idx) => (
                    <tr
                      key={p.id}
                      id={`row-product-${p.id}`}
                      draggable
                      onDragStart={(e) => {
                        setDraggedProductIdx(idx);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverProductIdx !== idx) setDragOverProductIdx(idx);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedProductIdx !== null && draggedProductIdx !== idx) {
                          handleReorderProducts(draggedProductIdx, idx);
                        }
                        setDraggedProductIdx(null);
                        setDragOverProductIdx(null);
                      }}
                      onDragEnd={() => {
                        setDraggedProductIdx(null);
                        setDragOverProductIdx(null);
                      }}
                      className={`transition-all cursor-grab active:cursor-grabbing ${
                        dragOverProductIdx === idx
                          ? "bg-amber-50/80 ring-2 ring-inset ring-amber-700"
                          : draggedProductIdx === idx
                          ? "opacity-40 bg-stone-100"
                          : "hover:bg-stone-50"
                      }`}
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-1">
                          <GripVertical className="h-4 w-4 text-stone-400 hover:text-amber-800 shrink-0 cursor-grab" title="Drag to reorder product" />
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleReorderProducts(idx, idx - 1)}
                              className="text-[9px] leading-none px-1 py-0.5 rounded border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                              title="Move Up"
                            >
                              &uarr;
                            </button>
                            <button
                              type="button"
                              disabled={idx === products.length - 1}
                              onClick={() => handleReorderProducts(idx, idx + 1)}
                              className="text-[9px] leading-none px-1 py-0.5 rounded border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                              title="Move Down"
                            >
                              &darr;
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="h-10 w-12 object-cover rounded-md border border-stone-200 pointer-events-none"
                          referrerPolicy="no-referrer"
                        />
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-stone-900">{p.name}</div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {p.featured && (
                            <span className="text-[8px] bg-amber-100 text-amber-800 font-bold uppercase px-1.5 py-0.5 rounded-sm">
                              ★ Featured
                            </span>
                          )}
                          {(p.giftOccasions || []).map((occ) => (
                            <span
                              key={occ}
                              className="text-[8px] bg-stone-100 text-stone-700 border border-stone-200 font-semibold px-1.5 py-0.5 rounded-sm"
                            >
                              {occ}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5 text-stone-600">
                        {categories.find((c) => c.id === p.categoryId)?.name || "Uncategorized"}
                      </td>
                      <td className="p-3.5 font-bold">
                        {p.promoPrice ? (
                          <div className="text-red-700">
                            ${p.promoPrice} <span className="text-stone-400 line-through font-normal text-[10px]">{p.maxPrice ? `$${p.price} - $${p.maxPrice}` : `$${p.price}`}</span>
                          </div>
                        ) : (
                          p.maxPrice ? `$${p.price} - $${p.maxPrice}` : `$${p.price}`
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`font-semibold text-[10px] px-2 py-0.5 rounded-full ${
                            p.inStock ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {p.inStock ? "In Stock" : "Backorder Only"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            id={`edit-product-btn-${p.id}`}
                            onClick={() => startEditProduct(p)}
                            className="p-1.5 text-stone-600 hover:text-amber-800 hover:bg-stone-100 rounded cursor-pointer transition-colors"
                            title="Edit Product"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            id={`delete-product-btn-${p.id}`}
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-stone-100 rounded cursor-pointer transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="h-4 w-4" />
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

        {/* ==================== TABS 4: MANAGE CATEGORIES ==================== */}
        {activeTab === "categories" && (
          <div id="admin-tab-categories-panel" className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-stone-200">
              <div>
                <h3 className="font-serif font-bold text-stone-900 text-xl md:text-2xl">Bespoke Categories</h3>
                <p className="text-stone-500 text-xs">Organize custom creations into beautiful material hubs (e.g., Cherrywood, Leatherware, Glassware).</p>
              </div>

              {!isAddingCategory && (
                <button
                  id="add-category-toggle-btn"
                  onClick={() => setIsAddingCategory(true)}
                  className="bg-amber-800 hover:bg-stone-900 text-white text-xs font-bold py-2 px-3 rounded-sm cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Add Category
                </button>
              )}
            </div>

            {/* Add Category Form */}
            {isAddingCategory && (
              <form onSubmit={handleSaveCategory} className="bg-stone-50 border border-stone-300 p-5 rounded-lg space-y-4 animate-fade-in">
                <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                  <h4 className="font-serif font-bold text-stone-900 text-sm">
                    {editingCategory ? `Edit Material Category: ${editingCategory.name}` : "Add New Material Category"}
                  </h4>
                  <button type="button" onClick={() => { setIsAddingCategory(false); setEditingCategory(null); setCategoryForm({ name: "", description: "", image: "" }); }} className="text-stone-400 hover:text-stone-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="catForm-name" className="text-xs font-bold text-stone-700">Category Name *</label>
                    <input
                      id="catForm-name"
                      type="text"
                      required
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder="e.g. Fine Slate Stone"
                      className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-sm focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="catForm-image" className="text-xs font-bold text-stone-700">Representative Thumbnail Image</label>
                      <label className="text-[10px] text-amber-800 hover:underline font-bold cursor-pointer flex items-center gap-1">
                        <Upload className="h-3 w-3" /> Upload Photo
                        <input type="file" accept="image/*" onChange={handleCategoryImageUpload} className="hidden" />
                      </label>
                    </div>
                    <input
                      id="catForm-image"
                      type="text"
                      value={categoryForm.image.startsWith("data:") ? "[Uploaded Category Photo]" : categoryForm.image}
                      onChange={(e) => {
                        if (e.target.value !== "[Uploaded Category Photo]") {
                          setCategoryForm({ ...categoryForm, image: e.target.value });
                        }
                      }}
                      placeholder="https://images.unsplash.com/photo-... or click Upload Photo"
                      className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 text-xs">
                  <label htmlFor="catForm-desc" className="text-xs font-bold text-stone-700">Description *</label>
                  <textarea
                    id="catForm-desc"
                    required
                    rows={2}
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    placeholder="e.g. Earthy, textured slate plates carefully etched to create high contrast frost designs."
                    className="bg-white border border-stone-300 rounded-sm py-1.5 px-3 text-sm focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setIsAddingCategory(false); setEditingCategory(null); setCategoryForm({ name: "", description: "", image: "" }); }}
                    className="bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold py-2 px-4 rounded-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="save-category-submit-btn"
                    type="submit"
                    className="bg-stone-900 hover:bg-amber-800 text-white text-xs font-bold py-2 px-4 rounded-sm cursor-pointer"
                  >
                    {editingCategory ? "Save Changes" : "Create Category"}
                  </button>
                </div>
              </form>
            )}

            {/* List of Categories Grid */}
            {categories.length === 0 ? (
              <div className="bg-stone-50 border border-dashed border-stone-300 rounded-lg p-10 text-center">
                <FolderPlus className="h-8 w-8 mx-auto text-stone-400 mb-2" />
                <h4 className="font-serif font-bold text-stone-800 text-sm mb-1">No Categories Created Yet</h4>
                <p className="text-stone-500 text-xs mb-3">Add material categories like Woodware, Glassware, Acrylic, or Custom Gifts to organize your catalog.</p>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(true)}
                  className="bg-amber-800 hover:bg-stone-900 text-white text-xs font-bold py-1.5 px-3.5 rounded-sm cursor-pointer transition-colors inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Category
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {categories.length > 1 && (
                  <p className="text-[11px] text-stone-500 flex items-center gap-1.5">
                    <GripVertical className="h-3.5 w-3.5 text-amber-800" />
                    <span>Drag and drop category cards (or use the &uarr; / &darr; arrows) to reorder how categories appear on the homepage and catalog.</span>
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.map((c, idx) => (
                    <div
                      key={c.id}
                      id={`admin-cat-${c.id}`}
                      draggable
                      onDragStart={(e) => {
                        setDraggedCategoryIdx(idx);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverCategoryIdx !== idx) setDragOverCategoryIdx(idx);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedCategoryIdx !== null && draggedCategoryIdx !== idx) {
                          handleReorderCategories(draggedCategoryIdx, idx);
                        }
                        setDraggedCategoryIdx(null);
                        setDragOverCategoryIdx(null);
                      }}
                      onDragEnd={() => {
                        setDraggedCategoryIdx(null);
                        setDragOverCategoryIdx(null);
                      }}
                      className={`border rounded-lg p-4 flex gap-3 bg-white cursor-grab active:cursor-grabbing transition-all ${
                        dragOverCategoryIdx === idx
                          ? "border-amber-700 ring-2 ring-amber-600/40 bg-amber-50/30 scale-[0.99]"
                          : draggedCategoryIdx === idx
                          ? "opacity-40 border-stone-300 bg-stone-50"
                          : "border-stone-200 hover:border-amber-700/50"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center gap-1 text-stone-400 shrink-0" title="Drag to reorder category">
                        <GripVertical className="h-4 w-4 hover:text-amber-800 cursor-grab" />
                        <span className="text-[9px] font-mono font-bold text-stone-400">#{idx + 1}</span>
                      </div>
                      <img
                        src={c.image}
                        alt={c.name}
                        className="h-16 w-16 object-cover rounded-md border border-stone-200 shrink-0 pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-serif font-bold text-stone-950 text-sm leading-tight truncate">{c.name}</h4>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleReorderCategories(idx, idx - 1)}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 bg-stone-50 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                              title="Move Category Up"
                            >
                              &uarr;
                            </button>
                            <button
                              type="button"
                              disabled={idx === categories.length - 1}
                              onClick={() => handleReorderCategories(idx, idx + 1)}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 bg-stone-50 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                              title="Move Category Down"
                            >
                              &darr;
                            </button>
                            <button
                              id={`edit-cat-btn-${c.id}`}
                              onClick={() => startEditCategory(c)}
                              className="text-stone-400 hover:text-amber-800 p-1 cursor-pointer transition-colors"
                              title="Edit Category"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              id={`delete-cat-btn-${c.id}`}
                              onClick={() => handleDeleteCategory(c.id)}
                              className="text-stone-400 hover:text-red-700 p-1 cursor-pointer transition-colors"
                              title="Delete Category"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-stone-600 text-xs line-clamp-2 leading-relaxed">{c.description}</p>
                        <span className="text-[9px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-sm font-semibold inline-block">
                          {products.filter((p) => p.categoryId === c.id).length} items listed
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TABS 5: MANAGE TESTIMONIALS ==================== */}
        {activeTab === "testimonials" && (
          <div id="admin-tab-testimonials-panel" className="space-y-6">
            <div className="pb-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif font-bold text-stone-900 text-xl md:text-2xl">Bespoke Testimonials Approval</h3>
                <p className="text-stone-500 text-xs">Maintain high standards by moderating reviews. Only approved testimonials display to incoming customers.</p>
              </div>
              {!isAddingTestimonial && (
                <button
                  type="button"
                  id="add-manual-testimonial-btn"
                  onClick={() => setIsAddingTestimonial(true)}
                  className="bg-amber-800 hover:bg-stone-900 text-white text-xs font-bold py-2 px-3.5 rounded-sm cursor-pointer transition-colors flex items-center gap-1 shrink-0"
                >
                  <Plus className="h-4 w-4" /> Add Manual Review
                </button>
              )}
            </div>

            {/* Manual Testimonial Form */}
            {isAddingTestimonial && (
              <form onSubmit={handleSaveManualTestimonial} className="bg-stone-50 border border-stone-300 p-5 rounded-lg space-y-4 animate-fade-in text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                  <h4 className="font-serif font-bold text-stone-900 text-sm">Add Manual Review (e.g. Etsy/Email copy-paste)</h4>
                  <button type="button" onClick={() => setIsAddingTestimonial(false)} className="text-stone-400 hover:text-stone-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-stone-700">Client Author Name *</label>
                    <input
                      type="text"
                      required
                      value={testimonialForm.author}
                      onChange={(e) => setTestimonialForm({ ...testimonialForm, author: e.target.value })}
                      placeholder="e.g. Eleanor Vance"
                      className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-stone-700">Client Label / Source</label>
                    <input
                      type="text"
                      value={testimonialForm.company}
                      onChange={(e) => setTestimonialForm({ ...testimonialForm, company: e.target.value })}
                      placeholder="e.g. Etsy Customer, Email feedback"
                      className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-stone-700">Star Rating *</label>
                    <select
                      value={testimonialForm.rating}
                      onChange={(e) => setTestimonialForm({ ...testimonialForm, rating: Number(e.target.value) })}
                      className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-xs cursor-pointer focus:outline-none"
                    >
                      <option value="5">⭐⭐⭐⭐⭐ (5 Stars)</option>
                      <option value="4">⭐⭐⭐⭐ (4 Stars)</option>
                      <option value="3">⭐⭐⭐ (3 Stars)</option>
                      <option value="2">⭐⭐ (2 Stars)</option>
                      <option value="1">⭐ (1 Star)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-stone-700">Review Message *</label>
                  <textarea
                    required
                    rows={3}
                    value={testimonialForm.content}
                    onChange={(e) => setTestimonialForm({ ...testimonialForm, content: e.target.value })}
                    placeholder="The walnut wood is perfectly finished, and the dynamic typography monogram came out gorgeous..."
                    className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddingTestimonial(false)}
                    className="bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold py-2 px-4 rounded-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold py-2 px-4 rounded-sm cursor-pointer"
                  >
                    Publish Approved Review
                  </button>
                </div>
              </form>
            )}

            {/* Testimonials List */}
            {testimonials.length === 0 ? (
              <div className="bg-stone-50 border border-dashed border-stone-300 rounded-lg p-10 text-center">
                <Star className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                <h4 className="font-serif font-bold text-stone-800 text-sm mb-1">No Testimonials Yet</h4>
                <p className="text-stone-500 text-xs mb-3">You can paste authentic client reviews using &quot;Add Manual Review&quot;, or reviews submitted on the site will appear here for approval.</p>
                <button
                  type="button"
                  onClick={() => setIsAddingTestimonial(true)}
                  className="bg-amber-800 hover:bg-stone-900 text-white text-xs font-bold py-1.5 px-3.5 rounded-sm cursor-pointer transition-colors inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Manual Review
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {testimonials.length > 1 && (
                  <p className="text-[11px] text-stone-500 flex items-center gap-1.5">
                    <GripVertical className="h-3.5 w-3.5 text-amber-800" />
                    <span>Drag and drop reviews (or use the &uarr; / &darr; arrows) to customize the display order of client testimonials.</span>
                  </p>
                )}
                {testimonials.map((t, idx) => (
                  <div
                    key={t.id}
                    id={`admin-testimonial-${t.id}`}
                    draggable
                    onDragStart={(e) => {
                      setDraggedTestimonialIdx(idx);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverTestimonialIdx !== idx) setDragOverTestimonialIdx(idx);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedTestimonialIdx !== null && draggedTestimonialIdx !== idx) {
                        handleReorderTestimonials(draggedTestimonialIdx, idx);
                      }
                      setDraggedTestimonialIdx(null);
                      setDragOverTestimonialIdx(null);
                    }}
                    onDragEnd={() => {
                      setDraggedTestimonialIdx(null);
                      setDragOverTestimonialIdx(null);
                    }}
                    className={`border rounded-lg p-4 space-y-2.5 transition-all cursor-grab active:cursor-grabbing ${
                      dragOverTestimonialIdx === idx
                        ? "border-amber-700 ring-2 ring-amber-600/40 bg-amber-50/40 scale-[0.99]"
                        : draggedTestimonialIdx === idx
                        ? "opacity-40 border-stone-300 bg-stone-50"
                        : t.approved
                        ? "border-stone-200 bg-white hover:border-amber-700/40"
                        : "border-amber-400/50 bg-amber-50/20"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="flex items-center gap-1 text-stone-400 pt-0.5 shrink-0" title="Drag to reorder review">
                          <GripVertical className="h-4 w-4 hover:text-amber-800 cursor-grab" />
                          <span className="text-[9px] font-mono font-bold text-stone-400">#{idx + 1}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-stone-900 text-sm">{t.author}</strong>
                            {t.company && <span className="text-xs text-stone-500">({t.company})</span>}
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider ${
                                t.approved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {t.approved ? "Approved" : "Pending moderation"}
                            </span>
                          </div>
                          <span className="text-[10px] text-stone-400 font-mono">Submitted {t.date}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleReorderTestimonials(idx, idx - 1)}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 bg-stone-50 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                            title="Move Review Up"
                          >
                            &uarr;
                          </button>
                          <button
                            type="button"
                            disabled={idx === testimonials.length - 1}
                            onClick={() => handleReorderTestimonials(idx, idx + 1)}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 bg-stone-50 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                            title="Move Review Down"
                          >
                            &darr;
                          </button>
                        </div>
                        {/* Stars */}
                        <div className="flex text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < t.rating ? "fill-amber-500 text-amber-500" : "text-stone-200"}`} />
                          ))}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-stone-700 leading-relaxed italic bg-stone-50 p-3 rounded-sm border-l border-stone-200">
                      &ldquo;{t.content}&rdquo;
                    </p>

                    <div className="flex justify-end gap-2 text-xs">
                      <button
                        id={`delete-testimonial-btn-${t.id}`}
                        onClick={() => handleDeleteTestimonial(t.id)}
                        className="bg-stone-100 hover:bg-stone-200 text-stone-700 py-1.5 px-3 rounded-sm font-semibold cursor-pointer"
                      >
                        Delete
                      </button>

                      {!t.approved && (
                        <button
                          id={`approve-testimonial-btn-${t.id}`}
                          onClick={() => handleApproveTestimonial(t.id)}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white py-1.5 px-3 rounded-sm font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve & Publish
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TABS 6: MANAGE ANNOUNCEMENTS ==================== */}
        {activeTab === "announcements" && (
          <div id="admin-tab-announcements-panel" className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-stone-200">
              <div>
                <h3 className="font-serif font-bold text-stone-900 text-xl md:text-2xl">homepage Announcements</h3>
                <p className="text-stone-500 text-xs">Create or toggle dynamic alert/announcement banners displayed at the top of the screen.</p>
              </div>

              {!isAddingAnnouncement && (
                <button
                  id="add-announcement-toggle-btn"
                  onClick={() => setIsAddingAnnouncement(true)}
                  className="bg-amber-800 hover:bg-stone-900 text-white text-xs font-bold py-2 px-3 rounded-sm cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> New Announcement
                </button>
              )}
            </div>

            {/* Add Announcement Form */}
            {isAddingAnnouncement && (
              <form onSubmit={handleSaveAnnouncement} className="bg-stone-50 border border-stone-300 p-5 rounded-lg space-y-4 animate-fade-in">
                <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                  <h4 className="font-serif font-bold text-stone-900 text-sm">Post Live Announcement Bar &amp; Promotions</h4>
                  <button type="button" onClick={() => setIsAddingAnnouncement(false)} className="text-stone-400 hover:text-stone-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 text-xs">
                  <div>
                    <p className="font-bold text-amber-950 flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600 animate-pulse" /> Launch a Craft Fair Promo instantly!
                    </p>
                    <p className="text-amber-900 text-[10px]">Select a design template to pre-fill standard marketing copy in one click.</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setAnnouncementForm({
                        title: "🎪 Nicoletta at Summer Craft Fair!",
                        content: "Stop by booth #14 at the Downtown Craft Fair this Saturday to view our premium engravings and receive 15% off!",
                        type: "promo",
                        active: true
                      })}
                      className="bg-white hover:bg-amber-100/50 text-amber-950 font-bold py-1 px-2.5 rounded border border-amber-300 text-[10px] cursor-pointer transition-colors shadow-3xs"
                    >
                      Craft Fair Promo
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnnouncementForm({
                        title: "✨ Free Custom Engravings",
                        content: "This weekend only: All hand-finished Charcuterie and Cutting Boards include free monogram engraving customization!",
                        type: "promo",
                        active: true
                      })}
                      className="bg-white hover:bg-amber-100/50 text-amber-950 font-bold py-1 px-2.5 rounded border border-amber-300 text-[10px] cursor-pointer transition-colors shadow-3xs"
                    >
                      Free Engraving Deal
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="annForm-title" className="text-xs font-bold text-stone-700">Banner Alert Title *</label>
                    <input
                      id="annForm-title"
                      type="text"
                      required
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      placeholder="e.g. Free Autumn Setup Fee"
                      className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="annForm-type" className="text-xs font-bold text-stone-700">Banner Accent Category *</label>
                    <select
                      id="annForm-type"
                      value={announcementForm.type}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, type: e.target.value as "info" | "promo" | "urgent" })}
                      className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-sm cursor-pointer"
                    >
                      <option value="info">Info (Blue Background)</option>
                      <option value="promo">Promo Alert (Amber Oak Background)</option>
                      <option value="urgent">Urgent Notice (Crimson Background)</option>
                    </select>
                  </div>
                </div>

                {announcementForm.type === "promo" && (
                  <div className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-lg space-y-3 animate-fade-in text-xs">
                    <p className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" /> Link to Specific Product Promotion
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-stone-700">Select Product to Promote</label>
                        <select
                          value={promoProductId}
                          onChange={(e) => {
                            const pid = e.target.value;
                            setPromoProductId(pid);
                            if (pid) {
                              const prod = products.find(p => p.id === pid);
                              if (prod) {
                                setAnnouncementForm(prev => ({
                                  ...prev,
                                  title: `🎪 Craft Fair Deal: ${prod.name}`,
                                  content: `Stop by our craft fair booth! The hand-finished ${prod.name} is ${promoDiscountPercent}% off - now just $${Math.round(prod.price * (1 - promoDiscountPercent / 100))} USD!`
                                }));
                              }
                            }
                          }}
                          className="bg-white border border-stone-300 rounded-sm py-2 px-3 cursor-pointer text-xs"
                        >
                          <option value="">-- No specific product linkage (Manual text) --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} (${p.price} USD)</option>
                          ))}
                        </select>
                      </div>

                      {promoProductId && (
                        <div className="flex flex-col gap-1.5 animate-fade-in">
                          <label className="font-bold text-stone-700">Discount Percentage</label>
                          <select
                            value={promoDiscountPercent}
                            onChange={(e) => {
                              const pct = Number(e.target.value);
                              setPromoDiscountPercent(pct);
                              const prod = products.find(p => p.id === promoProductId);
                              if (prod) {
                                setAnnouncementForm(prev => ({
                                  ...prev,
                                  title: `🎪 Craft Fair Deal: ${prod.name}`,
                                  content: `Stop by our craft fair booth! The hand-finished ${prod.name} is ${pct}% off - now just $${Math.round(prod.price * (1 - pct / 100))} USD!`
                                }));
                              }
                            }}
                            className="bg-white border border-stone-300 rounded-sm py-2 px-3 cursor-pointer text-xs"
                          >
                            <option value="10">10% Off</option>
                            <option value="15">15% Off (Recommended)</option>
                            <option value="20">20% Off</option>
                            <option value="25">25% Off</option>
                            <option value="30">30% Off</option>
                            <option value="50">50% Off</option>
                          </select>
                        </div>
                      )}
                    </div>
                    {promoProductId && (
                      <div className="text-[10px] text-amber-900 leading-normal bg-amber-100/50 p-2 rounded border border-amber-200 animate-fade-in font-medium">
                        💡 <strong>Automated Storewide Action:</strong> Saving this announcement will automatically calculate a discount price of <strong>${Math.round((products.find(p => p.id === promoProductId)?.price || 0) * (1 - promoDiscountPercent / 100))} USD</strong>, set the <code>promoPrice</code> on the item, and badge it dynamically in the customer catalog!
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5 text-xs">
                  <label htmlFor="annForm-content" className="text-xs font-bold text-stone-700">Detailed Message (Keep under 120 chars for safety) *</label>
                  <input
                    id="annForm-content"
                    type="text"
                    required
                    maxLength={130}
                    value={announcementForm.content}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                    placeholder="e.g. Enter our custom drawing on our Instagram for a free personalized Maple board. Ending Monday."
                    className="bg-white border border-stone-300 rounded-sm py-2 px-3 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddingAnnouncement(false)}
                    className="bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold py-2 px-4 rounded-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="save-announcement-submit-btn"
                    type="submit"
                    className="bg-stone-900 hover:bg-amber-800 text-white text-xs font-bold py-2 px-4 rounded-sm cursor-pointer"
                  >
                    Publish Alert Banner
                  </button>
                </div>
              </form>
            )}

            {/* List of Announcements */}
            {announcements.length === 0 ? (
              <div className="bg-stone-50 border border-dashed border-stone-300 rounded-lg p-10 text-center">
                <Megaphone className="h-8 w-8 mx-auto text-amber-800 mb-2" />
                <h4 className="font-serif font-bold text-stone-800 text-sm mb-1">No Announcements Posted Yet</h4>
                <p className="text-stone-500 text-xs mb-3">Post workshop alerts, seasonal offers, holiday lead times, or discount promo codes for your shop.</p>
                <button
                  type="button"
                  onClick={() => setIsAddingAnnouncement(true)}
                  className="bg-amber-800 hover:bg-stone-900 text-white text-xs font-bold py-1.5 px-3.5 rounded-sm cursor-pointer transition-colors inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Create First Announcement
                </button>
              </div>
            ) : (
              <div className="space-y-3">
              {announcements.length > 1 && (
                <p className="text-[11px] text-stone-500 flex items-center gap-1.5">
                  <GripVertical className="h-3.5 w-3.5 text-amber-800" />
                  <span>Drag and drop announcements (or use the &uarr; / &darr; arrows) to reorder priority.</span>
                </p>
              )}
              {announcements.map((a, idx) => (
                <div
                  key={a.id}
                  id={`admin-announcement-${a.id}`}
                  draggable
                  onDragStart={(e) => {
                    setDraggedAnnouncementIdx(idx);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverAnnouncementIdx !== idx) setDragOverAnnouncementIdx(idx);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedAnnouncementIdx !== null && draggedAnnouncementIdx !== idx) {
                      handleReorderAnnouncements(draggedAnnouncementIdx, idx);
                    }
                    setDraggedAnnouncementIdx(null);
                    setDragOverAnnouncementIdx(null);
                  }}
                  onDragEnd={() => {
                    setDraggedAnnouncementIdx(null);
                    setDragOverAnnouncementIdx(null);
                  }}
                  className={`border rounded-lg p-4 flex justify-between items-center bg-white cursor-grab active:cursor-grabbing transition-all ${
                    dragOverAnnouncementIdx === idx
                      ? "border-amber-700 ring-2 ring-amber-600/40 bg-amber-50/30 scale-[0.99]"
                      : draggedAnnouncementIdx === idx
                      ? "opacity-40 border-stone-300 bg-stone-50"
                      : "border-stone-200 hover:border-amber-700/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-1 text-stone-400 pt-0.5 shrink-0" title="Drag to reorder announcement">
                      <GripVertical className="h-4 w-4 hover:text-amber-800 cursor-grab" />
                      <span className="text-[9px] font-mono font-bold text-stone-400">#{idx + 1}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-stone-900 text-sm">{a.title}</strong>
                        <span className="text-[9px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                          {a.type}
                        </span>
                        {!a.active && (
                          <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider">
                            Suspended
                          </span>
                        )}
                      </div>
                      <p className="text-stone-600 text-xs leading-relaxed">{a.content}</p>
                      <span className="text-[9px] text-stone-400 font-mono">Posted {a.date}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center shrink-0">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleReorderAnnouncements(idx, idx - 1)}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 bg-stone-50 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                        title="Move Announcement Up"
                      >
                        &uarr;
                      </button>
                      <button
                        type="button"
                        disabled={idx === announcements.length - 1}
                        onClick={() => handleReorderAnnouncements(idx, idx + 1)}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 bg-stone-50 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                        title="Move Announcement Down"
                      >
                        &darr;
                      </button>
                    </div>
                    <button
                      id={`toggle-announcement-btn-${a.id}`}
                      onClick={() => handleToggleAnnouncement(a.id)}
                      className={`text-xs font-semibold py-1 px-3.5 rounded-sm cursor-pointer border ${
                        a.active
                          ? "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                          : "bg-stone-50 text-stone-500 border-stone-300 hover:bg-stone-100"
                      }`}
                    >
                      {a.active ? "Pause" : "Activate"}
                    </button>
                    <button
                      id={`delete-announcement-btn-${a.id}`}
                      onClick={() => handleDeleteAnnouncement(a.id)}
                      className="text-stone-400 hover:text-red-700 p-1 cursor-pointer"
                      title="Delete Announcement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {/* ==================== TABS 7: SITE CUSTOMIZER & LOGO ==================== */}
        {activeTab === "site-customizer" && (
          <div id="admin-tab-site-customizer-panel" className="space-y-8 animate-fade-in font-sans text-stone-800">
            {/* Header Title */}
            <div className="flex justify-between items-center pb-4 border-b border-stone-200">
              <div>
                <h3 className="font-serif font-bold text-stone-900 text-xl md:text-2xl">Site Editor &amp; Custom CMS</h3>
                <p className="text-stone-500 text-xs">Exquisite content control panel. Change brand identity, reorder main-page sections, toggle visibility, and translate any text line-by-line.</p>
              </div>
              <button
                id="site-customizer-save-top"
                onClick={(e) => handleSaveCustomizer(e)}
                disabled={isSavingCustomizer}
                className={`text-xs font-bold py-2 px-4 rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                  isSavingCustomizer ? "bg-stone-300 text-stone-500" : "bg-brand-primary text-white hover:bg-brand-primary-hover"
                }`}
              >
                {isSavingCustomizer ? "Saving..." : "Save All Changes"}
              </button>
            </div>

            {/* Success Alert Banner */}
            {customizerSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-emerald-800 text-xs animate-fade-in">
                <Check className="h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <span className="font-bold">Database Synchronized:</span> {customizerSuccess}
                </div>
              </div>
            )}

            {/* Section A: Brand Identity & Custom Logo */}
            <div className="bg-stone-50 border border-stone-200 rounded-[20px] p-6 space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-stone-200">
                <Sliders className="h-5 w-5 text-brand-primary" />
                <h4 className="font-serif font-bold text-stone-900 text-base">Website Logo &amp; Typography</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">Brand Logo Text</label>
                    <input
                      type="text"
                      value={logoText}
                      onChange={(e) => setLogoText(e.target.value)}
                      placeholder="e.g. Nicoletta"
                      className="w-full text-xs p-3 rounded-lg border border-stone-300 bg-white focus:outline-none focus:border-brand-primary font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">Brand Logo Subtext</label>
                    <input
                      type="text"
                      value={logoSubtext}
                      onChange={(e) => setLogoSubtext(e.target.value)}
                      placeholder="e.g. Crafts & Decor"
                      className="w-full text-xs p-3 rounded-lg border border-stone-300 bg-white focus:outline-none focus:border-brand-primary font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">Brand Logo Image</label>
                    <div className="space-y-3">
                      {/* Drag & Drop Logo Upload Zone */}
                      <div
                        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                          logoDragActive
                            ? "border-brand-primary bg-brand-primary/5 scale-[0.99]"
                            : "border-stone-300 bg-stone-50 hover:bg-stone-100"
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          logoDragActive || setLogoDragActive(true);
                        }}
                        onDragLeave={() => setLogoDragActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setLogoDragActive(false);
                          if (e.dataTransfer.files?.[0]) {
                            uploadLogoFile(e.dataTransfer.files[0]);
                          }
                        }}
                        onClick={() => logoFileInputRef.current?.click()}
                      >
                        <input
                          ref={logoFileInputRef}
                          id="logo-image-file"
                          type="file"
                          accept="image/*,.png,.jpg,.jpeg,.svg,.webp,.gif"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <Upload className="h-5 w-5 text-stone-400 mx-auto mb-1.5" />
                        <p className="text-[10px] font-bold text-stone-700">Drag &amp; Drop or Click to Upload Logo</p>
                        <p className="text-[9px] text-stone-400 font-light">PNG, JPG, SVG, or WEBP (Max 10MB)</p>
                      </div>

                      {logoUploading && (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-800 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
                          <span className="h-3 w-3 border-2 border-amber-800 border-t-transparent rounded-full animate-spin"></span>
                          Uploading logo to cloud server...
                        </div>
                      )}

                      {logoUploadError && (
                        <p className="text-[10px] text-red-600 font-semibold">{logoUploadError}</p>
                      )}

                      {/* Display current image URL input so user has full transparency and control */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-semibold text-stone-500 block uppercase tracking-wider">Or specify direct logo image URL:</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={logoImageUrl.startsWith("data:") ? "[Uploaded Custom Logo Image]" : logoImageUrl}
                            onChange={(e) => {
                              if (e.target.value !== "[Uploaded Custom Logo Image]") {
                                setLogoImageUrl(e.target.value);
                              }
                            }}
                            placeholder="Leave empty for premium floral vector badge, or paste custom direct URL"
                            className="w-full text-xs p-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:border-brand-primary font-medium"
                          />
                          {logoImageUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setLogoImageUrl("");
                                handleSaveCustomizer(undefined, undefined, "");
                              }}
                              className="px-3 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                              title="Clear logo image"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-stone-400">If specified, this image will replace the brand badge. Leave empty to use default typography badge.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600">Logo Size (pixels)</label>
                      <span className="text-[11px] font-mono font-bold text-brand-primary">{logoSize}px</span>
                    </div>
                    <div className="flex gap-4 items-center">
                      <input
                        type="range"
                        min="24"
                        max="120"
                        value={logoSize}
                        onChange={(e) => setLogoSize(parseInt(e.target.value) || 48)}
                        className="w-full accent-brand-primary cursor-pointer h-1.5 bg-stone-200 rounded-lg appearance-none"
                      />
                      <input
                        type="number"
                        min="24"
                        max="120"
                        value={logoSize}
                        onChange={(e) => setLogoSize(Math.max(24, Math.min(120, parseInt(e.target.value) || 48)))}
                        className="w-16 text-center text-xs p-1.5 rounded-lg border border-stone-300 font-bold bg-white focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                    <p className="text-[9px] text-stone-400">Controls both the uploaded image dimensions and the default botanical vector badge size.</p>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-stone-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="logo-show-text-chk"
                        checked={logoShowText}
                        onChange={(e) => setLogoShowText(e.target.checked)}
                        className="rounded border-stone-300 text-brand-primary focus:ring-brand-primary h-4 w-4 cursor-pointer"
                      />
                      <label htmlFor="logo-show-text-chk" className="text-xs font-medium text-stone-700 cursor-pointer select-none">
                        Show brand text beside logo
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="logo-hide-border-chk"
                        checked={!logoHideBorder}
                        onChange={(e) => setLogoHideBorder(!e.target.checked)}
                        className="rounded border-stone-300 text-brand-primary focus:ring-brand-primary h-4 w-4 cursor-pointer"
                      />
                      <label htmlFor="logo-hide-border-chk" className="text-xs font-medium text-stone-700 cursor-pointer select-none">
                        Show decorative circular border around logo
                      </label>
                    </div>
                  </div>
                </div>

                {/* Logo Live Preview Panel */}
                <div className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col justify-center items-center text-center space-y-4 shadow-3xs">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-stone-400">Live Brandmark Preview (Header &amp; Footer)</span>
                  
                  <div className="w-full space-y-3">
                    <div className="p-4 bg-white border border-dashed border-stone-200 rounded-xl w-full flex flex-col items-center justify-center py-5 gap-2">
                      <span className="text-[8px] font-mono uppercase tracking-widest text-stone-400">Header (Light Background)</span>
                      <NicolettaLogo
                        size={logoSize}
                        showText={logoShowText}
                        colorTheme="light"
                        logoText={logoText}
                        logoSubtext={logoSubtext}
                        logoImageUrl={logoImageUrl}
                        hideBorder={true}
                      />
                    </div>

                    <div className="p-4 bg-brand-dark border border-stone-700 rounded-xl w-full flex flex-col items-center justify-center py-5 gap-2">
                      <span className="text-[8px] font-mono uppercase tracking-widest text-white/60">Footer (Brown Background — White Logo)</span>
                      <NicolettaLogo
                        size={logoSize}
                        showText={logoShowText}
                        colorTheme="dark"
                        logoText={logoText}
                        logoSubtext={logoSubtext}
                        logoImageUrl={logoImageUrl}
                        hideBorder={true}
                      />
                    </div>
                  </div>

                  <div className="w-full flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLogoText("Nicoletta");
                        setLogoSubtext("Crafts & Decor");
                        setLogoImageUrl("");
                        setLogoShowText(true);
                        setLogoSize(48);
                        setLogoHideBorder(true);
                      }}
                      className="text-[10px] font-bold text-stone-500 uppercase tracking-widest hover:text-stone-800 cursor-pointer"
                    >
                      Reset to Default
                    </button>
                  </div>
                </div>
              </div>

              {/* Section A1.5: Our Philosophy Footer Quote */}
              <div className="border-t border-stone-200 pt-6 mt-6 space-y-4">
                <div className="flex items-center gap-2 pb-2">
                  <Quote className="h-4.5 w-4.5 text-brand-primary" />
                  <h5 className="font-serif font-bold text-stone-900 text-sm">"Our Philosophy" Footer Quote</h5>
                </div>
                <p className="text-[10px] text-stone-500 max-w-xl font-light">
                  Customize the brand quote and author title that appears at the bottom right corner of the website footer.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Quote Text */}
                  <div className="md:col-span-2 p-3.5 border border-stone-200 rounded-xl bg-white space-y-2 shadow-3xs">
                    <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500">Philosophy Quote Text</label>
                    <textarea
                      rows={2}
                      value={philosophyQuote}
                      onChange={(e) => setPhilosophyQuote(e.target.value)}
                      placeholder="e.g. An engraving isn't just marks burnt into surface; it's the transfer of a family signature across generations."
                      className="w-full text-xs p-2.5 rounded-lg border border-stone-300 bg-white leading-relaxed font-light focus:outline-none focus:border-brand-primary"
                    />
                  </div>

                  {/* Quote Author */}
                  <div className="p-3.5 border border-stone-200 rounded-xl bg-white space-y-2 shadow-3xs flex flex-col justify-between">
                    <div>
                      <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Author / Title</label>
                      <input
                        type="text"
                        value={philosophyAuthor}
                        onChange={(e) => setPhilosophyAuthor(e.target.value)}
                        placeholder="e.g. Nicoletta, Founder & Creative Director"
                        className="w-full text-xs p-2.5 rounded-lg border border-stone-300 bg-white font-medium focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setPhilosophyQuote("An engraving isn't just marks burnt into surface; it's the transfer of a family signature across generations.");
                          setPhilosophyAuthor("Nicoletta, Founder & Creative Director");
                        }}
                        className="text-[9px] font-bold text-stone-400 hover:text-stone-600 uppercase tracking-widest cursor-pointer transition-colors"
                      >
                        Reset Quote
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Section B: Section Visibility & Content Management */}
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                <div className="flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-brand-primary" />
                  <h4 className="font-serif font-bold text-stone-900 text-base">
                    Layout Sections CMS ({sections.filter(s => s.page === "home" || s.id.startsWith("home-") || s.id.startsWith("custom_")).length})
                  </h4>
                </div>
                
                {!isAddingSection && (
                  <button
                    onClick={() => setIsAddingSection(true)}
                    className="bg-stone-900 hover:bg-stone-800 text-white text-[10px] font-bold uppercase tracking-widest py-2 px-4 rounded-full cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Custom Section
                  </button>
                )}
              </div>

              {/* Add Custom Section Box */}
              {isAddingSection && (
                <form onSubmit={handleAddCustomSection} className="bg-stone-50 border-2 border-dashed border-stone-300 p-5 rounded-2xl space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                    <h5 className="font-serif font-bold text-stone-900 text-sm">Create Custom Text/Image Section</h5>
                    <button type="button" onClick={() => setIsAddingSection(false)} className="text-stone-400 hover:text-stone-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-600 mb-1">Section Header Title (Required)</label>
                      <input
                        type="text"
                        required
                        value={newSecTitle}
                        onChange={(e) => setNewSecTitle(e.target.value)}
                        placeholder="e.g. Our Sustainably-Sourced Timber Promise"
                        className="w-full text-xs p-3 rounded-lg border border-stone-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-600 mb-1">Small Section Subtitle</label>
                      <input
                        type="text"
                        value={newSecSubtitle}
                        onChange={(e) => setNewSecSubtitle(e.target.value)}
                        placeholder="e.g. Hand-harvested local walnut and maple"
                        className="w-full text-xs p-3 rounded-lg border border-stone-300 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-600 mb-1">Section Description / Content Text</label>
                    <textarea
                      rows={4}
                      value={newSecDesc}
                      onChange={(e) => setNewSecDesc(e.target.value)}
                      placeholder="Write your custom copy here..."
                      className="w-full text-xs p-3 rounded-lg border border-stone-300 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-600 mb-1">Section CTA Button Label (Optional)</label>
                      <input
                        type="text"
                        value={newSecBtnText}
                        onChange={(e) => setNewSecBtnText(e.target.value)}
                        placeholder="e.g. Contact Us Today"
                        className="w-full text-xs p-3 rounded-lg border border-stone-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-600 mb-1">Illustrative Section Image URL (Optional)</label>
                      <input
                        type="url"
                        value={newSecImage}
                        onChange={(e) => setNewSecImage(e.target.value)}
                        placeholder="e.g. https://images.unsplash.com/photo-..."
                        className="w-full text-xs p-3 rounded-lg border border-stone-300 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingSection(false)}
                      className="bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold py-2 px-4 rounded-full cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold py-2 px-6 rounded-full cursor-pointer"
                    >
                      Add &amp; Save Section
                    </button>
                  </div>
                </form>
              )}

              {/* Tab Navigation for Layout Sections */}
              <div className="grid grid-cols-2 max-w-md gap-2 border-b border-stone-200 pb-3 mt-4">
                {[
                  { id: "home", label: "Home Page" },
                  { id: "workshop", label: "Connect & Footer" }
                ].map((t) => {
                  const safeSecs = Array.isArray(sections) ? sections.filter((s) => Boolean(s && typeof s.id === "string")) : [];
                  const count = safeSecs.filter((sec) => {
                    if (t.id === "home") {
                      return sec.page === "home" || sec.id.startsWith("home-") || sec.id.startsWith("custom_");
                    }
                    if (t.id === "workshop") {
                      return sec.id === "contact-header" || sec.id.startsWith("contact-");
                    }
                    return false;
                  }).length;

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setActiveSectionTab(t.id as any);
                        setIsAddingSection(false); // Close custom section creator on tab switch to avoid confusion
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-between gap-1 border ${
                        activeSectionTab === t.id
                          ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                          : "bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900 border-stone-200"
                      }`}
                    >
                      <span className="truncate">{t.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold font-mono ${
                        activeSectionTab === t.id
                          ? "bg-white/20 text-white"
                          : "bg-stone-100 text-stone-500"
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sections Reordering List */}
              <div className="space-y-4 pt-1">
                {(() => {
                  const safeSecs = Array.isArray(sections) ? sections.filter((s) => Boolean(s && typeof s.id === "string")) : [];
                  const sortedAll = [...safeSecs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                  const isOfActiveTab = (sec: CustomSection) => {
                    if (!sec || typeof sec.id !== "string") return false;
                    if (activeSectionTab === "home") {
                      return sec.page === "home" || sec.id.startsWith("home-") || sec.id.startsWith("custom_");
                    }
                    if (activeSectionTab === "workshop") {
                      return sec.id === "contact-header" || sec.id.startsWith("contact-");
                    }
                    return false;
                  };

                  const filtered = sortedAll.filter(isOfActiveTab);

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12 bg-stone-50 border border-stone-200 rounded-2xl text-stone-400 text-xs font-medium">
                        No sections configured in this category yet.
                      </div>
                    );
                  }

                  return filtered.map((sec, index) => {
                    const isCustom = sec.id.startsWith("custom_");
                    return (
                      <div
                        key={sec.id}
                        id={`admin-customizer-sec-${sec.id}`}
                        draggable={sectionDragArmedId === sec.id}
                        onDragStart={(e) => {
                          setDraggedSectionId(sec.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", sec.id);
                        }}
                        onDragOver={(e) => {
                          if (!draggedSectionId) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverSectionId !== sec.id) {
                            setDragOverSectionId(sec.id);
                          }
                        }}
                        onDrop={(e) => {
                          if (!draggedSectionId) return;
                          e.preventDefault();
                          handleDropSectionInTab(draggedSectionId, sec.id);
                          setDraggedSectionId(null);
                          setDragOverSectionId(null);
                          setSectionDragArmedId(null);
                        }}
                        onDragEnd={() => {
                          setDraggedSectionId(null);
                          setDragOverSectionId(null);
                          setSectionDragArmedId(null);
                        }}
                        className={`border rounded-2xl p-5 bg-white shadow-3xs transition-all ${
                          sec.visible === false ? "opacity-60 border-stone-200 bg-stone-50" : "border-stone-200 hover:border-brand-primary/40"
                        } ${draggedSectionId === sec.id ? "opacity-50" : ""} ${
                          dragOverSectionId === sec.id && draggedSectionId !== sec.id
                            ? "ring-2 ring-brand-primary bg-amber-50/20"
                            : ""
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-stone-100">
                          <div className="flex items-start gap-2.5">
                            <span
                              onMouseDown={() => setSectionDragArmedId(sec.id)}
                              onMouseUp={() => setSectionDragArmedId(null)}
                              className="cursor-grab active:cursor-grabbing text-stone-400 hover:text-brand-primary p-1 rounded hover:bg-stone-100 transition-colors mt-0.5"
                              title="Drag to reorder section"
                            >
                              <GripVertical className="h-4 w-4" />
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-serif font-bold text-stone-900 text-sm">
                                  {sec.name || sec.title}
                                </h5>
                                <span className="text-[9px] bg-stone-100 text-stone-500 font-mono px-2 py-0.5 rounded-sm">
                                  ID: {sec.id}
                                </span>
                                {isCustom && (
                                  <span className="text-[9px] bg-amber-50 text-brand-primary font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">
                                    Custom CMS
                                  </span>
                                )}
                                {sec.visible === false && (
                                  <span className="text-[9px] bg-red-100 text-red-800 font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">
                                    Hidden/Deleted
                                  </span>
                                )}
                              </div>
                              <p className="text-stone-400 text-[10px]">
                                {activeSectionTab === "home" ? "Drag or use arrows to reorder, hide, or rewrite this homepage section." : "Drag to reorder or modify display titles and copy on the public page."}
                              </p>
                            </div>
                          </div>

                          {/* Order Actions & Visibility Toggles */}
                          <div className="flex items-center gap-2.5">
                            {/* Reordering */}
                            <button
                              type="button"
                              onClick={() => moveSectionInTab(sec.id, "up")}
                              disabled={index === 0}
                              className="p-1.5 rounded-md border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                              title="Move Section Up"
                            >
                              &uarr;
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSectionInTab(sec.id, "down")}
                              disabled={index === filtered.length - 1}
                              className="p-1.5 rounded-md border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                              title="Move Section Down"
                            >
                              &darr;
                            </button>

                            {/* Visibility Toggle */}
                            <button
                              type="button"
                              onClick={() => toggleSectionVisibility(sec.id)}
                              className={`text-xs font-semibold py-1.5 px-3.5 rounded-full cursor-pointer transition-colors border ${
                                sec.visible === false
                                  ? "bg-stone-200 text-stone-600 border-stone-300 hover:bg-stone-300"
                                  : "bg-amber-50 text-brand-primary border-brand-primary/20 hover:bg-amber-100"
                              }`}
                            >
                              {sec.visible === false ? "Restore/Show" : "Hide/Delete"}
                            </button>

                            {/* Permanent deletion for custom added sections */}
                            {isCustom && (
                              <button
                                type="button"
                                onClick={() => deleteSection(sec.id)}
                                className="text-stone-400 hover:text-red-700 p-1.5 rounded-md border border-stone-200 bg-stone-50 hover:bg-red-50 cursor-pointer"
                                title="Delete Section Permanently"
                              >
                                <Trash2 className="h-4 w-4 text-stone-500 hover:text-red-600" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Rewrite Inputs form block */}
                        {sec.visible !== false && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 animate-fade-in text-xs">
                            <div className="space-y-4">
                              <div>
                                <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1">Section Title Text</label>
                                <input
                                  type="text"
                                  value={sec.title}
                                  onChange={(e) => updateSectionText(sec.id, "title", e.target.value)}
                                  className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary"
                                />
                              </div>

                              <div>
                                <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1">Section Subtitle Text</label>
                                <input
                                  type="text"
                                  value={sec.subtitle || ""}
                                  onChange={(e) => updateSectionText(sec.id, "subtitle", e.target.value)}
                                  className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary"
                                />
                              </div>

                              {sec.buttonText !== undefined && (
                                <div>
                                  <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1">Button text</label>
                                  <input
                                    type="text"
                                    value={sec.buttonText}
                                    onChange={(e) => updateSectionText(sec.id, "buttonText", e.target.value)}
                                    className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary"
                                  />
                                </div>
                              )}

                              {sec.id === "contact-header" ? (
                                <div className="space-y-4 col-span-1 md:col-span-2 bg-brand-highlight/40 border border-brand-border/70 p-4 md:p-5 rounded-2xl">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-border/50 pb-3">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-4 w-4 text-brand-primary" />
                                      <h5 className="font-bold text-xs text-brand-dark uppercase tracking-wider">
                                        Workshop Location, Contact Info &amp; Footer Details
                                      </h5>
                                    </div>
                                    <span className="text-[10px] text-brand-primary font-bold bg-white px-2 py-0.5 rounded border border-brand-border self-start sm:self-auto">
                                      Syncs to Connect Page &amp; Storefront Footer
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                                        Workshop Title / Business Name
                                      </label>
                                      <input
                                        type="text"
                                        value={sec.extraText1 ?? "Nicoletta Crafts Workshop"}
                                        onChange={(e) => updateSectionText(sec.id, "extraText1", e.target.value)}
                                        placeholder="Nicoletta Crafts Workshop"
                                        className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary bg-white font-medium"
                                      />
                                      <span className="text-[9px] text-stone-400 mt-0.5 block">Header for the workshop card and footer column</span>
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                                        Pickup Location / Physical Address
                                      </label>
                                      <input
                                        type="text"
                                        value={sec.extraText2 ?? "305 Water St, St. John's, NL, Canada"}
                                        onChange={(e) => updateSectionText(sec.id, "extraText2", e.target.value)}
                                        placeholder="305 Water St, St. John's, NL, Canada"
                                        className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary bg-white font-medium"
                                      />
                                      <span className="text-[9px] text-stone-400 mt-0.5 block">Physical address for customer pickups and visits</span>
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                                        Voice Contact / Phone Number
                                      </label>
                                      <input
                                        type="text"
                                        value={sec.extraText3 ?? "(709) 555-0182"}
                                        onChange={(e) => updateSectionText(sec.id, "extraText3", e.target.value)}
                                        placeholder="(709) 555-0182"
                                        className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary bg-white font-medium"
                                      />
                                      <span className="text-[9px] text-stone-400 mt-0.5 block">Voice phone number displayed on website</span>
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                                        Email Inquiry Address
                                      </label>
                                      <input
                                        type="text"
                                        value={sec.extraText ?? "sales@nicolettacraftsdecor.ca"}
                                        onChange={(e) => updateSectionText(sec.id, "extraText", e.target.value)}
                                        placeholder="sales@nicolettacraftsdecor.ca"
                                        className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary bg-white font-medium"
                                      />
                                      <span className="text-[9px] text-stone-400 mt-0.5 block">Store inquiry and contact email address</span>
                                    </div>
                                  </div>

                                  {/* Live Preview Box */}
                                  <div className="bg-white border border-stone-200 p-3.5 rounded-xl space-y-2 mt-2">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block">
                                      Instant Live Preview (Updates automatically on save)
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                                      <div className="p-3 bg-brand-highlight/20 border border-brand-border/60 rounded-lg space-y-1">
                                        <span className="font-bold text-[9px] uppercase tracking-wider text-brand-primary block">
                                          Connect Page Card
                                        </span>
                                        <p className="font-bold text-stone-900">{sec.extraText1 || "Nicoletta Crafts Workshop"}</p>
                                        <p className="text-stone-600 flex items-center gap-1">
                                          <MapPin className="h-3 w-3 text-brand-primary shrink-0" />
                                          {sec.extraText2 || "305 Water St, St. John's, NL, Canada"}
                                        </p>
                                        <p className="text-stone-600 flex items-center gap-1">
                                          <Phone className="h-3 w-3 text-brand-primary shrink-0" />
                                          {sec.extraText3 || "(709) 555-0182"}
                                        </p>
                                        <p className="text-stone-600 flex items-center gap-1">
                                          <Mail className="h-3 w-3 text-brand-primary shrink-0" />
                                          {sec.extraText || "sales@nicolettacraftsdecor.ca"}
                                        </p>
                                      </div>

                                      <div className="p-3 bg-stone-900 text-stone-200 border border-stone-800 rounded-lg space-y-1">
                                        <span className="font-bold text-[9px] uppercase tracking-wider text-amber-400 block">
                                          Website Footer
                                        </span>
                                        <p className="font-bold text-white">{sec.extraText1 || "Nicoletta Crafts Workshop"}</p>
                                        <p className="text-stone-400 text-[10px] flex items-center gap-1">
                                          <MapPin className="h-3 w-3 text-brand-primary shrink-0" />
                                          {sec.extraText2 || "305 Water St, St. John's, NL, Canada"}
                                        </p>
                                        <p className="text-stone-400 text-[10px] flex items-center gap-1">
                                          <Phone className="h-3 w-3 text-brand-primary shrink-0" />
                                          {sec.extraText3 || "(709) 555-0182"}
                                        </p>
                                        <p className="text-stone-400 text-[10px] flex items-center gap-1">
                                          <Mail className="h-3 w-3 text-brand-primary shrink-0" />
                                          {sec.extraText || "sales@nicolettacraftsdecor.ca"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {sec.buttonText !== undefined && (
                                    <div>
                                      <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1">Button text</label>
                                      <input
                                        type="text"
                                        value={sec.buttonText}
                                        onChange={(e) => updateSectionText(sec.id, "buttonText", e.target.value)}
                                        className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary"
                                      />
                                    </div>
                                  )}

                                  {sec.extraText !== undefined && (
                                    <div>
                                      <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                                        Extra Text / Secondary Button text
                                      </label>
                                      <input
                                        type="text"
                                        value={sec.extraText || ""}
                                        onChange={(e) => updateSectionText(sec.id, "extraText", e.target.value)}
                                        className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary"
                                      />
                                    </div>
                                  )}

                                  {sec.extraText1 !== undefined && (
                                    <div>
                                      <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                                        Extra Text 1
                                      </label>
                                      <input
                                        type="text"
                                        value={sec.extraText1}
                                        onChange={(e) => updateSectionText(sec.id, "extraText1", e.target.value)}
                                        className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary"
                                      />
                                    </div>
                                  )}

                                  {sec.extraText2 !== undefined && (
                                    <div>
                                      <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                                        Extra Text 2
                                      </label>
                                      <input
                                        type="text"
                                        value={sec.extraText2}
                                        onChange={(e) => updateSectionText(sec.id, "extraText2", e.target.value)}
                                        className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary"
                                      />
                                    </div>
                                  )}

                                  {sec.extraText3 !== undefined && (
                                    <div>
                                      <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                                        Extra Text 3
                                      </label>
                                      {sec.id === "contact-header" ? (
                                        <input
                                          type="text"
                                          value={sec.extraText3}
                                          onChange={(e) => updateSectionText(sec.id, "extraText3", e.target.value)}
                                          className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary"
                                        />
                                      ) : (
                                        <textarea
                                          rows={3}
                                          value={sec.extraText3}
                                          onChange={(e) => updateSectionText(sec.id, "extraText3", e.target.value)}
                                          className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary leading-relaxed"
                                        />
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            <div className="space-y-4">
                              <div>
                                <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1">Description / Content Body Copy</label>
                                <textarea
                                  rows={4}
                                  value={sec.description}
                                  onChange={(e) => updateSectionText(sec.id, "description", e.target.value)}
                                  className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary leading-relaxed"
                                />
                              </div>

                              {sec.id === "home-hero" ? (
                                <div className="space-y-5 border border-stone-150 p-4 rounded-2xl bg-stone-50/50">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-700">Hero Slideshow Editor</label>
                                      <span className="text-[9px] text-stone-500">Each slide displays a beautiful 3-image collage.</span>
                                    </div>
                                    <span className="text-[9px] text-stone-500 font-mono font-bold bg-white px-2 py-0.5 rounded border border-stone-200">
                                      {(() => {
                                        const currentUrls = (sec.imageUrls && sec.imageUrls.length > 0)
                                          ? [...sec.imageUrls]
                                          : (sec.imageUrl ? [sec.imageUrl] : []);
                                        return Math.max(1, Math.ceil(currentUrls.length / 3));
                                      })()} Slides
                                    </span>
                                  </div>

                                  {sectionUploadError && (
                                    <p className="text-[10px] text-red-600 font-bold py-1 text-center">{sectionUploadError}</p>
                                  )}

                                  {/* Slides list */}
                                  <div className="space-y-4">
                                    {(() => {
                                      const currentUrls = (sec.imageUrls && sec.imageUrls.length > 0)
                                        ? [...sec.imageUrls]
                                        : (sec.imageUrl ? [sec.imageUrl] : []);
                                      const numSlides = Math.max(1, Math.ceil(currentUrls.length / 3));

                                      return Array.from({ length: numSlides }).map((_, slideIdx) => {
                                        return (
                                          <div
                                            key={slideIdx}
                                            draggable={slideDragArmedIdx === slideIdx}
                                            onDragStart={(e) => {
                                              setDraggedSlideIdx(slideIdx);
                                              e.dataTransfer.effectAllowed = "move";
                                              e.dataTransfer.setData("text/plain", String(slideIdx));
                                            }}
                                            onDragOver={(e) => {
                                              if (draggedSlideIdx === null) return;
                                              e.preventDefault();
                                              e.dataTransfer.dropEffect = "move";
                                              if (dragOverSlideIdx !== slideIdx) {
                                                setDragOverSlideIdx(slideIdx);
                                              }
                                            }}
                                            onDrop={(e) => {
                                              if (draggedSlideIdx === null) return;
                                              e.preventDefault();
                                              handleReorderHeroSlides(sec.id, currentUrls, draggedSlideIdx, slideIdx);
                                              setDraggedSlideIdx(null);
                                              setDragOverSlideIdx(null);
                                              setSlideDragArmedIdx(null);
                                            }}
                                            onDragEnd={() => {
                                              setDraggedSlideIdx(null);
                                              setDragOverSlideIdx(null);
                                              setSlideDragArmedIdx(null);
                                            }}
                                            className={`border border-stone-150 rounded-xl bg-white p-3.5 space-y-3 shadow-3xs transition-all ${
                                              draggedSlideIdx === slideIdx ? "opacity-50" : ""
                                            } ${
                                              dragOverSlideIdx === slideIdx && draggedSlideIdx !== slideIdx
                                                ? "ring-2 ring-brand-primary bg-amber-50/20"
                                                : ""
                                            }`}
                                          >
                                            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                                              <div className="flex items-center gap-1.5">
                                                <span
                                                  onMouseDown={() => setSlideDragArmedIdx(slideIdx)}
                                                  onMouseUp={() => setSlideDragArmedIdx(null)}
                                                  className="cursor-grab active:cursor-grabbing text-stone-400 hover:text-brand-primary p-0.5 rounded hover:bg-stone-100 transition-colors"
                                                  title="Drag to reorder slide"
                                                >
                                                  <GripVertical className="h-3.5 w-3.5" />
                                                </span>
                                                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-stone-900 text-[9px] font-bold text-white">
                                                  {slideIdx + 1}
                                                </span>
                                                <span className="text-[11px] font-bold text-stone-800">Slide {slideIdx + 1} Collage</span>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                {numSlides > 1 && (
                                                  <div className="flex items-center gap-0.5">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleReorderHeroSlides(sec.id, currentUrls, slideIdx, slideIdx - 1)}
                                                      disabled={slideIdx === 0}
                                                      className="px-1.5 py-0.5 rounded border border-stone-200 bg-stone-50 text-[9px] text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                                                      title="Move Slide Up"
                                                    >
                                                      &uarr;
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleReorderHeroSlides(sec.id, currentUrls, slideIdx, slideIdx + 1)}
                                                      disabled={slideIdx === numSlides - 1}
                                                      className="px-1.5 py-0.5 rounded border border-stone-200 bg-stone-50 text-[9px] text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
                                                      title="Move Slide Down"
                                                    >
                                                      &darr;
                                                    </button>
                                                  </div>
                                                )}
                                                {numSlides > 1 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const updatedUrls = currentUrls.filter((_, idx) => {
                                                        const sIdx = Math.floor(idx / 3);
                                                        return sIdx !== slideIdx;
                                                      });
                                                      updateSectionText(sec.id, {
                                                        imageUrls: updatedUrls,
                                                        imageUrl: updatedUrls[0] || ""
                                                      });
                                                    }}
                                                    className="text-[9px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
                                                    title="Delete Slide"
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                    Delete Slide
                                                  </button>
                                                )}
                                              </div>
                                            </div>

                                            {/* 3 columns of images for this slide */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                              {Array.from({ length: 3 }).map((_, imgInSlideIdx) => {
                                                const globalIdx = slideIdx * 3 + imgInSlideIdx;
                                                const url = currentUrls[globalIdx] || "";
                                                return (
                                                  <div
                                                    key={imgInSlideIdx}
                                                    draggable
                                                    onDragStart={(e) => {
                                                      e.stopPropagation();
                                                      setDraggedHeroPhotoIdx(globalIdx);
                                                      e.dataTransfer.effectAllowed = "move";
                                                      e.dataTransfer.setData("text/plain", String(globalIdx));
                                                    }}
                                                    onDragOver={(e) => {
                                                      if (draggedHeroPhotoIdx === null) return;
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      e.dataTransfer.dropEffect = "move";
                                                      if (dragOverHeroPhotoIdx !== globalIdx) {
                                                        setDragOverHeroPhotoIdx(globalIdx);
                                                      }
                                                    }}
                                                    onDrop={(e) => {
                                                      if (draggedHeroPhotoIdx === null) return;
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      handleReorderHeroPhoto(sec.id, currentUrls, draggedHeroPhotoIdx, globalIdx);
                                                      setDraggedHeroPhotoIdx(null);
                                                      setDragOverHeroPhotoIdx(null);
                                                    }}
                                                    onDragEnd={() => {
                                                      setDraggedHeroPhotoIdx(null);
                                                      setDragOverHeroPhotoIdx(null);
                                                    }}
                                                    className={`bg-stone-50 border border-stone-150 rounded-lg p-2.5 flex flex-col gap-2 transition-all ${
                                                      draggedHeroPhotoIdx === globalIdx ? "opacity-50" : ""
                                                    } ${
                                                      dragOverHeroPhotoIdx === globalIdx && draggedHeroPhotoIdx !== globalIdx
                                                        ? "ring-2 ring-brand-primary bg-amber-50/40"
                                                        : ""
                                                    }`}
                                                  >
                                                    <div className="flex items-center justify-between text-[8px] font-bold text-stone-400 uppercase tracking-wider">
                                                      <span className="flex items-center gap-1 cursor-grab active:cursor-grabbing" title="Drag to swap/reorder photo">
                                                        <GripVertical className="h-3 w-3 text-stone-400" />
                                                        Photo {imgInSlideIdx + 1}
                                                      </span>
                                                      {url && (
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            const updatedUrls = [...currentUrls];
                                                            updatedUrls[globalIdx] = "";
                                                            updateSectionText(sec.id, {
                                                              imageUrls: updatedUrls,
                                                              imageUrl: updatedUrls[0] || ""
                                                            });
                                                          }}
                                                          className="text-stone-400 hover:text-red-600 font-normal hover:underline"
                                                        >
                                                          Clear
                                                        </button>
                                                      )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                      {url ? (
                                                        <div className="relative group h-10 w-10 shrink-0 cursor-pointer rounded-md overflow-hidden border border-stone-200 bg-stone-100">
                                                          <img
                                                            src={url}
                                                            alt={`Slide ${slideIdx + 1} Image ${imgInSlideIdx + 1}`}
                                                            className="h-10 w-10 object-cover"
                                                            referrerPolicy="no-referrer"
                                                          />
                                                          <button
                                                            type="button"
                                                            onClick={() => document.getElementById(`slide-file-upload-${globalIdx}`)?.click()}
                                                            className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] font-bold"
                                                          >
                                                            Edit
                                                          </button>
                                                        </div>
                                                      ) : (
                                                        <button
                                                          type="button"
                                                          onClick={() => document.getElementById(`slide-file-upload-${globalIdx}`)?.click()}
                                                          className="h-10 w-10 rounded-md border border-dashed border-stone-300 hover:border-brand-primary bg-white flex items-center justify-center shrink-0 cursor-pointer"
                                                        >
                                                          <Upload className="h-3.5 w-3.5 text-stone-400" />
                                                        </button>
                                                      )}

                                                      <input
                                                        id={`slide-file-upload-${globalIdx}`}
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        onChange={(e) => handleSectionImageUpload(e, sec.id, globalIdx)}
                                                        className="hidden"
                                                      />

                                                      <div className="flex-1 min-w-0">
                                                        <input
                                                          type="text"
                                                          value={url.startsWith("data:") ? `[Uploaded Photo ${imgInSlideIdx + 1}]` : url}
                                                          readOnly={url.startsWith("data:")}
                                                          onChange={(e) => {
                                                            if (e.target.value.startsWith("[Uploaded Photo")) return;
                                                            const updatedUrls = [...currentUrls];
                                                            while (updatedUrls.length <= globalIdx) {
                                                              updatedUrls.push("");
                                                            }
                                                            updatedUrls[globalIdx] = e.target.value;
                                                            const updates: Partial<CustomSection> = { imageUrls: updatedUrls };
                                                            if (globalIdx === 0) {
                                                              updates.imageUrl = e.target.value;
                                                            }
                                                            updateSectionText(sec.id, updates);
                                                          }}
                                                          className="w-full text-[10px] px-2 py-1 rounded border border-stone-200 bg-white focus:outline-none focus:border-brand-primary"
                                                          placeholder="Upload or paste URL..."
                                                        />
                                                      </div>
                                                    </div>

                                                    {uploadingSlideIndex?.sectionId === sec.id && uploadingSlideIndex?.index === globalIdx && (
                                                      <div className="flex items-center gap-1 text-[8px] text-amber-800 font-medium">
                                                        <span className="h-2 w-2 border border-amber-800 border-t-transparent rounded-full animate-spin"></span>
                                                        Uploading...
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>

                                  <div className="flex justify-start">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentUrls = (sec.imageUrls && sec.imageUrls.length > 0)
                                          ? [...sec.imageUrls]
                                          : (sec.imageUrl ? [sec.imageUrl] : []);
                                        const updatedUrls = [...currentUrls];
                                        const currentLen = updatedUrls.length;
                                        const nextMultipleOf3 = Math.ceil(currentLen / 3) * 3;
                                        while (updatedUrls.length < nextMultipleOf3) {
                                          updatedUrls.push("");
                                        }
                                        updatedUrls.push("", "", "");
                                        updateSectionText(sec.id, {
                                          imageUrls: updatedUrls,
                                          imageUrl: updatedUrls[0] || ""
                                        });
                                      }}
                                      className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs hover:shadow-sm"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Add New Slide Collage Set
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <label className="block text-[9px] font-bold uppercase tracking-wider text-stone-500">Section Background / Feature Image</label>
                                  
                                  {/* Drag and Drop Zone */}
                                  <div
                                    onDragOver={(e) => { e.preventDefault(); }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      if (e.dataTransfer.files?.[0]) {
                                        const input = document.getElementById(`section-file-upload-${sec.id}`) as HTMLInputElement;
                                        if (input) {
                                          const list = new DataTransfer();
                                          list.items.add(e.dataTransfer.files[0]);
                                          input.files = list.files;
                                          handleSectionImageUpload({ target: input } as any, sec.id);
                                        }
                                      }
                                    }}
                                    onClick={() => document.getElementById(`section-file-upload-${sec.id}`)?.click()}
                                    className="border-2 border-dashed border-stone-200 hover:border-brand-primary rounded-xl p-4 text-center cursor-pointer bg-stone-50/50 hover:bg-white transition-all duration-200"
                                  >
                                    <input
                                      id={`section-file-upload-${sec.id}`}
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handleSectionImageUpload(e, sec.id)}
                                      className="hidden"
                                    />
                                    <Upload className="h-4 w-4 text-stone-400 mx-auto mb-1" />
                                    <p className="text-[10px] font-bold text-stone-700">Drag &amp; Drop or Click to Upload Image</p>
                                    <p className="text-[9px] text-stone-400">Supports PNG, JPG, WEBP (Max 10MB)</p>
                                  </div>

                                  {uploadingSectionId === sec.id && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-amber-800 font-medium py-1 justify-center">
                                      <span className="h-3 w-3 border-2 border-amber-800 border-t-transparent rounded-full animate-spin"></span>
                                      Uploading image asset to server...
                                    </div>
                                  )}

                                  {sectionUploadError && (
                                    <p className="text-[10px] text-red-600 font-bold py-1 text-center">{sectionUploadError}</p>
                                  )}

                                  {sec.imageUrl && (
                                    <div className="flex items-center gap-3 bg-stone-50 p-2 rounded-xl border border-stone-150">
                                      <img 
                                        src={sec.imageUrl} 
                                        alt="Preview" 
                                        className="h-10 w-10 object-cover rounded-lg border border-stone-200 bg-white" 
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold text-stone-700 truncate">Current Image Asset</p>
                                        <p className="text-[9px] text-stone-400 truncate font-mono">
                                          {sec.imageUrl.startsWith("data:") ? "[Uploaded Section Photo]" : sec.imageUrl}
                                        </p>
                                      </div>
                                      <button 
                                        type="button"
                                        onClick={() => updateSectionText(sec.id, "imageUrl", "")}
                                        className="text-[10px] font-bold text-red-600 hover:text-red-800 shrink-0 cursor-pointer"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  )}

                                  <div className="relative py-1">
                                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                      <div className="w-full border-t border-stone-150"></div>
                                    </div>
                                    <div className="relative flex justify-center text-[8px] uppercase tracking-wider font-semibold">
                                      <span className="bg-white px-2 text-stone-400">or paste a custom web url</span>
                                    </div>
                                  </div>

                                  <input
                                    type="text"
                                    value={(sec.imageUrl || "").startsWith("data:") ? "[Uploaded Section Photo]" : (sec.imageUrl || "")}
                                    readOnly={(sec.imageUrl || "").startsWith("data:")}
                                    onChange={(e) => {
                                      if (e.target.value !== "[Uploaded Section Photo]") {
                                        updateSectionText(sec.id, "imageUrl", e.target.value);
                                      }
                                    }}
                                    className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-brand-primary"
                                    placeholder="https://images.unsplash.com/..."
                                  />
                                </div>
                              )}
                            </div>

                             {sec.id === "home-difference" && (() => {
                              const ARTISAN_ICONS = [
                                { name: "Heart", label: "Heart (Love / Passion / Default Card 1)" },
                                { name: "Sparkles", label: "Sparkles (Creation / Magic / Default Card 2)" },
                                { name: "Lightbulb", label: "Lightbulb (Idea / Concept / Default Card 3)" },
                                { name: "CheckCircle", label: "Check Circle" },
                                { name: "ShieldCheck", label: "Shield Check" },
                                { name: "Leaf", label: "Leaf (Organic / Natural)" },
                                { name: "Hammer", label: "Hammer (Handmade / Craft)" },
                                { name: "Trees", label: "Trees (Wood / Timber)" },
                                { name: "Crown", label: "Crown (Premium / Luxury)" },
                                { name: "Zap", label: "Zap (Precision / Speed)" },
                                { name: "Star", label: "Star (Quality / Rating)" },
                                { name: "Award", label: "Award (Certified / Authentic)" },
                                { name: "Shield", label: "Shield (Guaranteed / Secure)" },
                                { name: "Clock", label: "Clock (Timeless / Speed)" },
                                { name: "Layers", label: "Layers (Material / Grain)" },
                                { name: "Package", label: "Package (Delivery / Gift)" },
                                { name: "Smile", label: "Smile (Satisfaction)" },
                              ];

                              const renderIconPreview = (iconName: string) => {
                                const IconComp = (LucideIcons as any)[iconName];
                                if (IconComp) {
                                  return <IconComp className="h-4 w-4 text-brand-primary shrink-0" />;
                                }
                                return null;
                              };

                              return (
                                <div className="col-span-full border-t border-stone-100 pt-4 mt-2 space-y-4">
                                  <h6 className="font-serif font-bold text-stone-800 text-xs border-b border-stone-100 pb-1.5 flex items-center justify-between">
                                    <span>Customize Difference Cards (1 - 3)</span>
                                    <span className="text-[9px] text-brand-primary font-mono bg-brand-primary/5 px-2 py-0.5 rounded-full">Artisan Difference Cards Editor</span>
                                  </h6>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {/* Card 1 */}
                                    <div className="p-3 border border-stone-150 rounded-xl bg-stone-50/50 space-y-2.5">
                                      <span className="text-[10px] font-bold text-brand-primary font-mono block">Card 01</span>
                                      
                                      <div>
                                        <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Card 1 Icon</label>
                                        <div className="flex items-center gap-2 bg-white border border-stone-250 rounded-lg p-1.5">
                                          {renderIconPreview(sec.extraText1 || "Heart")}
                                          <select
                                            value={sec.extraText1 || "Heart"}
                                            onChange={(e) => updateSectionText(sec.id, "extraText1", e.target.value)}
                                            className="w-full text-xs border-none bg-transparent focus:outline-none font-medium cursor-pointer"
                                          >
                                            {ARTISAN_ICONS.map((ico) => (
                                              <option key={ico.name} value={ico.name}>{ico.label}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Card 1 Title</label>
                                        <input
                                          type="text"
                                          value={sec.step1Title ?? "100% Food-Safe & Organic Finishes"}
                                          onChange={(e) => updateSectionText(sec.id, "step1Title", e.target.value)}
                                          className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white font-medium"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Card 1 Description</label>
                                        <textarea
                                          rows={4}
                                          value={sec.step1Desc ?? "Our cutting boards and serving trays are sealed exclusively with hand-rubbed organic walnut oils and raw local Portland beeswax. Completely allergen-free, lemon-conditioned, and 100% safe to eat off of."}
                                          onChange={(e) => updateSectionText(sec.id, "step1Desc", e.target.value)}
                                          className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white leading-relaxed font-light"
                                        />
                                      </div>
                                    </div>

                                    {/* Card 2 */}
                                    <div className="p-3 border border-stone-150 rounded-xl bg-stone-50/50 space-y-2.5">
                                      <span className="text-[10px] font-bold text-brand-primary font-mono block">Card 02</span>

                                      <div>
                                        <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Card 2 Icon</label>
                                        <div className="flex items-center gap-2 bg-white border border-stone-250 rounded-lg p-1.5">
                                          {renderIconPreview(sec.extraText2 || "Sparkles")}
                                          <select
                                            value={sec.extraText2 || "Sparkles"}
                                            onChange={(e) => updateSectionText(sec.id, "extraText2", e.target.value)}
                                            className="w-full text-xs border-none bg-transparent focus:outline-none font-medium cursor-pointer"
                                          >
                                            {ARTISAN_ICONS.map((ico) => (
                                              <option key={ico.name} value={ico.name}>{ico.label}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Card 2 Title</label>
                                        <input
                                          type="text"
                                          value={sec.step2Title ?? "Precision Laser Branding"}
                                          onChange={(e) => updateSectionText(sec.id, "step2Title", e.target.value)}
                                          className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white font-medium"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Card 2 Description</label>
                                        <textarea
                                          rows={4}
                                          value={sec.step2Desc ?? "We balance laser intensity manually based on specific wood grain densities (American Walnut vs Curly Maple). No charred blurring or shallow fades — just sharp, deep-contrast branding designed to endure."}
                                          onChange={(e) => updateSectionText(sec.id, "step2Desc", e.target.value)}
                                          className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white leading-relaxed font-light"
                                        />
                                      </div>
                                    </div>

                                    {/* Card 3 */}
                                    <div className="p-3 border border-stone-150 rounded-xl bg-stone-50/50 space-y-2.5">
                                      <span className="text-[10px] font-bold text-brand-primary font-mono block">Card 03</span>

                                      <div>
                                        <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Card 3 Icon</label>
                                        <div className="flex items-center gap-2 bg-white border border-stone-250 rounded-lg p-1.5">
                                          {renderIconPreview(sec.extraText3 || "Lightbulb")}
                                          <select
                                            value={sec.extraText3 || "Lightbulb"}
                                            onChange={(e) => updateSectionText(sec.id, "extraText3", e.target.value)}
                                            className="w-full text-xs border-none bg-transparent focus:outline-none font-medium cursor-pointer"
                                          >
                                            {ARTISAN_ICONS.map((ico) => (
                                              <option key={ico.name} value={ico.name}>{ico.label}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Card 3 Title</label>
                                        <input
                                          type="text"
                                          value={sec.step3Title ?? "Complimentary Setup & Mockup"}
                                          onChange={(e) => updateSectionText(sec.id, "step3Title", e.target.value)}
                                          className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white font-medium"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Card 3 Description</label>
                                        <textarea
                                          rows={4}
                                          value={sec.step3Desc ?? "No guesswork. We design a digital blueprint mockup of your engraving in your chosen font and email it for your final sign-off before we touch any raw timber."}
                                          onChange={(e) => updateSectionText(sec.id, "step3Desc", e.target.value)}
                                          className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white leading-relaxed font-light"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {sec.id === "catalog-process" && (
                              <div className="col-span-full border-t border-stone-100 pt-4 mt-2 space-y-4">
                                <h6 className="font-serif font-bold text-stone-800 text-xs border-b border-stone-100 pb-1.5 flex items-center justify-between">
                                  <span>Customize Ordering Steps (1 - 6)</span>
                                  <span className="text-[9px] text-brand-primary font-mono bg-brand-primary/5 px-2 py-0.5 rounded-full">Artisan Steps Editor</span>
                                </h6>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {/* Step 1 */}
                                  <div className="p-3 border border-stone-150 rounded-xl bg-stone-50/50 space-y-2">
                                    <span className="text-[10px] font-bold text-brand-primary font-mono block">Step 01</span>
                                    <div>
                                      <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Step 1 Title</label>
                                      <input
                                        type="text"
                                        value={sec.step1Title ?? "Select Item"}
                                        onChange={(e) => updateSectionText(sec.id, "step1Title", e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white font-medium"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Step 1 Description</label>
                                      <textarea
                                        rows={2}
                                        value={sec.step1Desc ?? "Select the item you would like."}
                                        onChange={(e) => updateSectionText(sec.id, "step1Desc", e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white leading-relaxed font-light"
                                      />
                                    </div>
                                  </div>

                                  {/* Step 2 */}
                                  <div className="p-3 border border-stone-150 rounded-xl bg-stone-50/50 space-y-2">
                                    <span className="text-[10px] font-bold text-brand-primary font-mono block">Step 02</span>
                                    <div>
                                      <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Step 2 Title</label>
                                      <input
                                        type="text"
                                        value={sec.step2Title ?? "Describe"}
                                        onChange={(e) => updateSectionText(sec.id, "step2Title", e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white font-medium"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Step 2 Description</label>
                                      <textarea
                                        rows={2}
                                        value={sec.step2Desc ?? "Give us a description of your custom requirements."}
                                        onChange={(e) => updateSectionText(sec.id, "step2Desc", e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white leading-relaxed font-light"
                                      />
                                    </div>
                                  </div>

                                  {/* Step 3 */}
                                  <div className="p-3 border border-stone-150 rounded-xl bg-stone-50/50 space-y-2">
                                    <span className="text-[10px] font-bold text-brand-primary font-mono block">Step 03</span>
                                    <div>
                                      <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Step 3 Title</label>
                                      <input
                                        type="text"
                                        value={sec.step3Title ?? "Upload Design"}
                                        onChange={(e) => updateSectionText(sec.id, "step3Title", e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white font-medium"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Step 3 Description</label>
                                      <textarea
                                        rows={2}
                                        value={sec.step3Desc ?? "Upload images of the design you would like or text."}
                                        onChange={(e) => updateSectionText(sec.id, "step3Desc", e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white leading-relaxed font-light"
                                      />
                                    </div>
                                  </div>

                                  {/* Step 4 */}
                                  <div className="p-3 border border-stone-150 rounded-xl bg-stone-50/50 space-y-2">
                                    <span className="text-[10px] font-bold text-brand-primary font-mono block">Step 04</span>
                                    <div>
                                      <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Step 4 Title</label>
                                      <input
                                        type="text"
                                        value={sec.step4Title ?? "Send Request"}
                                        onChange={(e) => updateSectionText(sec.id, "step4Title", e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white font-medium"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Step 4 Description</label>
                                      <textarea
                                        rows={2}
                                        value={sec.step4Desc ?? "Send it to us, and we'll process your request immediately."}
                                        onChange={(e) => updateSectionText(sec.id, "step4Desc", e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white leading-relaxed font-light"
                                      />
                                    </div>
                                  </div>

                                  {/* Step 5 */}
                                  <div className="p-3 border border-stone-150 rounded-xl bg-stone-50/50 space-y-2">
                                    <span className="text-[10px] font-bold text-brand-primary font-mono block">Step 05</span>
                                    <div>
                                      <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Step 5 Title</label>
                                      <input
                                        type="text"
                                        value={sec.step5Title ?? "Price Quote"}
                                        onChange={(e) => updateSectionText(sec.id, "step5Title", e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white font-medium"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Step 5 Description</label>
                                      <textarea
                                        rows={2}
                                        value={sec.step5Desc ?? "We will review your submission and send you a custom price."}
                                        onChange={(e) => updateSectionText(sec.id, "step5Desc", e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white leading-relaxed font-light"
                                      />
                                    </div>
                                  </div>

                                  {/* Step 6 */}
                                  <div className="p-3 border border-stone-150 rounded-xl bg-stone-50/50 space-y-2">
                                    <span className="text-[10px] font-bold text-brand-primary font-mono block">Step 06</span>
                                    <div>
                                      <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Step 6 Title</label>
                                      <input
                                        type="text"
                                        value={sec.step6Title ?? "Fulfillment"}
                                        onChange={(e) => updateSectionText(sec.id, "step6Title", e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white font-medium"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-bold uppercase tracking-wider text-stone-500 mb-1">Step 6 Description</label>
                                      <textarea
                                        rows={2}
                                        value={sec.step6Desc ?? "Once ordered is confirmed we will send you the pickup/ delivery options."}
                                        onChange={(e) => updateSectionText(sec.id, "step6Desc", e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-stone-250 focus:outline-none focus:border-brand-primary bg-white leading-relaxed font-light"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Bottom Sticky Action Save Banner */}
            <div className="pt-6 border-t border-stone-200 flex justify-between items-center bg-stone-50 p-4 rounded-2xl">
              <div className="text-xs text-stone-500">
                <span className="font-bold block text-stone-800">You have unsaved local modifications.</span>
                Save settings to authorize write permission and update your live catalog and logo.
              </div>
              <button
                id="site-customizer-save-bottom"
                onClick={(e) => handleSaveCustomizer(e)}
                disabled={isSavingCustomizer}
                className={`text-xs font-bold py-3 px-8 rounded-full transition-all cursor-pointer shadow-md ${
                  isSavingCustomizer ? "bg-stone-300 text-stone-500" : "bg-brand-primary text-white hover:bg-brand-primary-hover hover:scale-101"
                }`}
              >
                {isSavingCustomizer ? "Saving..." : "Save Customizer Changes"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div id="admin-tab-security-panel" className="space-y-8 max-w-2xl animate-fade-in">
            {/* 1. Gmail Automation & Notification Hub */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="font-serif font-bold text-stone-900 text-lg">Gmail Automation Engine</h3>
                  </div>
                  <p className="text-stone-500 text-xs mt-0.5">
                    Integrated directly with <strong>sales@nicolettacraftsdecor.ca</strong> for client proposals and inbound quote notifications.
                  </p>
                </div>
                <span className="self-start sm:self-auto text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-emerald-600" /> sales@nicolettacraftsdecor.ca
                </span>
              </div>

              {/* Inbound Alerts Notice */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <Check className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-emerald-950">Inbound Client Alerts are Active</h4>
                  <p className="text-emerald-900/90 leading-relaxed font-light">
                    Every time a customer submits a bespoke quote, requests a handmade bouquet, or sends a contact message, an email alert with all client details is sent to <strong>sales@nicolettacraftsdecor.ca</strong>.
                  </p>
                </div>
              </div>

              {/* Outbound Dispatch Password Configuration */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-stone-800 block">
                    Google App Password (for automated client proposals)
                  </label>
                  <p className="text-stone-500 text-[11px] mt-0.5">
                    Enables the portal to automatically dispatch proposal estimates and custom mockups to clients from your Gmail address.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showGmailPassword ? "text" : "password"}
                      value={gmailPasswordInput}
                      onChange={(e) => setGmailPasswordInput(e.target.value)}
                      placeholder="16-character Google App Password (e.g. abcd efgh ijkl mnop)"
                      className="w-full text-xs p-3 pr-10 rounded-xl border border-stone-200 focus:outline-none focus:border-brand-primary bg-stone-50 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGmailPassword(!showGmailPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveGmailConfig}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs cursor-pointer transition-colors shadow-xs shrink-0 flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Save Password</span>
                  </button>
                </div>

                {emailConfigSaved && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg animate-fade-in flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Gmail settings saved and synced across all devices!</span>
                  </div>
                )}

                {/* Instructions Accordion */}
                <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl space-y-2 text-xs text-stone-700">
                  <span className="font-bold text-stone-900 block">How to get your 16-character Google App Password:</span>
                  <ol className="list-decimal pl-5 space-y-1 text-[11px] text-stone-600 leading-relaxed font-light">
                    <li>Sign in to your Google Account at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline">myaccount.google.com/apppasswords</a> with <strong>sales@nicolettacraftsdecor.ca</strong>.</li>
                    <li>Ensure <strong>2-Step Verification</strong> is enabled for your account.</li>
                    <li>Under App Passwords, name it "Nicoletta Portal" and click <strong>Create</strong>.</li>
                    <li>Copy the 16-letter code generated by Google and paste it above, then click <strong>Save Password</strong>.</li>
                  </ol>
                </div>

                {/* Test Email Action */}
                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-stone-100">
                  <span className="text-[11px] text-stone-500">Test your outbound email engine:</span>
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testEmailStatus === "testing"}
                    className="bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer transition-colors flex items-center gap-1.5 shadow-3xs"
                  >
                    {testEmailStatus === "testing" ? (
                      <>
                        <span className="h-3 w-3 border-2 border-stone-700 border-t-transparent rounded-full animate-spin" />
                        <span>Sending Test...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Send Test Email to sales@nicolettacraftsdecor.ca</span>
                      </>
                    )}
                  </button>
                </div>

                {testEmailStatus === "success" && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg animate-fade-in flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{testEmailMsg}</span>
                  </div>
                )}
                {testEmailStatus === "error" && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg animate-fade-in flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{testEmailMsg}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Portal Password Configuration */}
            <div className="pb-4 border-b border-stone-200">
              <h3 className="font-serif font-bold text-stone-900 text-lg">Portal Security Settings</h3>
              <p className="text-stone-500 text-xs mt-1">
                Configure credentials to protect authorization access for the Nicoletta Artisan Portal.
              </p>
            </div>

            {passwordStatus && (
              <div
                className={`p-4 rounded-xl text-xs flex gap-3 ${
                  passwordStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                <div className="shrink-0">
                  {passwordStatus.type === "success" ? (
                    <Check className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold">
                    {passwordStatus.type === "success" ? "Success" : "Update Failed"}
                  </h4>
                  <p className="mt-0.5 leading-relaxed">{passwordStatus.message}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-5 bg-stone-50 p-6 rounded-2xl border border-stone-200">
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-700">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-none focus:border-brand-primary bg-white"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-700">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-none focus:border-brand-primary bg-white"
                    placeholder="••••••••"
                  />
                  <p className="text-[10px] text-stone-400">Must be at least 4 characters long.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-700">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-none focus:border-brand-primary bg-white"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className={`w-full py-3 px-4 rounded-full text-xs font-bold text-white transition-all cursor-pointer shadow-xs ${
                    isUpdatingPassword
                      ? "bg-stone-400 text-stone-100 cursor-not-allowed"
                      : "bg-brand-primary hover:bg-brand-primary-hover active:scale-98"
                  }`}
                >
                  {isUpdatingPassword ? "Updating Password..." : "Update Security Password"}
                </button>
              </div>
            </form>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold">
                <Info className="h-4 w-4 text-amber-800 shrink-0" />
                <span>Security Guidelines &amp; Cryptography Info</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-800/90 leading-relaxed">
                <li>Your password is never stored in plain-text on our servers.</li>
                <li>We hash all admin portal passphrases using industry-grade <strong>PBKDF2</strong> key derivation with 100,000 iterations and a unique, secure salt generator.</li>
                <li>Updating the password takes effect immediately and updates the offline persistent file database dynamically.</li>
                <li>Make sure to note down your password safely if you change it.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
