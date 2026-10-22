export const GIFT_OCCASION_PRESETS = [
  { name: "💍 Wedding Heirlooms", term: "wedding" },
  { name: "🏢 Corporate Branding", term: "corporate" },
  { name: "🏡 Housewarming Gifts", term: "board" },
  { name: "🎁 Heritage Gifts", term: "heritage" },
  { name: "💼 Executive Leather", term: "leather" },
  { name: "🥃 Engraved Glassware", term: "glass" }
] as const;

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  price: number;
  maxPrice?: number;
  promoPrice?: number;
  images: string[];
  featured: boolean;
  inStock: boolean;
  customOptions?: string[]; // e.g., ["Monogram Style", "Wood Type"]
  hideCustomOptions?: boolean; // Toggles hiding the "Options Available" section
  hideOptionsAvailable?: boolean; // Alias for hiding the "Options Available" section
  hasVisualizer?: boolean; // Toggles whether to show live personalization visualizer
  hasEngravingText?: boolean; // Toggles whether to show text to engrave input
  hasTypography?: boolean; // Toggles whether to show engraving typography style selection
  leadTime?: string; // e.g. "3-5 Business Days"
  dimensions?: string; // e.g. "16\" x 11\" x 1.25\""
  badge?: string; // e.g. "Walnut Woodcraft"
  seal?: string; // e.g. "Artisan Bench Crafted"
  includedNotes?: string[]; // Perks list
  giftOccasions?: string[]; // Gift Occasion Quick Filters (e.g. ["💍 Wedding Heirlooms", "🏡 Housewarming Gifts"])
  materialDetails?: string; // Detailed material info override
  pricingNotice?: string; // Custom note under pricing (e.g., "*The final cost will be calculated and sent by the crafter after reviewing your order details.")
  alternativeRequestText?: string; // Custom prompt for "Request a Similar or Alternative Craft"
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
}

export interface Testimonial {
  id: string;
  author: string;
  rating: number; // 1-5
  content: string;
  date: string;
  approved: boolean;
  company?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: "info" | "promo" | "urgent";
  active: boolean;
  date: string;
}

export interface QuoteRequest {
  id: string;
  type?: "quote" | "contact";
  productId?: string;
  productName?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  engravingText?: string;
  fontPreference?: string;
  specialInstructions?: string;
  quantity: number;
  status: "pending" | "reviewing" | "quoted" | "approved" | "completed" | "rejected";
  createdAt: string;
  updatedAt: string;
  adminNotes?: string;
  quoteAmount?: number;
  deadline?: string;
  uploadedFiles?: { name: string; size: number; url: string }[];
  adminPhotos?: { name: string; size?: number; url: string }[];
}

export interface AnalyticsSummary {
  totalViews: number;
  totalQuotes: number;
  quotedConversionRate: number;
  pendingQuotesCount: number;
  popularCategory: string;
}

export interface CustomSection {
  id: string;
  page: "home" | "catalog" | "quote" | "testimonials" | "contact";
  title: string;
  subtitle?: string;
  description?: string;
  visible: boolean;
  order: number;
  name?: string;
  buttonText?: string;
  extraText?: string;
  imageUrl?: string;
  imageUrls?: string[];
  extraText1?: string;
  extraText2?: string;
  extraText3?: string;
  imageUrl1?: string;
  imageUrl2?: string;
  buttonText1?: string;
  buttonText2?: string;
  step1Title?: string;
  step1Desc?: string;
  step2Title?: string;
  step2Desc?: string;
  step3Title?: string;
  step3Desc?: string;
  step4Title?: string;
  step4Desc?: string;
  step5Title?: string;
  step5Desc?: string;
  step6Title?: string;
  step6Desc?: string;
}

export interface CustomizationSettings {
  logoText: string;
  logoSubtext: string;
  logoImageUrl?: string;
  logoShowText: boolean;
  logoSize?: number;
  logoHideBorder?: boolean;
  philosophyQuote?: string;
  philosophyAuthor?: string;
  sections: CustomSection[];
}

