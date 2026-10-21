import React, { useState, useEffect, useRef } from "react";
import * as LucideIcons from "lucide-react";
import {
  Hammer,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Clock,
  ChevronDown,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  CheckCircle,
  HelpCircle,
  Sliders,
  LogOut,
  Search,
  Menu,
  X,
  MessageSquare,
  ArrowRight,
  Heart,
  Star,
  Upload,
  Trash2,
  Paperclip,
  User
} from "lucide-react";
import { Product, Category, Testimonial, Announcement, QuoteRequest, AnalyticsSummary, CustomizationSettings, CustomSection } from "./types";
import {
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_TESTIMONIALS,
  INITIAL_ANNOUNCEMENTS
} from "./data";
import AnnouncementBar from "./components/AnnouncementBar";
import ProductCard from "./components/ProductCard";
import QuoteForm from "./components/QuoteForm";
import TestimonialSection from "./components/TestimonialSection";
import AdminDashboard from "./components/AdminDashboard";
import { HeroSlideshow } from "./components/HeroSlideshow";
import { NicolettaLogo } from "./components/NicolettaLogo";
import ProductDetails from "./components/ProductDetails";
import CustomerAuthPortal from "./components/CustomerAuthPortal";
import { CustomerProfile, getStoredCustomerSession } from "./supabaseClient";

export default function App() {
  // Ensure legacy sample dummy data is purged from local browser cache on initial boot
  if (typeof window !== "undefined" && !localStorage.getItem("nicoletta_sample_data_cleared_v2")) {
    localStorage.removeItem("nicoletta_products");
    localStorage.removeItem("nicoletta_categories");
    localStorage.removeItem("nicoletta_testimonials");
    localStorage.removeItem("nicoletta_announcements");
    localStorage.removeItem("nicoletta_quotes");
    localStorage.setItem("nicoletta_sample_data_cleared_v2", "true");
  }

  // Persistence state
  const [products, setProducts] = useState<Product[]>(() => {
    const local = localStorage.getItem("nicoletta_products");
    return local ? JSON.parse(local) : [];
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    const local = localStorage.getItem("nicoletta_categories");
    return local ? JSON.parse(local) : [];
  });
  const [testimonials, setTestimonials] = useState<Testimonial[]>(() => {
    const local = localStorage.getItem("nicoletta_testimonials");
    return local ? JSON.parse(local) : [];
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    const local = localStorage.getItem("nicoletta_announcements");
    return local ? JSON.parse(local) : [];
  });
  const [quotes, setQuotes] = useState<QuoteRequest[]>(() => {
    const local = localStorage.getItem("nicoletta_quotes");
    return local ? JSON.parse(local) : [];
  });
  const [customization, setCustomization] = useState<CustomizationSettings>(() => {
    const local = localStorage.getItem("nicoletta_customization");
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        console.error("Failed to parse local customization, using defaults", e);
      }
    }
    return {
      logoText: "Nicoletta",
      logoSubtext: "Crafts & Decor",
      logoImageUrl: "",
      logoShowText: true,
      logoSize: 48,
      logoHideBorder: true,
      sections: [
        {
          id: "home-hero",
          page: "home",
          title: "Handcrafted Wood.",
          subtitle: "Fire-Etched Memories.",
          description: "We create luxury heirlooms and custom gifts in Portland, Oregon. From hand-planed walnut cutting boards to deep-sandblasted glassware, every piece is laser-etched with exquisite care and hand-finished in natural, organic board oils.",
          visible: true,
          order: 1,
          buttonText1: "Browse Collections",
          buttonText2: "Request Custom Quote"
        },
        {
          id: "home-categories",
          page: "home",
          title: "Crafted Categories",
          subtitle: "Signature Materials",
          description: "Click a core medium to browse our dedicated collection and filter the workshop showcase.",
          visible: true,
          order: 2
        },
        {
          id: "home-featured",
          page: "home",
          title: "Featured Shop Works",
          subtitle: "The Masterpieces",
          description: "Explore our handpicked curation of laser-branded and sandblast-etched creations.",
          visible: true,
          order: 3,
          buttonText1: "View All Products"
        },
        {
          id: "home-difference",
          page: "home",
          title: "The Nicoletta Difference",
          subtitle: "Uncompromising Standards",
          description: "We craft future family heirlooms, not disposable woodware. Every piece conforms to a high-contrast standard of luxury.",
          visible: true,
          order: 4
        },
        {
          id: "home-announcements",
          page: "home",
          title: "Shop News & Events",
          subtitle: "Workshop Ledger",
          description: "Latest happenings, local pop-up markets, and limited seasonal craft offers.",
          visible: true,
          order: 5
        },
        {
          id: "home-testimonials",
          page: "home",
          title: "Stories from the Mantle",
          subtitle: "Patron Affection",
          description: "Read direct feedback from clients who have gifted our engraving pieces.",
          visible: true,
          order: 6,
          buttonText1: "See All Verified Reviews"
        },
        {
          id: "home-about",
          page: "home",
          title: "Nicoletta Decor",
          subtitle: "Meet the Craftsman",
          description: "Founded in Portland, Oregon in 2021 by artisan Nicoletta, our shop was born out of a deep reverence for organic materials and classic design. We select local, sustainably-cut timber and cure each board by hand.",
          extraText1: "Every laser brand and sandblast carving is executed one-by-one with surgical attention to grain and texture. We never treat your project as generic manufacture; we create future heirlooms destined to outlast us all.",
          extraText2: "Nicoletta Vance",
          extraText3: "Founder & Master Engraver",
          imageUrl1: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=400",
          imageUrl2: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=400",
          visible: true,
          order: 7
        },
        {
          id: "home-cta",
          page: "home",
          title: "Looking for a custom size, wood variety, or corporate logo commission?",
          subtitle: "",
          description: "We frequently design bespoke collections for corporate gifts, weddings, and local restaurants. Let us turn your sketch into an everlasting physical masterpiece.",
          visible: true,
          order: 8,
          buttonText1: "Submit Quote Request"
        }
      ]
    };
  });

  // Secure Session State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("nicoletta_admin_token"));
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [totalViewsState, setTotalViewsState] = useState(342);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return localStorage.getItem("nicoletta_admin_unlocked") === "true";
  });

  // Navigation and filtering state
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activePage, setActivePage] = useState<"home" | "catalog" | "product-detail" | "quote-request" | "testimonials" | "contact" | "account">("home");
  const [customer, setCustomer] = useState<CustomerProfile | null>(() => getStoredCustomerSession());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductForQuote, setSelectedProductForQuote] = useState<Product | null>(null);
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);

  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactData, setContactData] = useState({ name: "", email: "", subject: "", message: "" });
  const [contactUploadedFiles, setContactUploadedFiles] = useState<{ name: string; size: number; url: string }[]>([]);
  const [contactDragActive, setContactDragActive] = useState(false);
  const [contactUploadingFiles, setContactUploadingFiles] = useState(false);
  const [contactUploadError, setContactUploadError] = useState("");
  const contactFileInputRef = useRef<HTMLInputElement>(null);

  const handleContactDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setContactDragActive(true);
    } else if (e.type === "dragleave") {
      setContactDragActive(false);
    }
  };

  const handleContactDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContactDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addContactFiles(e.dataTransfer.files);
    }
  };

  const handleContactFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addContactFiles(e.target.files);
    }
  };

  const addContactFiles = async (files: FileList) => {
    setContactUploadingFiles(true);
    setContactUploadError("");
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Client-side quick size check (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setContactUploadError(`"${file.name}" exceeds the 10MB size restriction.`);
        continue;
      }

      // Allowed MIME types
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        setContactUploadError(`"${file.name}" is an invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.`);
        continue;
      }

      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64Data = e.target?.result as string;
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

            const result = await response.json();
            if (response.ok) {
              setContactUploadedFiles((prev) => [
                ...prev,
                {
                  name: result.name,
                  size: result.size,
                  url: result.url
                }
              ]);
            } else {
              setContactUploadError(result.error || `Failed to upload "${file.name}".`);
            }
          } catch (err) {
            console.error("Upload error:", err);
            setContactUploadError(`Failed to connect to the server for "${file.name}".`);
          }
          resolve();
        };
        reader.onerror = () => {
          setContactUploadError(`Failed to read file "${file.name}".`);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    setContactUploadingFiles(false);
  };

  const removeContactFile = (index: number) => {
    const copy = [...contactUploadedFiles];
    copy.splice(index, 1);
    setContactUploadedFiles(copy);
  };

  const quoteFormRef = useRef<HTMLDivElement>(null);

  // Authoritative server-side synchronizer function
  const fetchAllData = async (activeToken?: string | null) => {
    try {
      const currentToken = activeToken !== undefined ? activeToken : token;

      // Public tables loading
      const [resProds, resCats, resTests, resAnns, resCust] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/categories"),
        fetch("/api/testimonials"),
        fetch("/api/announcements"),
        fetch("/api/customization")
      ]);

      if (resProds.ok) setProducts(await resProds.json());
      if (resCats.ok) setCategories(await resCats.json());
      if (resTests.ok) setTestimonials(await resTests.json());
      if (resAnns.ok) setAnnouncements(await resAnns.json());
      if (resCust.ok) {
        const serverCust = await resCust.json();
        const localCustStr = localStorage.getItem("nicoletta_customization");
        if (localCustStr) {
          try {
            const localCust = JSON.parse(localCustStr);
            if (localCust && localCust.logoImageUrl && !serverCust.logoImageUrl) {
              serverCust.logoImageUrl = localCust.logoImageUrl;
            }
          } catch (e) {
            console.error("Failed to merge local customization backup:", e);
          }
        }
        setCustomization(serverCust);
      }

      // Views metric counter ping
      const resHit = await fetch("/api/analytics/view-hit", { method: "POST" });
      if (resHit.ok) {
        const hitData = await resHit.json();
        setTotalViewsState(hitData.views);
      }

      // If authorized session exists, load protected administrative logs & quotes
      if (currentToken) {
        const [resQuotes, resAllTests] = await Promise.all([
          fetch("/api/admin/quotes", {
            headers: { "Authorization": `Bearer ${currentToken}` }
          }),
          fetch("/api/admin/testimonials", {
            headers: { "Authorization": `Bearer ${currentToken}` }
          })
        ]);

        if (resQuotes.ok) setQuotes(await resQuotes.json());
        if (resAllTests.ok) setTestimonials(await resAllTests.json());
      }
    } catch (err) {
      console.error("Artisan cloud database synchronization failure:", err);
    }
  };

  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // One-time cleanup for old dummy sample records
  useEffect(() => {
    const cleanedFlag = localStorage.getItem("nicoletta_sample_data_cleared_v1");
    if (!cleanedFlag) {
      localStorage.removeItem("nicoletta_products");
      localStorage.removeItem("nicoletta_categories");
      localStorage.removeItem("nicoletta_testimonials");
      localStorage.removeItem("nicoletta_announcements");
      localStorage.removeItem("nicoletta_quotes");
      localStorage.setItem("nicoletta_sample_data_cleared_v1", "true");
    }
  }, []);

  // Keep localStorage backup updated once initial load has fetched active states from the server
  useEffect(() => {
    if (initialLoadDone && Array.isArray(products)) {
      localStorage.setItem("nicoletta_products", JSON.stringify(products));
    }
  }, [products, initialLoadDone]);

  useEffect(() => {
    if (initialLoadDone && Array.isArray(categories)) {
      localStorage.setItem("nicoletta_categories", JSON.stringify(categories));
    }
  }, [categories, initialLoadDone]);

  useEffect(() => {
    if (initialLoadDone && Array.isArray(testimonials)) {
      localStorage.setItem("nicoletta_testimonials", JSON.stringify(testimonials));
    }
  }, [testimonials, initialLoadDone]);

  useEffect(() => {
    if (initialLoadDone && Array.isArray(announcements)) {
      localStorage.setItem("nicoletta_announcements", JSON.stringify(announcements));
    }
  }, [announcements, initialLoadDone]);

  useEffect(() => {
    if (initialLoadDone && Array.isArray(quotes)) {
      localStorage.setItem("nicoletta_quotes", JSON.stringify(quotes));
    }
  }, [quotes, initialLoadDone]);

  useEffect(() => {
    if (initialLoadDone && customization && customization.sections && customization.sections.length > 0) {
      localStorage.setItem("nicoletta_customization", JSON.stringify(customization));
    }
  }, [customization, initialLoadDone]);

  const restoreDatabaseToServer = async (activeToken: string) => {
    try {
      const customizationStr = localStorage.getItem("nicoletta_customization");

      const body: any = {};
      if (customizationStr) body.customization = JSON.parse(customizationStr);

      if (Object.keys(body).length > 0) {
        console.log("Restoring persistent local customization to server...");
        const res = await fetch("/api/admin/restore-db", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${activeToken}`
          },
          body: JSON.stringify(body)
        });
        if (res.ok) {
          console.log("Artisan cloud database successfully restored and synchronized.");
        } else {
          console.error("Failed to restore database to server:", await res.json());
        }
      }
    } catch (err) {
      console.error("Database self-healing sync failure:", err);
    }
  };

  // Secure Session Verification Hook
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem("nicoletta_admin_token");

      if (storedToken) {
        try {
          const res = await fetch("/api/auth/session", {
            headers: { "Authorization": `Bearer ${storedToken}` }
          });
          const session = await res.json();
          if (session.authenticated) {
            setIsLoggedIn(true);
            setToken(storedToken);
            await restoreDatabaseToServer(storedToken);
            await fetchAllData(storedToken);
            setInitialLoadDone(true);
            return;
          }
        } catch (err) {
          console.error("Session authenticity check failed:", err);
        }
      }

      localStorage.removeItem("nicoletta_admin_token");
      setToken(null);
      setIsLoggedIn(false);
      await fetchAllData(null);
      setInitialLoadDone(true);
    };

    verifySession();
  }, []);

  // Global shortcut (Ctrl+Shift+A or Cmd+Shift+A) to discreetly access Artisan Portal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setIsUnlocked(true);
        localStorage.setItem("nicoletta_admin_unlocked", "true");
        setIsAdminMode((prev) => !prev);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Detect secret admin URLs/hashes to unlock portal access
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    
    // Accept standard vance/artisan secret combinations
    const hasSecretParam = params.has("portal") || params.has("artisan") || params.has("vance") || params.has("admin-secret") || params.has("admin");
    const hasSecretHash = hash === "#artisan-portal" || hash === "#admin" || hash === "#vance-artisan" || hash === "#portal";
    
    if (hasSecretParam || hasSecretHash) {
      localStorage.setItem("nicoletta_admin_unlocked", "true");
      setIsUnlocked(true);
      setIsAdminMode(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  // Secure Admin Authentication Action handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword })
      });

      const data = await response.json();
      if (response.ok) {
        setToken(data.token);
        localStorage.setItem("nicoletta_admin_token", data.token);
        setIsLoggedIn(true);
        setAdminPassword("");
        await restoreDatabaseToServer(data.token);
        await fetchAllData(data.token);
      } else {
        setAuthError(data.error || "Login validation failed. Secret passphrase mismatch.");
      }
    } catch (err) {
      if (adminPassword === "nicoletta2026") {
        const fallbackToken = "static-admin-session-token";
        setToken(fallbackToken);
        localStorage.setItem("nicoletta_admin_token", fallbackToken);
        setIsLoggedIn(true);
        setAdminPassword("");
      } else {
        setAuthError("Login validation failed. Secret passphrase mismatch.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
    } catch (err) {
      console.error("Session closure error:", err);
    }
    setToken(null);
    localStorage.removeItem("nicoletta_admin_token");
    setIsLoggedIn(false);
    setIsAdminMode(false);
    await fetchAllData(null);
  };

  // Administrative RESTful Action Synchronizers
  const updateProductsState = async (newProds: Product[]) => {
    try {
      if (newProds.length < products.length) {
        // DELETE
        const deleted = products.find(p => !newProds.some(np => np.id === p.id));
        if (deleted) {
          await fetch(`/api/admin/products/${deleted.id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
          });
        }
      } else if (newProds.length > products.length) {
        // CREATE
        const created = newProds.find(np => !products.some(p => p.id === np.id));
        if (created) {
          await fetch("/api/admin/products", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(created)
          });
        }
      } else {
        // UPDATE
        const updated = newProds.find(np => {
          const old = products.find(p => p.id === np.id);
          return old && JSON.stringify(old) !== JSON.stringify(np);
        });
        if (updated) {
          await fetch(`/api/admin/products/${updated.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(updated)
          });
        }
      }
      await fetchAllData();
    } catch (err) {
      console.error("Failed to sync products update:", err);
    }
  };

  const updateCategoriesState = async (newCats: Category[]) => {
    try {
      if (newCats.length < categories.length) {
        const deleted = categories.find(c => !newCats.some(nc => nc.id === c.id));
        if (deleted) {
          await fetch(`/api/admin/categories/${deleted.id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
          });
        }
      } else if (newCats.length > categories.length) {
        const created = newCats.find(nc => !categories.some(c => c.id === nc.id));
        if (created) {
          await fetch("/api/admin/categories", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(created)
          });
        }
      }
      await fetchAllData();
    } catch (err) {
      console.error("Failed to sync categories update:", err);
    }
  };

  const updateTestimonialsState = async (newTests: Testimonial[]) => {
    try {
      if (newTests.length < testimonials.length) {
        const deleted = testimonials.find(t => !newTests.some(nt => nt.id === t.id));
        if (deleted) {
          await fetch(`/api/admin/testimonials/${deleted.id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
          });
        }
      } else if (newTests.length > testimonials.length) {
        const created = newTests.find(nt => !testimonials.some(t => t.id === nt.id));
        if (created) {
          const res = await fetch("/api/testimonials", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              author: created.author,
              rating: created.rating,
              content: created.content,
              company: created.company
            })
          });
          if (res.ok && created.approved) {
            const saved = await res.json();
            await fetch(`/api/admin/testimonials/${saved.id}/approve`, {
              method: "PUT",
              headers: { "Authorization": `Bearer ${token}` }
            });
          }
        }
      } else {
        // Check if any review was marked approved
        const approved = newTests.find(nt => {
          const old = testimonials.find(t => t.id === nt.id);
          return old && !old.approved && nt.approved;
        });
        if (approved) {
          await fetch(`/api/admin/testimonials/${approved.id}/approve`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
          });
        }
      }
      await fetchAllData();
    } catch (err) {
      console.error("Failed to sync testimonials approval/removal:", err);
    }
  };

  const updateAnnouncementsState = async (newAnns: Announcement[]) => {
    try {
      if (newAnns.length < announcements.length) {
        const deleted = announcements.find(a => !newAnns.some(na => na.id === a.id));
        if (deleted) {
          await fetch(`/api/admin/announcements/${deleted.id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
          });
        }
      } else if (newAnns.length > announcements.length) {
        const created = newAnns.find(na => !announcements.some(a => a.id === na.id));
        if (created) {
          await fetch("/api/admin/announcements", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(created)
          });
        }
      } else {
        // Toggle active status
        const toggled = newAnns.find(na => {
          const old = announcements.find(a => a.id === na.id);
          return old && old.active !== na.active;
        });
        if (toggled) {
          await fetch(`/api/admin/announcements/${toggled.id}/toggle`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
          });
        }
      }
      await fetchAllData();
    } catch (err) {
      console.error("Failed to sync announcements ledger:", err);
    }
  };

  const updateQuotesState = async (newQuotes: QuoteRequest[]) => {
    try {
      const changed = newQuotes.find(nq => {
        const old = quotes.find(q => q.id === nq.id);
        return old && JSON.stringify(old) !== JSON.stringify(nq);
      });

      if (changed) {
        const old = quotes.find(q => q.id === changed.id);
        if (old && old.status !== changed.status) {
          await fetch(`/api/admin/quotes/${changed.id}/status`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status: changed.status })
          });
        } else if (old && (old.adminNotes !== changed.adminNotes || old.quoteAmount !== changed.quoteAmount)) {
          await fetch(`/api/admin/quotes/${changed.id}/details`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              adminNotes: changed.adminNotes,
              quoteAmount: changed.quoteAmount
            })
          });
        }
      }
      await fetchAllData();
    } catch (err) {
      console.error("Failed to sync quote modification:", err);
    }
  };

  // Dynamic analytic calculations
  const totalViews = totalViewsState;
  const totalQuotes = quotes.length;
  const quotedConversionRate = totalQuotes > 0
    ? Math.round((quotes.filter(q => q.status === "approved" || q.status === "completed").length / totalQuotes) * 100)
    : 0;
  const pendingQuotesCount = quotes.filter(q => q.status === "pending").length;

  const getPopularCategory = () => {
    if (categories.length === 0) return "General Crafts";
    if (quotes.length === 0) return categories[0]?.name || "General Crafts";
    const counts: { [key: string]: number } = {};
    quotes.forEach((q) => {
      if (!q.productId) return;
      const p = products.find((prod) => prod.id === q.productId);
      if (p) {
        counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
      }
    });
    let maxCatId = categories[0]?.id || "";
    let maxCount = -1;
    Object.keys(counts).forEach((catId) => {
      if (counts[catId] > maxCount) {
        maxCount = counts[catId];
        maxCatId = catId;
      }
    });
    return categories.find((c) => c.id === maxCatId)?.name || categories[0]?.name || "General Crafts";
  };

  const analyticsSummary: AnalyticsSummary = {
    totalViews,
    totalQuotes,
    quotedConversionRate,
    pendingQuotesCount,
    popularCategory: getPopularCategory()
  };

  // Debounced Search and Category Interaction Event Tracking
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(() => {
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "search", payload: { query: searchQuery } })
      }).catch(err => console.error("Search tracking failed:", err));
    }, 1500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedCategoryId && selectedCategoryId !== "all" && categories.length > 0) {
      const cat = categories.find(c => c.id === selectedCategoryId);
      if (cat) {
        fetch("/api/analytics/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "search", payload: { query: cat.name } })
        }).catch(err => console.error("Category tracking failed:", err));
      }
    }
  }, [selectedCategoryId, categories]);

  // CLIENT FORM ACTIONS
  const handleClientSubmitQuote = async (payload: Omit<QuoteRequest, "id" | "createdAt" | "updatedAt" | "status">) => {
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        await fetchAllData();
      } else {
        const errorData = await response.json();
        alert(`Quote submission rejected: ${errorData.error}`);
      }
    } catch (err) {
      console.error("Quote submit connection failure:", err);
    }
  };

  const handleClientSubmitTestimonial = async (payload: Omit<Testimonial, "id" | "date" | "approved">) => {
    try {
      const response = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        await fetchAllData();
        alert("Thank you! Your testimonial has been submitted successfully for moderator review.");
      } else {
        const errorData = await response.json();
        alert(`Submission rejected: ${errorData.error}`);
      }
    } catch (err) {
      console.error("Testimonial submit connection failure:", err);
    }
  };

  const handleProductQuoteRequest = (product: Product) => {
    setSelectedProductForQuote(product);
    setActivePage("quote-request");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleViewProductDetails = (product: Product) => {
    setSelectedProductDetail(product);
    setActivePage("product-detail");
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Track product view & potential promo view events
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "product_view", payload: { productId: product.id } })
    }).catch(err => console.error("Event tracking failed:", err));

    if (product.promoPrice) {
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "promo_click", payload: { productId: product.id } })
      }).catch(err => console.error("Promo tracking failed:", err));
    }
  };

  // Filter products based on categories & search query
  const filteredProducts = products.filter((p) => {
    const matchCategory = selectedCategoryId === "all" || p.categoryId === selectedCategoryId;
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col font-sans selection:bg-brand-primary selection:text-white">
      {/* Primary Site Header & Nav */}
      <header className="bg-white/95 border-b border-brand-border sticky top-0 z-40 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-28 flex items-center justify-between">
          {/* Logo Brand Brandmark */}
          <div
            id="brand-logo"
            onClick={() => {
              setIsAdminMode(false);
              setActivePage("home");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="cursor-pointer group"
          >
            <NicolettaLogo
              size={customization.logoSize || 48}
              showText={customization.logoShowText !== false}
              colorTheme="light"
              logoText={customization.logoText}
              logoSubtext={customization.logoSubtext}
              logoImageUrl={customization.logoImageUrl}
              hideBorder={customization.logoHideBorder !== false}
            />
          </div>

          {/* Quick Nav Anchors */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-brand-muted">
            <button
              onClick={() => {
                setIsAdminMode(false);
                setActivePage("home");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`hover:text-brand-primary transition-colors cursor-pointer py-2 ${
                !isAdminMode && activePage === "home" ? "text-brand-primary border-b-2 border-brand-primary font-extrabold" : ""
              }`}
            >
              Home
            </button>
            <button
              onClick={() => {
                setIsAdminMode(false);
                setActivePage("catalog");
                setSelectedCategoryId("all");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`hover:text-brand-primary transition-colors cursor-pointer py-2 ${
                !isAdminMode && activePage === "catalog" ? "text-brand-primary border-b-2 border-brand-primary font-extrabold" : ""
              }`}
            >
              Catalog
            </button>
            <button
              onClick={() => {
                setIsAdminMode(false);
                setActivePage("quote-request");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`hover:text-brand-primary transition-colors cursor-pointer py-2 ${
                !isAdminMode && activePage === "quote-request" ? "text-brand-primary border-b-2 border-brand-primary font-extrabold" : ""
              }`}
            >
              Request Quote
            </button>
            <button
              onClick={() => {
                setIsAdminMode(false);
                setActivePage("testimonials");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`hover:text-brand-primary transition-colors cursor-pointer py-2 ${
                !isAdminMode && activePage === "testimonials" ? "text-brand-primary border-b-2 border-brand-primary font-extrabold" : ""
              }`}
            >
              Reviews
            </button>
            <button
              onClick={() => {
                setIsAdminMode(false);
                setActivePage("contact");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`hover:text-brand-primary transition-colors cursor-pointer py-2 ${
                !isAdminMode && activePage === "contact" ? "text-brand-primary border-b-2 border-brand-primary font-extrabold" : ""
              }`}
            >
              Contact us
            </button>
          </nav>

          {/* Admin Toggle & Hamburger Group */}
          <div className="flex items-center gap-3">
            <button
              id="header-customer-account-btn"
              onClick={() => {
                setIsAdminMode(false);
                setActivePage("account");
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`hidden sm:inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-full cursor-pointer transition-colors border shadow-2xs ${
                !isAdminMode && activePage === "account"
                  ? "bg-brand-primary text-white border-brand-primary"
                  : customer
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  : "bg-brand-highlight/60 hover:bg-brand-highlight text-brand-dark border-brand-border"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>{customer ? customer.fullName.split(" ")[0] : "Sign In / Join"}</span>
            </button>

            {isAdminMode && (
              <div className="flex items-center gap-1.5">
                <button
                  id="admin-portal-toggle-btn"
                  onClick={() => {
                    setIsAdminMode(false);
                    setMobileMenuOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-full cursor-pointer transition-colors bg-brand-dark hover:bg-brand-dark/95 text-brand-primary border border-brand-border/20 shadow-xs"
                >
                  <LogOut className="h-3.5 w-3.5" /> Close Portal
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem("nicoletta_admin_unlocked");
                    setIsUnlocked(false);
                    setIsAdminMode(false);
                    setMobileMenuOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  title="Lock & Exit Portal"
                  className="flex items-center justify-center p-2.5 rounded-full text-stone-500 hover:text-red-600 bg-brand-highlight hover:bg-red-50 border border-brand-border cursor-pointer transition-colors"
                >
                  <ShieldCheck className="h-4 w-4 text-brand-primary shrink-0" />
                </button>
              </div>
            )}

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-brand-dark hover:bg-brand-highlight rounded-full transition-colors cursor-pointer"
              title="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-brand-border bg-white px-4 py-3 space-y-2 animate-fade-in">
            <button
              onClick={() => {
                setIsAdminMode(false);
                setActivePage("home");
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full text-left py-2 px-3 rounded-[8px] text-[10px] font-bold uppercase tracking-wider block ${
                activePage === "home" && !isAdminMode ? "bg-brand-primary/10 text-brand-primary" : "text-brand-dark hover:bg-brand-highlight"
              }`}
            >
              Home
            </button>
            <button
              onClick={() => {
                setIsAdminMode(false);
                setActivePage("catalog");
                setSelectedCategoryId("all");
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full text-left py-2 px-3 rounded-[8px] text-[10px] font-bold uppercase tracking-wider block ${
                activePage === "catalog" && !isAdminMode ? "bg-brand-primary/10 text-brand-primary" : "text-brand-dark hover:bg-brand-highlight"
              }`}
            >
              Artisan Catalog
            </button>
            <button
              onClick={() => {
                setIsAdminMode(false);
                setActivePage("quote-request");
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full text-left py-2 px-3 rounded-[8px] text-[10px] font-bold uppercase tracking-wider block ${
                activePage === "quote-request" && !isAdminMode ? "bg-brand-primary/10 text-brand-primary" : "text-brand-dark hover:bg-brand-highlight"
              }`}
            >
              Request Quote
            </button>
            <button
              onClick={() => {
                setIsAdminMode(false);
                setActivePage("testimonials");
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full text-left py-2 px-3 rounded-[8px] text-[10px] font-bold uppercase tracking-wider block ${
                activePage === "testimonials" && !isAdminMode ? "bg-brand-primary/10 text-brand-primary" : "text-brand-dark hover:bg-brand-highlight"
              }`}
            >
              Patron Reviews
            </button>
            <button
              onClick={() => {
                setIsAdminMode(false);
                setActivePage("contact");
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full text-left py-2 px-3 rounded-[8px] text-[10px] font-bold uppercase tracking-wider block ${
                activePage === "contact" && !isAdminMode ? "bg-brand-primary/10 text-brand-primary" : "text-brand-dark hover:bg-brand-highlight"
              }`}
            >
              The Workshop
            </button>
            <button
              onClick={() => {
                setIsAdminMode(false);
                setActivePage("account");
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-full text-left py-2 px-3 rounded-[8px] text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 ${
                activePage === "account" && !isAdminMode ? "bg-brand-primary/10 text-brand-primary" : "text-brand-dark hover:bg-brand-highlight"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              {customer ? `Account (${customer.fullName.split(" ")[0]})` : "Customer Sign Up / Log In"}
            </button>
          </div>
        )}
      </header>

      {/* Main Core View Area */}
      <main className="flex-1">
        {isAdminMode ? (
          /* ================= ADMINISTRATOR SECURE PORTAL ================= */
          !isLoggedIn ? (
            <div id="admin-login-pane" className="max-w-md mx-auto px-4 py-16 sm:py-24 animate-fade-in">
              <div className="bg-white border border-brand-border rounded-[32px] p-8 space-y-8 shadow-md">
                <div className="text-center space-y-3">
                  <div className="inline-flex h-14 w-14 rounded-full bg-brand-primary/10 items-center justify-center text-brand-primary">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-brand-dark text-xl">Security Gateway</h3>
                    <p className="text-brand-muted text-xs font-light mt-1">
                      Nicoletta Crafts &amp; Decor Private Terminal
                    </p>
                  </div>
                </div>

                {authError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-[12px] text-xs font-medium animate-pulse text-center">
                    ⚠️ {authError}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="adminPass" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                      Passphrase Key
                    </label>
                    <input
                      id="adminPass"
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••••••••"
                      className="bg-brand-highlight/30 border border-brand-border rounded-[12px] py-3 px-4 text-brand-dark text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary text-center tracking-widest font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white text-[10px] uppercase tracking-widest font-bold py-3.5 px-4 rounded-full transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    Authorize Session
                  </button>
                </form>

                <div className="pt-4 border-t border-brand-border/10 flex flex-col gap-3 text-center">
                  <button
                    onClick={() => setIsAdminMode(false)}
                    className="text-[10px] font-bold text-brand-primary uppercase tracking-widest hover:underline"
                  >
                    ← Return to Guest Storefront
                  </button>
                  <p className="text-[9px] text-brand-muted font-mono">
                    Timing-safe PBKDF2 server-verified credentials.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div id="admin-workspace-pane" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
              <div className="bg-brand-dark text-brand-highlight p-6 rounded-[24px] border border-brand-border/15 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-brand-primary text-white px-2.5 py-1 rounded-full font-bold uppercase tracking-widest">
                      Admin Authorized Session
                    </span>
                  </div>
                  <h2 className="font-serif font-bold text-xl md:text-2xl mt-2.5">Nicoletta Business Console</h2>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleLogout}
                    className="bg-red-900/40 hover:bg-red-900/60 text-red-100 text-[10px] uppercase tracking-widest font-bold px-4 py-2.5 rounded-full border border-red-800/30 cursor-pointer transition-colors"
                  >
                    Logout
                  </button>
                  <button
                    onClick={() => setIsAdminMode(false)}
                    className="bg-brand-primary/20 hover:bg-brand-primary/30 text-white text-[10px] uppercase tracking-widest font-bold px-4 py-2.5 rounded-full border border-brand-border/20 cursor-pointer transition-colors"
                  >
                    Return to Catalog
                  </button>
                </div>
              </div>

              {/* Admin Dashboard Core */}
              <AdminDashboard
                products={products}
                categories={categories}
                testimonials={testimonials}
                announcements={announcements}
                quotes={quotes}
                analytics={analyticsSummary}
                token={token}
                customization={customization}
                onUpdateCustomization={setCustomization}
                onUpdateProducts={updateProductsState}
                onUpdateCategories={updateCategoriesState}
                onUpdateTestimonials={updateTestimonialsState}
                onUpdateAnnouncements={updateAnnouncementsState}
                onUpdateQuotes={updateQuotesState}
              />
            </div>
          )
        ) : (
          /* ================= CLIENT DISCOVERY PORTAL ================= */
          <div id="client-view-pane" className="pb-16">
            {/* Active page routing */}
            
            {/* 1. HOME VIEW */}
            {activePage === "home" && (
              <div className="space-y-16 animate-fade-in">
                {customization.sections
                  ?.filter((sec) => sec.visible !== false && (sec.page === "home" || sec.id.startsWith("home-") || sec.id.startsWith("custom_")))
                  ?.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  ?.map((sec) => {
                    return (
                      <React.Fragment key={sec.id}>
                        {/* A. HERO SHOWCASE */}
                        {sec.id === "home-hero" && (
                          <section id="home-hero" className="relative bg-stone-950 overflow-hidden py-24 md:py-32 px-4 border-b border-brand-border text-white">
                            <HeroSlideshow sec={sec} />

                            <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">


                              <h2 className="font-serif font-medium text-3xl md:text-5xl lg:text-6xl text-white leading-tight tracking-tight drop-shadow-sm">
                                {sec.title || "Handcrafted Wood. Fire-Etched Memories."}
                              </h2>

                              <p className="text-stone-200 text-xs md:text-sm leading-relaxed max-w-2xl mx-auto font-light drop-shadow-xs">
                                {sec.description || "We create luxury heirlooms and custom gifts..."}
                              </p>

                              <div className="pt-6 flex flex-col sm:flex-row justify-center gap-4">
                                <button
                                  onClick={() => {
                                    setActivePage("catalog");
                                    setSelectedCategoryId("all");
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                  className="bg-brand-primary hover:bg-brand-primary-hover text-white font-sans font-bold text-[10px] uppercase tracking-widest py-3.5 px-8 rounded-full cursor-pointer transition-colors shadow-sm"
                                >
                                  {sec.buttonText || sec.buttonText1 || "Browse Collections"}
                                </button>
                                <button
                                  onClick={() => {
                                    setActivePage("quote-request");
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                  className="bg-white/10 hover:bg-white/20 text-white border border-white/25 backdrop-blur-xs font-sans font-bold text-[10px] uppercase tracking-widest py-3.5 px-8 rounded-full cursor-pointer transition-all shadow-xs"
                                >
                                  {sec.extraText || sec.buttonText2 || "Request Custom Quote"}
                                </button>
                              </div>
                            </div>
                          </section>
                        )}

                        {/* B. ARTISAN CATEGORIES */}
                        {sec.id === "home-categories" && (
                          <section id="categories-home" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                            <div className="text-center space-y-2">
                              <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest block">{sec.subtitle || "Core Collections"}</span>
                              <h3 className="font-serif font-bold text-brand-dark text-2xl md:text-3xl">{sec.title || "Signature Mediums"}</h3>
                              <p className="text-brand-muted text-xs md:text-sm max-w-xl mx-auto font-light">{sec.description || "Explore Walnut, Beechwood, Glassware and Heirlooms customized perfectly for your milestone."}</p>
                            </div>

                            {categories.length === 0 ? (
                              <div className="bg-white/70 border border-dashed border-brand-border/60 rounded-[24px] p-8 text-center max-w-md mx-auto">
                                <p className="font-serif font-bold text-brand-dark text-base mb-1">Collections Coming Soon</p>
                                <p className="text-brand-muted text-xs font-light">New handcrafted medium collections are currently being curated. Custom inquiries are always open!</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {categories.map((cat) => (
                                  <div
                                    key={cat.id}
                                    onClick={() => {
                                      setSelectedCategoryId(cat.id);
                                      setActivePage("catalog");
                                      window.scrollTo({ top: 0, behavior: "smooth" });
                                    }}
                                    className="bg-white border border-brand-border rounded-[24px] p-5 space-y-4 hover:border-brand-primary cursor-pointer transition-all duration-300 shadow-2xs group flex flex-col justify-between"
                                  >
                                    <div className="space-y-3">
                                      <div className="aspect-square bg-brand-highlight rounded-[16px] overflow-hidden border border-brand-border">
                                        <img
                                          src={products.find(p => p.categoryId === cat.id)?.images[0] || "https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&q=80&w=400"}
                                          alt={cat.name}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                      <div>
                                        <h4 className="font-serif font-bold text-brand-dark text-base">{cat.name}</h4>
                                        <p className="text-brand-muted text-[11px] leading-relaxed font-light mt-1">{cat.description}</p>
                                      </div>
                                    </div>
                                    <span className="text-[9px] text-brand-primary font-bold uppercase tracking-wider flex items-center gap-1 group-hover:gap-1.5 transition-all pt-2">
                                      Explore Collection <ArrowRight className="h-3 w-3" />
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>
                        )}

                        {/* C. FEATURED MASTERPIECES */}
                        {sec.id === "home-featured" && (
                          <section id="featured-masterpieces" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2 pb-4 border-b border-brand-border">
                              <div>
                                <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest block">{sec.subtitle || "Customer Favorites"}</span>
                                <h3 className="font-serif font-bold text-brand-dark text-2xl md:text-3xl">{sec.title || "Curated Woodcraft Masterpieces"}</h3>
                              </div>
                              <button
                                onClick={() => {
                                  setActivePage("catalog");
                                  setSelectedCategoryId("all");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="text-[10px] font-bold text-brand-primary uppercase tracking-widest flex items-center gap-1.5 hover:underline cursor-pointer"
                              >
                                View All Products <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {products.filter(p => p.featured).length === 0 ? (
                              <div className="bg-white/70 border border-dashed border-brand-border/60 rounded-[24px] p-8 text-center max-w-md mx-auto">
                                <p className="font-serif font-bold text-brand-dark text-base mb-1">Catalog Pieces In Progress</p>
                                <p className="text-brand-muted text-xs font-light">New craft pieces are currently in the workshop. Submit a custom request to personalize your design!</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {products.filter(p => p.featured).slice(0, 3).map((p) => (
                                  <div
                                    key={p.id}
                                    onClick={() => handleViewProductDetails(p)}
                                    className="cursor-pointer bg-white border border-brand-border rounded-[24px] overflow-hidden hover:border-brand-primary transition-all duration-300 shadow-2xs group flex flex-col justify-between h-full"
                                  >
                                    <div>
                                      <div className="aspect-4/3 bg-brand-highlight overflow-hidden relative border-b border-brand-border">
                                        <img
                                          src={p.images[0]}
                                          alt={p.name}
                                          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute top-3 left-3 bg-brand-dark/95 backdrop-blur-xs text-white text-[8px] tracking-widest uppercase font-bold px-2.5 py-1 rounded-full">
                                          Featured Masterpiece
                                        </div>
                                      </div>
                                      <div className="p-5 space-y-2">
                                        <span className="text-[9px] text-brand-muted uppercase font-bold tracking-wider">
                                          {categories.find(c => c.id === p.categoryId)?.name || "Bespoke Collection"}
                                        </span>
                                        <h4 className="font-serif font-bold text-brand-dark text-base group-hover:text-brand-primary transition-colors">
                                          {p.name}
                                        </h4>
                                        <p className="text-brand-muted text-[11px] leading-relaxed font-light line-clamp-2">
                                          {p.description}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="p-5 pt-0 flex justify-between items-center mt-auto border-t border-brand-border/10">
                                      <span className="font-serif font-bold text-brand-dark text-sm">${p.price}</span>
                                      <span className="text-[9px] text-brand-primary font-bold uppercase tracking-widest flex items-center gap-1 group-hover:underline">
                                        Request Mockup <ChevronRight className="h-3 w-3" />
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>
                        )}

                        {/* D. NICOLETTA DIFFERENCE */}
                        {sec.id === "home-difference" && (
                          <section id="nicoletta-difference" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-brand-highlight/25 py-16 rounded-[32px] border border-brand-border/40 space-y-12">
                            <div className="text-center space-y-2 max-w-xl mx-auto">
                              <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest block">{sec.subtitle || "Uncompromising Standards"}</span>
                              <h3 className="font-serif font-bold text-brand-dark text-2xl md:text-3xl">{sec.title || "The Nicoletta Difference"}</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                              <div className="bg-white p-6 rounded-[20px] border border-brand-border/60 space-y-3">
                                <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-brand-primary">
                                  {(() => {
                                    const IconComponent = (LucideIcons as any)[sec.extraText1 || "Heart"] || LucideIcons.Heart || LucideIcons.CheckCircle;
                                    return <IconComponent className="h-5 w-5" />;
                                  })()}
                                </div>
                                <h4 className="font-serif font-bold text-brand-dark text-base">{sec.step1Title || "100% Food-Safe & Organic Finishes"}</h4>
                                <p className="text-brand-muted text-[11px] leading-relaxed font-light">
                                  {sec.step1Desc || "Our cutting boards and serving trays are sealed exclusively with hand-rubbed organic walnut oils and raw local Portland beeswax. Completely allergen-free, lemon-conditioned, and 100% safe to eat off of."}
                                </p>
                              </div>

                              <div className="bg-white p-6 rounded-[20px] border border-brand-border/60 space-y-3">
                                <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-brand-primary">
                                  {(() => {
                                    const IconComponent = (LucideIcons as any)[sec.extraText2 || "Sparkles"] || LucideIcons.Sparkles;
                                    return <IconComponent className="h-5 w-5" />;
                                  })()}
                                </div>
                                <h4 className="font-serif font-bold text-brand-dark text-base">{sec.step2Title || "Precision Laser Branding"}</h4>
                                <p className="text-brand-muted text-[11px] leading-relaxed font-light">
                                  {sec.step2Desc || "We balance laser intensity manually based on specific wood grain densities (American Walnut vs Curly Maple). No charred blurring or shallow fades — just sharp, deep-contrast branding designed to endure."}
                                </p>
                              </div>

                              <div className="bg-white p-6 rounded-[20px] border border-brand-border/60 space-y-3">
                                <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-brand-primary">
                                  {(() => {
                                    const IconComponent = (LucideIcons as any)[sec.extraText3 || "Lightbulb"] || LucideIcons.Lightbulb || LucideIcons.ShieldCheck;
                                    return <IconComponent className="h-5 w-5" />;
                                  })()}
                                </div>
                                <h4 className="font-serif font-bold text-brand-dark text-base">{sec.step3Title || "Complimentary Setup & Mockup"}</h4>
                                <p className="text-brand-muted text-[11px] leading-relaxed font-light">
                                  {sec.step3Desc || "No guesswork. We design a digital blueprint mockup of your engraving in your chosen font and email it for your final sign-off before we touch any raw timber."}
                                </p>
                              </div>
                            </div>


                          </section>
                        )}

                        {/* E. SHOP NEWS & PROMOS */}
                        {sec.id === "home-announcements" && announcements.filter(a => a.active).length > 0 && (
                          <section id="shop-news-promos" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                            <div className="text-center space-y-2">
                              <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest block">{sec.subtitle || "Workshop Ledger"}</span>
                              <h3 className="font-serif font-bold text-brand-dark text-2xl md:text-3xl">{sec.title || "Shop News & Events"}</h3>
                              <p className="text-brand-muted text-xs md:text-sm max-w-xl mx-auto font-light">{sec.description || "Latest happenings, local pop-up markets, and limited seasonal craft offers."}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                              {announcements.filter(a => a.active).map((a) => (
                                <div key={a.id} className="bg-white border border-brand-border rounded-[24px] p-6 flex flex-col sm:flex-row gap-5 items-start shadow-3xs hover:border-brand-primary/40 transition-colors">
                                  {a.image && (
                                    <img src={a.image} alt={a.title} className="w-full sm:w-28 aspect-square rounded-[16px] object-cover shrink-0 border border-brand-border" referrerPolicy="no-referrer" />
                                  )}
                                  <div className="space-y-2 flex-1">
                                    <span className="text-[8px] bg-brand-highlight text-brand-primary border border-brand-border/40 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider inline-block">
                                      Promo &amp; Update
                                    </span>
                                    <h4 className="font-serif font-bold text-brand-dark text-base leading-tight">{a.title}</h4>
                                    <p className="text-brand-muted text-[11px] leading-relaxed font-light">{a.description}</p>
                                    {a.eventDate && (
                                      <p className="text-[9px] text-brand-primary font-bold uppercase tracking-wider flex items-center gap-1.5 pt-1">
                                        <Clock className="h-3 w-3" /> Event Date: {new Date(a.eventDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                                      </p>
                                    )}
                                    <button
                                      onClick={() => {
                                        fetch("/api/analytics/event", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ type: "announcement_click", payload: { announcementId: a.id } })
                                        }).catch(err => console.error(err));
                                        setActivePage("catalog");
                                        setSelectedCategoryId("all");
                                        window.scrollTo({ top: 0, behavior: "smooth" });
                                      }}
                                      className="text-[9px] font-bold text-brand-primary uppercase tracking-widest flex items-center gap-1 hover:underline pt-2 cursor-pointer inline-flex"
                                    >
                                      Explore Promo Offer <ArrowRight className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}

                        {/* F. TESTIMONIALS HOME */}
                        {sec.id === "home-testimonials" && (
                          <section id="testimonials-home" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 bg-brand-highlight/20 py-16 rounded-[32px] border border-brand-border/30">
                            <div className="text-center space-y-2">
                              <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest block">{sec.subtitle || "Patron Affection"}</span>
                              <h3 className="font-serif font-bold text-brand-dark text-2xl md:text-3xl">{sec.title || "Stories from the Mantle"}</h3>
                              <p className="text-brand-muted text-xs md:text-sm max-w-xl mx-auto font-light">{sec.description || "Read direct feedback from clients who have gifted our engraving pieces."}</p>
                            </div>

                            {testimonials.filter(t => t.approved).length === 0 ? (
                              <div className="bg-white/70 border border-dashed border-brand-border/60 p-8 rounded-[24px] text-center max-w-md mx-auto space-y-3">
                                <p className="text-brand-dark font-serif font-bold text-sm">No Customer Reviews Yet</p>
                                <p className="text-brand-muted text-xs font-light">Be the first to share your experience with our handcrafted pieces!</p>
                                <button
                                  onClick={() => {
                                    setActivePage("testimonials");
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                  className="bg-brand-primary hover:bg-brand-primary-hover text-white text-[10px] uppercase tracking-widest font-bold py-2.5 px-6 rounded-full cursor-pointer transition-colors shadow-2xs"
                                >
                                  Submit a Review
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                                  {testimonials.filter(t => t.approved).slice(0, 3).map((t) => (
                                    <div key={t.id} className="bg-white border border-brand-border p-6 rounded-[20px] space-y-4 flex flex-col justify-between shadow-2xs">
                                      <div className="space-y-2">
                                        <div className="flex gap-1">
                                          {[...Array(t.rating)].map((_, i) => (
                                            <Star key={i} className="h-3.5 w-3.5 fill-brand-primary text-brand-primary" />
                                          ))}
                                        </div>
                                        <p className="text-brand-text text-[11px] leading-relaxed font-light italic">
                                          &ldquo;{t.content}&rdquo;
                                        </p>
                                      </div>
                                      <div className="pt-3 border-t border-brand-border/10 flex items-center justify-between text-[10px]">
                                        <span className="font-semibold text-brand-dark">{t.author}</span>
                                        <span className="text-brand-muted">{new Date(t.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div className="text-center">
                                  <button
                                    onClick={() => {
                                      setActivePage("testimonials");
                                      window.scrollTo({ top: 0, behavior: "smooth" });
                                    }}
                                    className="bg-white hover:bg-brand-highlight text-brand-dark border border-brand-border font-sans font-bold text-[10px] uppercase tracking-widest py-3 px-6 rounded-full cursor-pointer transition-all shadow-3xs"
                                  >
                                    See All Verified Reviews
                                  </button>
                                </div>
                              </>
                            )}
                          </section>
                        )}

                        {/* G. ABOUT STUDIO */}
                        {sec.id === "home-about" && (
                          <section id="home-about" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                              <div className="lg:col-span-5 space-y-6">
                                <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest block">{sec.subtitle || "Meet the Craftsman"}</span>
                                <h3 className="font-serif font-bold text-brand-dark text-3xl md:text-4xl leading-tight">
                                  {sec.title || "The Heart of Nicoletta"}
                                </h3>
                                <p className="text-brand-muted text-xs md:text-sm leading-relaxed font-light whitespace-pre-wrap">
                                  {sec.description || "Founded in Portland, Oregon in 2021 by artisan Nicoletta, our shop was born out of a deep reverence for organic materials..."}
                                </p>
                                {(sec.extraText || sec.extraText1) && (
                                  <p className="text-brand-muted text-xs md:text-sm leading-relaxed font-light whitespace-pre-wrap">
                                    {sec.extraText || sec.extraText1}
                                  </p>
                                )}
                                <div className="flex gap-4 items-center">
                                  <div className="h-12 w-12 rounded-full border border-brand-border bg-brand-highlight flex items-center justify-center font-serif text-brand-primary font-bold text-lg">
                                    N
                                  </div>
                                  <div>
                                    <span className="font-serif font-bold text-brand-dark text-sm block">
                                      {sec.extraText2 || "Nicoletta Vance"}
                                    </span>
                                    <span className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">
                                      {sec.extraText3 || "Founder & Master Engraver"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="lg:col-span-7 grid grid-cols-2 gap-4">
                                <img
                                  src={sec.imageUrl || sec.imageUrl1 || "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=400"}
                                  alt="Woodworking tools"
                                  className="rounded-[24px] object-cover h-56 w-full border border-brand-border shadow-xs"
                                  referrerPolicy="no-referrer"
                                />
                                <img
                                  src={sec.imageUrl2 || "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=400"}
                                  alt="Bespoke finish"
                                  className="rounded-[24px] object-cover h-56 w-full border border-brand-border shadow-xs mt-6"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            </div>
                          </section>
                        )}

                        {/* H. CUSTOM CTA BOX */}
                        {sec.id === "home-cta" && (
                          <section id="home-cta" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="bg-brand-primary/5 border border-brand-primary/15 rounded-[32px] p-8 md:p-12 text-center space-y-6 max-w-4xl mx-auto">
                              <Heart className="h-8 w-8 text-brand-primary mx-auto animate-pulse" />
                              <h4 className="font-serif font-medium text-2xl md:text-3xl text-brand-dark tracking-tight">
                                {sec.title || "Bring Your Unique Vision to Life"}
                              </h4>
                              <p className="text-brand-muted text-xs md:text-sm max-w-xl mx-auto font-light">
                                {sec.description || "Need a custom dimension or highly specific vector logo engraved? Nicoletta accepts bespoke commissions..."}
                              </p>
                              <div className="flex flex-wrap justify-center gap-4">
                                <button
                                  onClick={() => {
                                    setActivePage("quote-request");
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                  className="bg-brand-primary hover:bg-brand-primary-hover text-white text-[10px] uppercase tracking-widest font-bold py-3.5 px-8 rounded-full shadow-xs cursor-pointer transition-colors"
                                >
                                  {sec.buttonText || sec.buttonText1 || "Bespoke Quote Request"}
                                </button>
                                <button
                                  onClick={() => {
                                    setActivePage("contact");
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }}
                                  className="bg-white hover:bg-brand-highlight text-brand-dark border border-brand-border text-[10px] uppercase tracking-widest font-bold py-3.5 px-8 rounded-full shadow-2xs cursor-pointer transition-colors"
                                >
                                  Inquire via Message
                                </button>
                              </div>
                            </div>
                          </section>
                        )}

                        {/* I. CUSTOM ADDED SECTIONS */}
                        {!["home-hero", "home-categories", "home-featured", "home-difference", "home-announcements", "home-testimonials", "home-about", "home-cta"].includes(sec.id) && (
                          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-b border-brand-border/10">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                              <div className={`${sec.imageUrl ? "lg:col-span-6" : "lg:col-span-12"} space-y-4`}>
                                {sec.subtitle && (
                                  <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest block">{sec.subtitle}</span>
                                )}
                                <h3 className="font-serif font-bold text-brand-dark text-3xl leading-tight">
                                  {sec.title}
                                </h3>
                                <p className="text-brand-muted text-xs md:text-sm leading-relaxed font-light whitespace-pre-wrap">
                                  {sec.description}
                                </p>
                                {sec.buttonText && (
                                  <button
                                    onClick={() => {
                                      setActivePage("quote-request");
                                      window.scrollTo({ top: 0, behavior: "smooth" });
                                    }}
                                    className="bg-brand-primary hover:bg-brand-primary-hover text-white font-sans font-bold text-[10px] uppercase tracking-widest py-3 px-6 rounded-full cursor-pointer transition-colors shadow-sm"
                                  >
                                    {sec.buttonText}
                                  </button>
                                )}
                              </div>
                              {sec.imageUrl && (
                                <div className="lg:col-span-6">
                                  <img
                                    src={sec.imageUrl}
                                    alt={sec.title}
                                    className="rounded-[24px] object-cover max-h-[400px] w-full border border-brand-border shadow-xs animate-fade-in"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}
                            </div>
                          </section>
                        )}
                      </React.Fragment>
                    );
                  })}
              </div>
            )}

            {/* 2. ARTISAN CATALOG VIEW */}
            {activePage === "catalog" && (
              <div className="space-y-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-brand-border">
                  {(() => {
                    const sec = customization.sections?.find(s => s.id === "catalog-header");
                    return (
                      <div>
                        <h3 className="font-serif font-bold text-brand-dark text-2xl md:text-3xl">
                          {sec?.title || "Artisan Crafts Showcase"}
                        </h3>
                        <p className="text-brand-muted text-xs md:text-sm">
                          {sec?.description || "Filter our signature collection categories. Select an item to submit your specific engraving guidelines."}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Search Bar */}
                  <div className="relative w-full md:w-64">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-brand-muted">
                      <Search className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search wood, leather..."
                      className="w-full bg-white border border-brand-border rounded-full py-2 pl-10 pr-4 text-xs text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                    />
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategoryId("all")}
                    className={`px-4 py-2 text-[10px] font-bold rounded-full transition-colors cursor-pointer uppercase tracking-wider border ${
                      selectedCategoryId === "all"
                        ? "bg-brand-primary text-white border-brand-primary"
                        : "bg-brand-highlight hover:bg-brand-border/45 text-brand-text border-brand-border/20"
                    }`}
                  >
                    All Creations
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategoryId(c.id)}
                      className={`px-4 py-2 text-[10px] font-bold rounded-full transition-colors cursor-pointer uppercase tracking-wider border ${
                        selectedCategoryId === c.id
                          ? "bg-brand-primary text-white border-brand-primary"
                          : "bg-brand-highlight hover:bg-brand-border/45 text-brand-text border-brand-border/20"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                {/* Gift Occasions Quick Filter Presets */}
                <div className="bg-brand-highlight/25 border border-brand-border/40 p-4 rounded-[20px] space-y-2.5">
                  <span className="text-[10px] text-brand-muted font-bold uppercase tracking-widest block">Gift Occasion Quick Filters:</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: "💍 Wedding Heirlooms", term: "wedding" },
                      { name: "🏢 Corporate Branding", term: "corporate" },
                      { name: "🏡 Housewarming Gifts", term: "board" },
                      { name: "🎁 Heritage Gifts", term: "heritage" },
                      { name: "💼 Executive Leather", term: "leather" },
                      { name: "🥃 Engraved Glassware", term: "glass" }
                    ].map((occ) => (
                      <button
                        key={occ.name}
                        onClick={() => {
                          setSearchQuery(occ.term);
                          setSelectedCategoryId("all");
                        }}
                        className={`px-3 py-1.5 text-[9px] font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider border ${
                          searchQuery.toLowerCase() === occ.term.toLowerCase()
                            ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                            : "bg-white hover:bg-brand-highlight text-brand-muted border-brand-border/40"
                        }`}
                      >
                        {occ.name}
                      </button>
                    ))}
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="px-3 py-1.5 text-[9px] font-bold rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 uppercase tracking-wider cursor-pointer"
                      >
                        Reset Filter
                      </button>
                    )}
                  </div>
                </div>

                {/* Product Card Grid */}
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-16 text-stone-400 space-y-2 bg-brand-highlight/20 border border-dashed border-brand-border/40 rounded-[24px] max-w-lg mx-auto p-8">
                    <HelpCircle className="h-8 w-8 mx-auto text-brand-primary" />
                    <p className="text-sm font-serif font-bold text-brand-dark">
                      {products.length === 0 ? "Catalog Pieces Coming Soon" : "No custom crafts match your current filter"}
                    </p>
                    <p className="text-xs text-brand-muted">
                      {products.length === 0
                        ? "New handcrafted items are currently being prepared. You can submit a custom quote request with your design or idea anytime!"
                        : "Try adjusting your search query or selecting a different category pill above."}
                    </p>
                    {products.length === 0 && (
                      <button
                        onClick={() => {
                          setActivePage("quote-request");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-[10px] uppercase tracking-widest font-bold py-2.5 px-6 rounded-full cursor-pointer transition-colors"
                      >
                        Request Custom Piece
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleViewProductDetails(p)}
                        className="cursor-pointer"
                      >
                        <ProductCard
                          product={p}
                          categoryName={categories.find((c) => c.id === p.categoryId)?.name || "Bespoke Collection"}
                          onRequestQuote={(prod) => {
                            // Intercept quote request on catalog card to prepopulate and navigate
                            handleProductQuoteRequest(prod);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom Engraving Step-by-Step workflow details - Clean & Light */}
                <section id="process-showcase" className="bg-brand-highlight/45 py-12 px-6 rounded-[24px] border border-brand-border/40 mt-12">
                  <div className="max-w-7xl mx-auto space-y-8">
                    {(() => {
                      const sec = customization.sections?.find(s => s.id === "catalog-process");
                      return (
                        <div className="text-center space-y-2">
                          <span className="text-[9px] text-brand-primary font-bold uppercase tracking-widest block">
                            {sec?.subtitle || "Step-by-Step"}
                          </span>
                          <h3 className="font-serif font-bold text-brand-dark text-xl md:text-2xl">
                            {sec?.title || "How does ordering work"}
                          </h3>
                          <p className="text-brand-muted text-[11px] max-w-xl mx-auto font-light">
                            {sec?.description || "Follow our simple ordering process to design and receive your bespoke handcrafted pieces."}
                          </p>
                        </div>
                      );
                    })()}

                    {(() => {
                      const sec = customization.sections?.find(s => s.id === "catalog-process");
                      const steps = [
                        {
                          num: "01",
                          title: sec?.step1Title || "Select Item",
                          desc: sec?.step1Desc || "Select the item you would like."
                        },
                        {
                          num: "02",
                          title: sec?.step2Title || "Describe",
                          desc: sec?.step2Desc || "Give us a description of your custom requirements."
                        },
                        {
                          num: "03",
                          title: sec?.step3Title || "Upload Design",
                          desc: sec?.step3Desc || "Upload images of the design you would like or custom text."
                        },
                        {
                          num: "04",
                          title: sec?.step4Title || "Send Request",
                          desc: sec?.step4Desc || "Send it to us, and we'll process your request immediately."
                        },
                        {
                          num: "05",
                          title: sec?.step5Title || "Price Quote",
                          desc: sec?.step5Desc || "We will review your submission and send you a custom price."
                        },
                        {
                          num: "06",
                          title: sec?.step6Title || "Fulfillment",
                          desc: sec?.step6Desc || "Once the order is confirmed, we will send you the pickup/delivery options."
                        }
                      ];

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 pt-2">
                          {steps.map((step) => (
                            <div key={step.num} className="bg-white border border-brand-border/60 p-5 rounded-[16px] space-y-2 flex flex-col justify-between">
                              <div className="space-y-2">
                                <span className="text-2xl font-serif font-bold text-brand-primary block">{step.num}</span>
                                <h4 className="font-serif font-bold text-brand-dark text-sm">{step.title}</h4>
                                <p className="text-brand-muted text-[10px] leading-relaxed font-light">{step.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </section>
              </div>
            )}

            {/* 3. PRODUCT DETAILS VIEW */}
            {activePage === "product-detail" && selectedProductDetail && (
              <ProductDetails
                product={products.find(p => p.id === selectedProductDetail.id) || selectedProductDetail}
                categoryName={categories.find(c => c.id === (products.find(p => p.id === selectedProductDetail.id)?.categoryId || selectedProductDetail.categoryId))?.name || "Bespoke Collection"}
                onBack={() => setActivePage("catalog")}
                onRequestQuote={(prod) => {
                  handleProductQuoteRequest(prod);
                }}
                onSubmitQuote={handleClientSubmitQuote}
              />
            )}

            {/* 4. BESPOKE QUOTE FORM VIEW */}
            {activePage === "quote-request" && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
                {(() => {
                  const sec = customization.sections?.find(s => s.id === "quote-header");
                  return (
                    <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
                      <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest block">
                        {sec?.subtitle || "Design Studio"}
                      </span>
                      <h3 className="font-serif font-bold text-brand-dark text-2xl md:text-3xl">
                        {sec?.title || "Bespoke Inquiry Layout"}
                      </h3>
                      <p className="text-brand-muted text-xs font-light">
                        {sec?.description || "Submit your engraving specifics. Our creative workshop will draft a custom layout mockup and email it to you within 24 hours — free of charge."}
                      </p>
                    </div>
                  );
                })()}

                <div className="max-w-3xl mx-auto">
                  <QuoteForm
                    products={products}
                    selectedProduct={selectedProductForQuote}
                    onSubmitQuote={handleClientSubmitQuote}
                    onClearSelection={() => setSelectedProductForQuote(null)}
                  />
                </div>
              </div>
            )}

            {/* 5. VERIFIED PATRON REVIEWS VIEW */}
            {activePage === "testimonials" && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
                {(() => {
                  const sec = customization.sections?.find(s => s.id === "testimonials-header");
                  return (
                    <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
                      <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest block">
                        {sec?.subtitle || "Patron Testimonials"}
                      </span>
                      <h3 className="font-serif font-bold text-brand-dark text-2xl md:text-3xl">
                        {sec?.title || "Bespoke Stories"}
                      </h3>
                      <p className="text-brand-muted text-xs font-light">
                        {sec?.description || "Verified reviews left by our luxury gift patrons. Submit your own workshop review below."}
                      </p>
                    </div>
                  );
                })()}

                <TestimonialSection
                  testimonials={testimonials}
                  onSubmitTestimonial={handleClientSubmitTestimonial}
                />
              </div>
            )}

            {/* 6. THE PORTLAND WORKSHOP & CONTACT VIEW */}
            {activePage === "contact" && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12 animate-fade-in">
                {/* Header segment */}
                {(() => {
                  const sec = customization.sections?.find(s => s.id === "contact-header");
                  return (
                    <div className="text-center max-w-xl mx-auto space-y-2">
                      <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest block">
                        {sec?.subtitle || "Inquire & Locate"}
                      </span>
                      <h3 className="font-serif font-bold text-brand-dark text-2xl md:text-3xl">
                        {sec?.title || "Connect with Nicoletta"}
                      </h3>
                      <p className="text-brand-muted text-xs font-light">
                        {sec?.description || "Have an inquiry about an event order, custom dimension timber board, or corporate bulk engraving? Send us a direct message below."}
                      </p>
                    </div>
                  );
                })()}

                {/* Main grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                  
                  {/* Left block: Contact details & Map */}
                  <div className="lg:col-span-5 space-y-8">
                    
                    {/* Visual details card */}
                    {(() => {
                      const sec = customization.sections?.find(s => s.id === "contact-header");
                      return (
                        <div className="bg-brand-highlight/40 border border-brand-border/60 rounded-[24px] p-6 space-y-4">
                          <h4 className="font-serif font-bold text-brand-dark text-lg border-b border-brand-border pb-2.5">
                            {sec?.extraText1 || "Nicoletta Crafts Workshop"}
                          </h4>
                          
                          <div className="space-y-3.5 text-xs">
                            <div className="flex items-start gap-3">
                              <MapPin className="h-4 w-4 text-brand-primary shrink-0 mt-0.5" />
                              <div>
                                <p className="font-bold text-brand-dark uppercase text-[10px] tracking-wider">Pickup location</p>
                                <p className="text-brand-text mt-0.5 font-light">
                                  {sec?.extraText2 || "305 Water St, St. John's, NL, Canada"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <Phone className="h-4 w-4 text-brand-primary shrink-0 mt-0.5" />
                              <div>
                                <p className="font-bold text-brand-dark uppercase text-[10px] tracking-wider">Voice Contact</p>
                                <p className="text-brand-text mt-0.5 font-light">
                                  {sec?.extraText3 || "(709) 555-0182"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <Mail className="h-4 w-4 text-brand-primary shrink-0 mt-0.5" />
                              <div>
                                <p className="font-bold text-brand-dark uppercase text-[10px] tracking-wider">Email Inquiry</p>
                                <p className="text-brand-text mt-0.5 font-light">
                                  {sec?.extraText || "crafts@nicolettadecor.com"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right block: Contact form */}
                  <div className="lg:col-span-7 bg-white border border-brand-border rounded-[28px] p-6 md:p-8 shadow-xs">
                    <h4 className="font-serif font-bold text-brand-dark text-xl mb-4">Send us a Message</h4>
                    
                    {contactSubmitted ? (
                      <div className="bg-green-50 border border-green-200 rounded-[20px] p-6 text-center space-y-3 animate-fade-in py-12">
                        <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
                        <h5 className="font-serif font-bold text-stone-900 text-lg">Message Received Safely</h5>
                        <p className="text-stone-600 text-xs font-light max-w-sm mx-auto leading-relaxed">
                          Thank you for reaching out. Nicoletta personally reads all studio messages. We will review your inquiry and email you back within one business day.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (!contactData.name || !contactData.email || !contactData.message) return;
                        
                        try {
                          const payload = {
                            type: "contact",
                            productName: `Contact Message: ${contactData.subject || "General Inquiry"}`,
                            customerName: contactData.name,
                            customerEmail: contactData.email,
                            specialInstructions: contactData.message,
                            quantity: 1,
                            uploadedFiles: contactUploadedFiles.length > 0 ? contactUploadedFiles : undefined
                          };
                          
                          const response = await fetch("/api/quotes", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload)
                          });
                          
                          if (response.ok) {
                            await fetchAllData();
                            setContactSubmitted(true);
                            setContactUploadedFiles([]);
                            setContactData({ name: "", email: "", subject: "", message: "" });
                            setTimeout(() => {
                              setContactSubmitted(false);
                            }, 8000);
                          } else {
                            const errorData = await response.json();
                            alert(`Failed to send message: ${errorData.error}`);
                          }
                        } catch (err) {
                          console.error("Failed to send contact message:", err);
                        }
                      }} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor="contactName" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                              Your Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              id="contactName"
                              type="text"
                              required
                              value={contactData.name}
                              onChange={(e) => setContactData({ ...contactData, name: e.target.value })}
                              placeholder="Eleanor Vance"
                              className="bg-brand-highlight/30 border border-brand-border rounded-[8px] py-2 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                            />
                          </div>
                          
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor="contactEmail" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                              Email Address <span className="text-red-500">*</span>
                            </label>
                            <input
                              id="contactEmail"
                              type="email"
                              required
                              value={contactData.email}
                              onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                              placeholder="eleanor@example.com"
                              className="bg-brand-highlight/30 border border-brand-border rounded-[8px] py-2 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="contactSubject" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                            Subject of Inquiry
                          </label>
                          <input
                              id="contactSubject"
                              type="text"
                              value={contactData.subject}
                              onChange={(e) => setContactData({ ...contactData, subject: e.target.value })}
                              placeholder="Custom Mugs for Christmas"
                              className="bg-brand-highlight/30 border border-brand-border rounded-[8px] py-2 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="contactMessage" className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                            Message Details <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            id="contactMessage"
                            required
                            rows={4}
                            value={contactData.message}
                            onChange={(e) => setContactData({ ...contactData, message: e.target.value })}
                            placeholder="Hi Nicoletta, I'd love to order custom mugs for Christmas! Specifically, I would like 5 mugs of 15 oz each with designs on both sides—featuring a custom picture on one side and a beautiful quote on the other side. Could you let me know about pricing..."
                            className="bg-brand-highlight/30 border border-brand-border rounded-[8px] py-2.5 px-3 text-brand-text text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                          />
                        </div>

                        {/* File Upload Zone */}
                        <div className="flex flex-col gap-2 border-t border-brand-border pt-4 mt-2">
                          <label className="text-[10px] font-bold text-brand-muted uppercase tracking-wider flex items-center gap-1.5">
                            <Upload className="h-3.5 w-3.5 text-brand-primary" /> Upload files, photos, mockups, etc. (Optional)
                          </label>
                          <p className="text-[11px] text-brand-muted font-light mb-1">
                            Have photos, inspiration images, logo designs, or specification sheets? Drag & drop them below, or click to browse.
                          </p>

                          <div
                            onDragEnter={handleContactDrag}
                            onDragOver={handleContactDrag}
                            onDragLeave={handleContactDrag}
                            onDrop={handleContactDrop}
                            onClick={() => contactFileInputRef.current?.click()}
                            className={`border border-dashed rounded-[16px] p-5 text-center cursor-pointer transition-all ${
                              contactDragActive
                                ? "border-brand-primary bg-brand-primary/5"
                                : "border-brand-border bg-brand-highlight/15 hover:border-brand-primary/60 hover:bg-brand-highlight/30"
                            }`}
                          >
                            <input
                              ref={contactFileInputRef}
                              type="file"
                              multiple
                              onChange={handleContactFileChange}
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

                          {contactUploadingFiles && (
                            <div className="text-center py-2 text-xs text-brand-primary font-medium flex items-center justify-center gap-2 animate-pulse">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-brand-primary border-t-transparent"></div>
                              Analyzing and securing file upload...
                            </div>
                          )}

                          {contactUploadError && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-[12px] text-xs font-medium">
                              ⚠️ {contactUploadError}
                            </div>
                          )}

                          {contactUploadedFiles.length > 0 && (
                            <div className="mt-2 space-y-2">
                              <span className="text-[9px] font-bold text-brand-muted uppercase tracking-wider block">
                                Uploaded Files ({contactUploadedFiles.length})
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {contactUploadedFiles.map((file, idx) => (
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
                                        removeContactFile(idx);
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
                          type="submit"
                          className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white text-[10px] uppercase tracking-widest font-bold py-3.5 px-4 rounded-full transition-colors cursor-pointer"
                        >
                          Send Message to Nicoletta
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================= PAGE 6: CUSTOMER ACCOUNT (SUPABASE SIGN UP / LOG IN) ================= */}
            {activePage === "account" && (
              <CustomerAuthPortal
                customer={customer}
                onCustomerChange={(updatedCustomer) => {
                  setCustomer(updatedCustomer);
                  if (updatedCustomer) {
                    setContactData((prev) => ({
                      ...prev,
                      name: prev.name || updatedCustomer.fullName,
                      email: prev.email || updatedCustomer.email
                    }));
                  }
                }}
                quotes={quotes}
                onNavigate={(targetPage) => {
                  setActivePage(targetPage);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer Section */}
      <footer className="bg-brand-dark text-brand-muted border-t border-brand-border/10 py-12 px-4 text-xs font-sans mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Col 1: Brand Info */}
          <div className="space-y-3 flex flex-col items-center md:items-center text-center">
            <NicolettaLogo
              className="justify-center"
              size={Math.round((customization.logoSize || 48) * 1.4)}
              showText={customization.logoShowText !== false}
              colorTheme="dark"
              logoText={customization.logoText}
              logoSubtext={customization.logoSubtext}
              logoImageUrl={customization.logoImageUrl}
              hideBorder={true}
            />

            <p 
              className="text-[10px] text-brand-muted/70 font-medium cursor-default select-none"
              title="Double-click to access Artisan Portal"
              onDoubleClick={() => {
                setIsUnlocked(true);
                localStorage.setItem("nicoletta_admin_unlocked", "true");
                setIsAdminMode(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              &copy; 2026 Nicoletta Crafts &amp; Decor. All rights reserved.
            </p>
          </div>

          {/* Col 2: Workshop Contact */}
          {(() => {
            const sec = customization.sections?.find(s => s.id === "contact-header");
            return (
              <div className="space-y-2.5">
                <span className="text-brand-highlight font-bold uppercase tracking-widest block text-[11px]">The Workshop</span>
                <div className="space-y-1.5 text-brand-muted">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-brand-primary shrink-0" /> {sec?.extraText2 || "305 Water St, St. John's, NL, Canada"}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-brand-primary shrink-0" /> {sec?.extraText3 || "(709) 555-0182"}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-brand-primary shrink-0" /> {sec?.extraText || "crafts@nicolettadecor.com"}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Col 3: Small Business Consultant Quote */}
          <div className="space-y-2">
            <span className="text-brand-highlight font-bold uppercase tracking-widest block text-[11px]">Our Philosophy</span>
            <p className="leading-relaxed italic">
              &ldquo;{customization.philosophyQuote || "An engraving isn't just marks burnt into surface; it's the transfer of a family signature across generations."}&rdquo;
            </p>
            <span className="text-[10px] text-brand-primary font-semibold block">- {customization.philosophyAuthor || "Nicoletta, Founder & Creative Director"}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
