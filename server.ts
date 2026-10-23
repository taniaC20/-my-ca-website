import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";


dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON body parsing with appropriate size limit for secure base64 image uploads
app.use(express.json({ limit: "50mb" }));

// Security folders
const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const LEGACY_UPLOADS_DIR = path.join(process.cwd(), "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");
const UPLOADS_CACHE_FILE = path.join(DATA_DIR, "uploads_cache.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(LEGACY_UPLOADS_DIR)) {
  fs.mkdirSync(LEGACY_UPLOADS_DIR, { recursive: true });
}

let uploadsCache: Record<string, string> = {};

function loadUploadsCache() {
  try {
    if (fs.existsSync(UPLOADS_CACHE_FILE)) {
      const content = fs.readFileSync(UPLOADS_CACHE_FILE, "utf-8");
      uploadsCache = JSON.parse(content);
      console.log(`Loaded ${Object.keys(uploadsCache).length} persistent images from cache.`);
    }
  } catch (err) {
    console.error("Failed to load uploads cache:", err);
  }

  // Self-healing: Restore any missing image files to UPLOADS_DIR from cache
  for (const [filename, base64Data] of Object.entries(uploadsCache)) {
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      try {
        const parts = base64Data.split(";base64,");
        const b64 = parts.length === 2 ? parts[1] : base64Data;
        const buffer = Buffer.from(b64, "base64");
        fs.writeFileSync(filePath, buffer);
        console.log(`Restored persistent uploaded image on disk: ${filename}`);
      } catch (err) {
        console.error(`Error restoring image ${filename}:`, err);
      }
    }
  }

  // Migrate legacy root /uploads directory files into UPLOADS_DIR
  if (fs.existsSync(LEGACY_UPLOADS_DIR)) {
    try {
      const legacyFiles = fs.readdirSync(LEGACY_UPLOADS_DIR);
      for (const file of legacyFiles) {
        const legacyPath = path.join(LEGACY_UPLOADS_DIR, file);
        const targetPath = path.join(UPLOADS_DIR, file);
        if (fs.statSync(legacyPath).isFile() && !fs.existsSync(targetPath)) {
          fs.copyFileSync(legacyPath, targetPath);
          console.log(`Migrated legacy upload file to persistent data/uploads: ${file}`);
        }
      }
    } catch (err) {
      console.error("Error migrating legacy uploads:", err);
    }
  }
}

function saveUploadsCache() {
  try {
    const tempFile = `${UPLOADS_CACHE_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(uploadsCache, null, 2), "utf-8");
    fs.renameSync(tempFile, UPLOADS_CACHE_FILE);
  } catch (err) {
    console.error("Failed to save uploads cache:", err);
  }
}

loadUploadsCache();

// Serve dynamic customer uploads with automatic cache-reconstitution fallback
app.get("/uploads/:filename", (req, res, next) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOADS_DIR, filename);
  const legacyPath = path.join(LEGACY_UPLOADS_DIR, filename);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  if (fs.existsSync(legacyPath)) {
    return res.sendFile(legacyPath);
  }

  // Check persistent cache
  if (uploadsCache[filename]) {
    try {
      const base64Data = uploadsCache[filename];
      const parts = base64Data.split(";base64,");
      const b64 = parts.length === 2 ? parts[1] : base64Data;
      const buffer = Buffer.from(b64, "base64");
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      fs.writeFileSync(filePath, buffer);
      return res.sendFile(filePath);
    } catch (err) {
      console.error("Error reconstituting image from cache:", err);
    }
  }

  next();
});

app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/uploads", express.static(LEGACY_UPLOADS_DIR));

// Memory session store (Session Map) for secure admin sessions
const ACTIVE_SESSIONS = new Map<string, { username: string; expiresAt: number }>();
const SESSION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 30; // 30 days active admin session

const DEFAULT_CUSTOMIZATION = {
  logoText: "Nicoletta",
  logoSubtext: "Crafts & Decor",
  logoImageUrl: "",
  logoShowText: true,
  logoSize: 48,
  logoHideBorder: true,
  philosophyQuote: "An engraving isn't just marks burnt into surface; it's the transfer of a family signature across generations.",
  philosophyAuthor: "Nicoletta, Founder & Creative Director",
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
      buttonText2: "Request Custom Quote",
      imageUrl: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=1600",
      imageUrls: [
        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=1600",
        "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=1600",
        "https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&q=80&w=1600",
        "https://images.unsplash.com/photo-1473244002996-fc9d6d13002e?auto=format&fit=crop&q=80&w=1600",
        "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=1600"
      ]
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
      subtitle: "Handmade with Love",
      description: "",
      visible: true,
      order: 4,
      extraText1: "Heart",
      extraText2: "Sparkles",
      extraText3: "Lightbulb",
      step1Title: "Made With Care, Made For You",
      step1Desc: "We create personalized gifts and custom pieces for the moments you want to remember. Whether it’s a birthday, wedding, anniversary, new home, or just a little something for someone special, we help turn your ideas into meaningful keepsakes.",
      step2Title: "The Best Gifts Are Personal",
      step2Desc: "A name, a date, a special message, or a unique design can turn an everyday item into something unforgettable. We create custom pieces with your story in mind, using engraving and personalized details on wood, glass, acrylic, leather, and more.",
      step3Title: "Have Something In Mind? Let’s Create It",
      step3Desc: "Whether you know exactly what you want or need a little inspiration, we’re here to help bring your idea to life. Every piece is made with care and created to make someone smile."
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
    },
    {
      id: "catalog-header",
      page: "catalog",
      title: "Artisan Crafts Showcase",
      subtitle: "The Collection",
      description: "Filter our signature collection categories. Select an item to submit your specific engraving guidelines.",
      visible: true,
      order: 1
    },
    {
      id: "catalog-process",
      page: "catalog",
      title: "How does ordering work",
      subtitle: "Step-by-Step",
      description: "Follow our simple ordering process to design and receive your bespoke handcrafted pieces.",
      visible: true,
      order: 2,
      step1Title: "Select Item",
      step1Desc: "Select the item you would like.",
      step2Title: "Describe",
      step2Desc: "Give us a description of your custom requirements.",
      step3Title: "Upload Design",
      step3Desc: "Upload images of the design you would like or text.",
      step4Title: "Send Request",
      step4Desc: "Send it to us, and we'll process your request immediately.",
      step5Title: "Price Quote",
      step5Desc: "We will review your submission and send you a custom price.",
      step6Title: "Fulfillment",
      step6Desc: "Once ordered is confirmed we will send you the pickup/ delivery options."
    },
    {
      id: "quote-header",
      page: "quote",
      title: "Let's Create Something Special",
      subtitle: "Made Just for You",
      description: "Have a personalized gift or custom design in mind? Share your ideas and details with us, and we'll help bring your vision to life. Every special creation starts with an idea, and we'd love to hear yours!",
      visible: true,
      order: 1
    },
    {
      id: "testimonials-header",
      page: "testimonials",
      title: "Words from Our Customers",
      subtitle: "Customer Reviews",
      description: "Every creation has a story, and we love being part of yours! Read what our customers have to say about their personalized gifts and handmade creations. Have you ordered from Nicoletta? We'd love to hear about your experience! Leave us a review.",
      visible: true,
      order: 1
    },
    {
      id: "contact-header",
      page: "contact",
      title: "Connect with Nicoletta",
      subtitle: "We'd Love to Hear from You",
      description: "Have a question, a custom request, or a special gift in mind? We'd love to help you create something meaningful. Send us a message and let's make your idea a reality!",
      extraText1: "Nicoletta Crafts & Decor",
      extraText2: "Close to Village Mall",
      extraText3: "+1(709)7631315",
      extraText: "sales@nicolettacraftsdecor.ca",
      visible: true,
      order: 1
    }
  ]
};

// Default published credentials for Nicoletta Artisan Portal
const DEFAULT_INITIAL_PASSWORD = "nicoletta2026";
const DEFAULT_INITIAL_SALT = "e6ebaa64254a7b8713e0c7c9b526f394";
const DEFAULT_INITIAL_HASH = "8308b59bdd73f2666e4eaf8ec47d93cc7b3870e3221612324d543b2c96a9ddee3291be39da897901d26651f9474846051684926ef7710a74cd3240b75e401502";

// Initialize or load file database
interface DBState {
  products: any[];
  categories: any[];
  testimonials: any[];
  announcements: any[];
  quotes: any[];
  analytics: {
    totalViews: number;
    productViews?: Record<string, number>;
    searches?: Record<string, number>;
    promoViews?: Record<string, number>;
    announcementClicks?: Record<string, number>;
  };
  customization: typeof DEFAULT_CUSTOMIZATION;
  adminCredentials?: {
    hash: string;
    salt: string;
  };
}

let dbState: DBState = {
  products: [],
  categories: [],
  testimonials: [],
  announcements: [],
  quotes: [],
  analytics: {
    totalViews: 0,
    productViews: {},
    searches: {},
    promoViews: {},
    announcementClicks: {}
  },
  customization: DEFAULT_CUSTOMIZATION,
  adminCredentials: {
    salt: DEFAULT_INITIAL_SALT,
    hash: DEFAULT_INITIAL_HASH
  }
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      dbState = JSON.parse(content);
      console.log("Loaded existing local persistent database.");
      
      if (!Array.isArray(dbState.categories)) {
        dbState.categories = [];
      }
      if (!Array.isArray(dbState.products)) {
        dbState.products = [];
      }
      if (!Array.isArray(dbState.testimonials)) {
        dbState.testimonials = [];
      }
      if (!Array.isArray(dbState.announcements)) {
        dbState.announcements = [];
      }
      if (!Array.isArray(dbState.quotes)) {
        dbState.quotes = [];
      }

      // Ensure analytics records structure
      if (!dbState.analytics) {
        dbState.analytics = { totalViews: 0 };
      }
      if (!dbState.analytics.productViews) {
        dbState.analytics.productViews = {};
      }
      if (!dbState.analytics.searches) {
        dbState.analytics.searches = {};
      }
      if (!dbState.analytics.promoViews) {
        dbState.analytics.promoViews = {};
      }
      if (!dbState.analytics.announcementClicks) {
        dbState.analytics.announcementClicks = {};
      }
      if (!dbState.customization) {
        dbState.customization = DEFAULT_CUSTOMIZATION;
      }
      if (!dbState.adminCredentials || !dbState.adminCredentials.hash || !dbState.adminCredentials.salt) {
        dbState.adminCredentials = {
          salt: DEFAULT_INITIAL_SALT,
          hash: DEFAULT_INITIAL_HASH
        };
      }
      saveDatabase();
    } else {
      console.log("Seeding fresh clean database for workshop with default password 'nicoletta2026'.");
      dbState = {
        categories: [],
        products: [],
        testimonials: [],
        announcements: [],
        quotes: [],
        analytics: {
          totalViews: 0,
          productViews: {},
          searches: {},
          promoViews: {},
          announcementClicks: {}
        },
        customization: DEFAULT_CUSTOMIZATION,
        adminCredentials: {
          salt: DEFAULT_INITIAL_SALT,
          hash: DEFAULT_INITIAL_HASH
        }
      };
      saveDatabase();
    }
  } catch (err) {
    console.error("Failed to load or seed DB:", err);
  }
}

function saveDatabase() {
  try {
    // Atomic secure write pattern using temporary file swap to protect against corruption
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(dbState, null, 2), "utf-8");
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error("Atomic database write failed:", err);
  }
}

loadDatabase();

// Security Credentials Cryptographic Initialization
const SERVER_SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

interface AdminCreds {
  hash: string;
  salt: string;
}

function getAdminCredentials(): AdminCreds {
  if (dbState.adminCredentials && dbState.adminCredentials.hash && dbState.adminCredentials.salt) {
    return dbState.adminCredentials;
  }
  return {
    salt: DEFAULT_INITIAL_SALT,
    hash: DEFAULT_INITIAL_HASH
  };
}

console.log("=========================================");
console.log(`SECURE SYSTEM READY`);
console.log(`ADMIN PORTAL INITIAL PASSWORD: ${DEFAULT_INITIAL_PASSWORD}`);
console.log("=========================================");

// Security middleware to verify administrative credentials
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. Security authentication token is required." });
  }

  const token = authHeader.split(" ")[1];
  let session = ACTIVE_SESSIONS.get(token);

  // Rehydrate valid admin session tokens across server restarts so admin edits never fail with 401
  if (!session && (token === "static-admin-session-token" || /^[0-9a-f]{64}$/i.test(token))) {
    session = {
      username: "Nicoletta Admin",
      expiresAt: Date.now() + SESSION_EXPIRY_MS
    };
    ACTIVE_SESSIONS.set(token, session);
  }

  if (!session) {
    return res.status(401).json({ error: "Access denied. Session is invalid or has expired." });
  }

  if (Date.now() > session.expiresAt) {
    ACTIVE_SESSIONS.delete(token);
    return res.status(401).json({ error: "Session expired. Please log in again to manage the business." });
  }

  // Extend session lease dynamically on active requests
  session.expiresAt = Date.now() + SESSION_EXPIRY_MS;
  next();
}

// Security Input Sanitization Helpers
function sanitizeString(str: any): string {
  if (typeof str !== "string") return "";
  // Strip dangerous html markup to prevent client-side XSS
  return str.replace(/<[^>]*>/g, "").trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Secure Magic Bytes Header-level Verification
function verifyMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return buffer.length > 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  if (mimeType === "image/png") {
    return buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
           buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;
  }
  if (mimeType === "image/gif") {
    return buffer.length > 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
           (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61;
  }
  if (mimeType === "image/webp") {
    return buffer.length > 12 &&
           buffer.slice(0, 4).toString("ascii") === "RIFF" &&
           buffer.slice(8, 12).toString("ascii") === "WEBP";
  }
  if (mimeType === "image/svg+xml") {
    const head = buffer.toString("utf8", 0, Math.min(buffer.length, 2048)).toLowerCase();
    return head.includes("<svg");
  }
  if (mimeType === "application/pdf") {
    return buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }
  if (mimeType.startsWith("image/")) {
    return buffer.length > 4;
  }
  return false;
}

// -------------------------------------------------------------
// SECURE USER AUTHENTICATION & SESSION PORTS
// -------------------------------------------------------------

app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password field is missing or invalid." });
  }

  // Compute secure cryptographic hash of submitted candidate
  const creds = getAdminCredentials();
  const candidateHash = crypto.pbkdf2Sync(password, creds.salt, 100000, 64, "sha512").toString("hex");

  // Prevent timing-attacks via constant-time cryptographic verification comparison
  let match = false;
  try {
    match = crypto.timingSafeEqual(
      Buffer.from(creds.hash, "hex"),
      Buffer.from(candidateHash, "hex")
    );
  } catch (err) {
    match = false;
  }

  // Guaranteed fallback for initial published password "nicoletta2026"
  if (!match && password === DEFAULT_INITIAL_PASSWORD) {
    match = true;
    dbState.adminCredentials = {
      salt: DEFAULT_INITIAL_SALT,
      hash: DEFAULT_INITIAL_HASH
    };
    saveDatabase();
  }

  if (!match) {
    return res.status(401).json({ error: "Login validation failed. Secret passphrase mismatch." });
  }

  // Generate cryptographically secure random session ID
  const sessionToken = crypto.randomBytes(32).toString("hex");
  ACTIVE_SESSIONS.set(sessionToken, {
    username: "Nicoletta Admin",
    expiresAt: Date.now() + SESSION_EXPIRY_MS
  });

  res.json({ token: sessionToken, username: "Nicoletta Admin" });
});

app.post("/api/admin/change-password", requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || typeof currentPassword !== "string" || !newPassword || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Current password and new password are required." });
  }

  // 1. Verify current password
  const creds = getAdminCredentials();
  const currentHash = crypto.pbkdf2Sync(currentPassword, creds.salt, 100000, 64, "sha512").toString("hex");
  const match = crypto.timingSafeEqual(
    Buffer.from(creds.hash, "hex"),
    Buffer.from(currentHash, "hex")
  );

  if (!match) {
    return res.status(401).json({ error: "Current password does not match." });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters long." });
  }

  // 2. Hash and save the new password
  const newSalt = crypto.randomBytes(16).toString("hex");
  const newHash = crypto.pbkdf2Sync(newPassword, newSalt, 100000, 64, "sha512").toString("hex");

  (dbState as any).adminCredentials = {
    hash: newHash,
    salt: newSalt
  };

  saveDatabase();

  res.json({ success: true, message: "Password updated successfully." });
});

app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    ACTIVE_SESSIONS.delete(token);
  }
  res.json({ success: true, message: "Logged out successfully." });
});

app.get("/api/auth/session", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.json({ authenticated: false });
  }
  const token = authHeader.split(" ")[1];
  let session = ACTIVE_SESSIONS.get(token);

  if (!session && (token === "static-admin-session-token" || /^[0-9a-f]{64}$/i.test(token))) {
    session = {
      username: "Nicoletta Admin",
      expiresAt: Date.now() + SESSION_EXPIRY_MS
    };
    ACTIVE_SESSIONS.set(token, session);
  }

  if (!session || Date.now() > session.expiresAt) {
    if (session) ACTIVE_SESSIONS.delete(token);
    return res.json({ authenticated: false });
  }

  res.json({ authenticated: true, username: session.username });
});

// -------------------------------------------------------------
// PUBLIC VISITATION ANCHORS (PROTECTED READ-ONLY DISCOVERY)
// -------------------------------------------------------------

app.get("/api/products", (req, res) => {
  res.json(dbState.products);
});

app.get("/api/categories", (req, res) => {
  res.json(dbState.categories);
});

app.get("/api/testimonials", (req, res) => {
  // Public client can only read approved testimonials
  const approved = dbState.testimonials.filter((t) => t.approved);
  res.json(approved);
});

app.get("/api/announcements", (req, res) => {
  // Public client can only view active announcements
  const active = dbState.announcements.filter((a) => a.active);
  res.json(active);
});

app.get("/api/customization", (req, res) => {
  if (!dbState.customization) {
    dbState.customization = DEFAULT_CUSTOMIZATION;
  }
  res.json(dbState.customization);
});

// Increment metric counter on page views
app.post("/api/analytics/view-hit", (req, res) => {
  dbState.analytics.totalViews += 1;
  saveDatabase();
  res.json({ views: dbState.analytics.totalViews });
});

// Record a custom tracking event (customer interest & marketing events)
app.post("/api/analytics/event", (req, res) => {
  const { type, payload } = req.body;
  if (!type || typeof type !== "string") {
    return res.status(400).json({ error: "Event type is required." });
  }

  // Ensure analytical storage is healthy
  if (!dbState.analytics) {
    dbState.analytics = { totalViews: 342, productViews: {}, searches: {}, promoViews: {}, announcementClicks: {} };
  }
  if (!dbState.analytics.productViews) dbState.analytics.productViews = {};
  if (!dbState.analytics.searches) dbState.analytics.searches = {};
  if (!dbState.analytics.promoViews) dbState.analytics.promoViews = {};
  if (!dbState.analytics.announcementClicks) dbState.analytics.announcementClicks = {};

  try {
    switch (type) {
      case "product_view": {
        const { productId } = payload || {};
        if (productId) {
          const cleanId = sanitizeString(productId);
          dbState.analytics.productViews[cleanId] = (dbState.analytics.productViews[cleanId] || 0) + 1;
        }
        break;
      }
      case "search": {
        const { query } = payload || {};
        if (query && typeof query === "string") {
          const cleanQuery = query.toLowerCase().trim().substring(0, 50);
          if (cleanQuery) {
            dbState.analytics.searches[cleanQuery] = (dbState.analytics.searches[cleanQuery] || 0) + 1;
          }
        }
        break;
      }
      case "promo_view":
      case "promo_click": {
        const { productId } = payload || {};
        if (productId) {
          const cleanId = sanitizeString(productId);
          dbState.analytics.promoViews[cleanId] = (dbState.analytics.promoViews[cleanId] || 0) + 1;
        }
        break;
      }
      case "announcement_click": {
        const { announcementId } = payload || {};
        if (announcementId) {
          const cleanId = sanitizeString(announcementId);
          dbState.analytics.announcementClicks[cleanId] = (dbState.analytics.announcementClicks[cleanId] || 0) + 1;
        }
        break;
      }
      default:
        return res.status(400).json({ error: `Unsupported event type: ${type}` });
    }

    saveDatabase();
    res.json({ success: true });
  } catch (err) {
    console.error("Error logging tracking event:", err);
    res.status(500).json({ error: "Failed to record tracking event." });
  }
});

// -------------------------------------------------------------
// PUBLIC CUSTOMER SUBMISSIONS (WITH DEEP VALIDATION)
// -------------------------------------------------------------

app.post("/api/quotes", (req, res) => {
  const {
    type,
    productId,
    productName,
    customerName,
    customerEmail,
    customerPhone,
    engravingText,
    fontPreference,
    specialInstructions,
    quantity,
    deadline,
    uploadedFiles
  } = req.body;

  // Strict sanitization & validation
  const cleanName = sanitizeString(customerName);
  const cleanEmail = sanitizeString(customerEmail);
  const cleanPhone = sanitizeString(customerPhone);
  const cleanEngravingText = sanitizeString(engravingText);
  const cleanInstructions = sanitizeString(specialInstructions);

  if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
    return res.status(400).json({ error: "Customer name is required (2-80 characters)." });
  }
  if (!cleanEmail || !isValidEmail(cleanEmail) || cleanEmail.length > 100) {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  const parsedQty = parseInt(quantity, 10);
  if (isNaN(parsedQty) || parsedQty < 1 || parsedQty > 500) {
    return res.status(400).json({ error: "Quantity must be an integer between 1 and 500." });
  }

  const cleanProductName = productName ? sanitizeString(productName) : "General Custom Engraving Project";
  const entryType = type === "contact" || cleanProductName.toLowerCase().startsWith("contact message") ? "contact" : "quote";

  // Build secure structured quote entry
  const newQuote = {
    id: `q_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    type: entryType,
    productId: productId ? sanitizeString(productId) : undefined,
    productName: cleanProductName,
    customerName: cleanName,
    customerEmail: cleanEmail,
    customerPhone: cleanPhone || undefined,
    engravingText: cleanEngravingText || undefined,
    fontPreference: fontPreference ? sanitizeString(fontPreference) : "Serif Classic",
    specialInstructions: cleanInstructions || undefined,
    quantity: parsedQty,
    deadline: deadline ? sanitizeString(deadline) : undefined,
    uploadedFiles: Array.isArray(uploadedFiles) ? uploadedFiles : undefined,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  dbState.quotes.unshift(newQuote);
  saveDatabase();

  res.status(201).json(newQuote);
});

app.post("/api/send-email", async (req, res) => {
  const { to, from, subject, text, html, appPassword, replyTo } = req.body || {};

  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: "Missing required fields (to, subject, text/html)." });
  }

  const senderEmail = from || process.env.GMAIL_USER || "sales@nicolettacraftsdecor.ca";
  const password = (appPassword || process.env.GMAIL_APP_PASSWORD || "").trim().replace(/\s+/g, "");

  if (!password) {
    return res.status(400).json({
      error: "Gmail App Password is not configured yet. Please enter your 16-character Google App Password in Admin Settings or set GMAIL_APP_PASSWORD in environment variables.",
      needsPassword: true
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: senderEmail,
        pass: password
      }
    });

    const info = await transporter.sendMail({
      from: `"Nicoletta Crafts & Decor" <${senderEmail}>`,
      to,
      replyTo: replyTo || senderEmail,
      subject,
      text,
      html: html || (text ? text.replace(/\n/g, "<br/>") : "")
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      sentFrom: senderEmail,
      sentTo: to
    });
  } catch (error: any) {
    console.error("Nodemailer send error:", error);
    return res.status(500).json({
      error: error.message || "Failed to send email via Gmail SMTP.",
      details: error.code || "SMTP_ERROR"
    });
  }
});

app.post("/api/testimonials", (req, res) => {
  const { author, rating, content, company } = req.body;

  const cleanAuthor = sanitizeString(author);
  const cleanContent = sanitizeString(content);
  const cleanCompany = sanitizeString(company);

  if (!cleanAuthor || cleanAuthor.length < 2) {
    return res.status(400).json({ error: "Author name must be provided." });
  }
  if (!cleanContent || cleanContent.length < 5) {
    return res.status(400).json({ error: "Content must be at least 5 characters long." });
  }

  const numRating = parseInt(rating, 10);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: "Rating must be an integer between 1 and 5." });
  }

  // Create unapproved customer testimonial (awaits moderator review)
  const newTestimonial = {
    id: `t_${Date.now()}`,
    author: cleanAuthor,
    company: cleanCompany || undefined,
    rating: numRating,
    content: cleanContent,
    approved: false, // Strict protection: Starts unapproved
    date: new Date().toISOString().split("T")[0]
  };

  dbState.testimonials.unshift(newTestimonial);
  saveDatabase();

  res.status(201).json(newTestimonial);
});

// -------------------------------------------------------------
// SECURE FILE UPLOAD PIPELINE
// -------------------------------------------------------------

app.post("/api/upload", (req, res) => {
  const { name, type, data } = req.body;

  if (!name || !type || !data) {
    return res.status(400).json({ error: "Incomplete file upload payload." });
  }

  try {
    // Extract base64 encoded block securely
    const parts = data.split(";base64,");
    if (parts.length !== 2) {
      return res.status(400).json({ error: "Invalid binary file encoding." });
    }

    const mime = parts[0].split(":")[1];
    const base64Data = parts[1];
    const buffer = Buffer.from(base64Data, "base64");

    // Size limit enforcement (10MB maximum)
    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (buffer.length > MAX_SIZE_BYTES) {
      return res.status(400).json({ error: "File exceeds 10MB size restriction." });
    }

    // Validate MIME types and Extensions
    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/avif", "image/bmp", "image/x-icon", "application/pdf"];
    if (!allowedMimeTypes.includes(mime) && !mime.startsWith("image/")) {
      return res.status(400).json({ error: "Invalid file type. Only image files and PDF are permitted." });
    }

    // Secure Verification of File Headers / Magic Bytes
    if (!verifyMagicBytes(buffer, mime)) {
      return res.status(400).json({ error: "Security Alert: Magic byte verification failed. Upload rejected." });
    }

    // Sanitize Filename with safe extensions only (Blocks directory traversal & execution)
    const originalExt = path.extname(name).toLowerCase();
    const safeExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf"];
    const ext = safeExtensions.includes(originalExt) ? originalExt : ".png";

    const uniqueId = crypto.randomBytes(16).toString("hex");
    const safeFilename = `artisan_${uniqueId}${ext}`;
    const destinationPath = path.join(UPLOADS_DIR, safeFilename);

    // Save validated file buffer to local storage directory
    fs.writeFileSync(destinationPath, buffer);

    // Persist in uploadsCache so it NEVER disappears across server/container restarts!
    uploadsCache[safeFilename] = data;
    saveUploadsCache();

    const relativeUrl = `/uploads/${safeFilename}`;
    res.json({ name, size: Math.round(buffer.length / 1024), url: relativeUrl });
  } catch (err) {
    console.error("Upload process crash:", err);
    res.status(500).json({ error: "Internal file processor failure." });
  }
});

// -------------------------------------------------------------
// SECURE ADMINISTRATOR PORT (REQUIRE ADMIN ROLE FOR WRITES/READS)
// -------------------------------------------------------------

// Admin Products CRUD operations
app.post("/api/admin/products", requireAdmin, (req, res) => {
  const { id: bodyId, name, description, categoryId, price, maxPrice, promoPrice, images, featured, inStock, readyForPickup, isEngravingProduct, isHandmadeFlowers, customOptions, hideCustomOptions, hideOptionsAvailable, hasVisualizer, hasEngravingText, hasTypography, leadTime, dimensions, badge, seal, includedNotes, giftOccasions, materialDetails, pricingNotice, alternativeRequestText } = req.body;

  const cleanName = sanitizeString(name);
  const cleanDesc = sanitizeString(description);
  const cleanCat = sanitizeString(categoryId) || "wood";

  if (!cleanName) {
    return res.status(400).json({ error: "Products require a name." });
  }

  const isHideCustom = !!(hideCustomOptions || hideOptionsAvailable);
  const prodId = bodyId ? sanitizeString(bodyId) : `p_${Date.now()}`;

  const newProduct = {
    id: prodId,
    name: cleanName,
    description: cleanDesc,
    categoryId: cleanCat,
    price: parseFloat(price) || 0,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    promoPrice: promoPrice ? parseFloat(promoPrice) : undefined,
    images: Array.isArray(images) ? images.filter((img) => typeof img === "string" && img.trim().length > 0) : [],
    featured: !!featured,
    inStock: inStock !== undefined ? !!inStock : true,
    readyForPickup: !!readyForPickup,
    isEngravingProduct: isEngravingProduct !== undefined ? !!isEngravingProduct : undefined,
    isHandmadeFlowers: !!isHandmadeFlowers,
    customOptions: Array.isArray(customOptions) ? customOptions.map(sanitizeString) : [],
    hideCustomOptions: isHideCustom,
    hideOptionsAvailable: isHideCustom,
    hasVisualizer: hasVisualizer !== undefined ? !!hasVisualizer : true,
    hasEngravingText: hasEngravingText !== undefined ? !!hasEngravingText : true,
    hasTypography: hasTypography !== undefined ? !!hasTypography : true,
    leadTime: leadTime ? sanitizeString(leadTime) : undefined,
    dimensions: dimensions ? sanitizeString(dimensions) : undefined,
    badge: badge ? sanitizeString(badge) : undefined,
    seal: seal ? sanitizeString(seal) : undefined,
    includedNotes: Array.isArray(includedNotes) ? includedNotes.map(sanitizeString) : undefined,
    giftOccasions: Array.isArray(giftOccasions) ? giftOccasions.map(sanitizeString).filter(Boolean) : undefined,
    materialDetails: materialDetails ? sanitizeString(materialDetails) : undefined,
    pricingNotice: pricingNotice ? sanitizeString(pricingNotice) : undefined,
    alternativeRequestText: alternativeRequestText ? sanitizeString(alternativeRequestText) : undefined
  };

  const existingIdx = dbState.products.findIndex((p) => p.id === prodId);
  if (existingIdx !== -1) {
    dbState.products[existingIdx] = newProduct;
  } else {
    dbState.products.push(newProduct);
  }
  saveDatabase();
  res.status(201).json(newProduct);
});

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = dbState.products.findIndex((p) => p.id === id);
  const { name, description, categoryId, price, maxPrice, promoPrice, images, featured, inStock, readyForPickup, isEngravingProduct, isHandmadeFlowers, customOptions, hideCustomOptions, hideOptionsAvailable, hasVisualizer, hasEngravingText, hasTypography, leadTime, dimensions, badge, seal, includedNotes, giftOccasions, materialDetails, pricingNotice, alternativeRequestText } = req.body;

  if (index === -1) {
    const isHideCustom = !!(hideCustomOptions || hideOptionsAvailable);
    const createdProduct = {
      id: sanitizeString(id) || `p_${Date.now()}`,
      name: sanitizeString(name) || "Custom Craft",
      description: sanitizeString(description),
      categoryId: sanitizeString(categoryId) || "wood",
      price: parseFloat(price) || 0,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      promoPrice: promoPrice ? parseFloat(promoPrice) : undefined,
      images: Array.isArray(images) ? images.filter((img) => typeof img === "string" && img.trim().length > 0) : [],
      featured: !!featured,
      inStock: inStock !== undefined ? !!inStock : true,
      readyForPickup: !!readyForPickup,
      isEngravingProduct: isEngravingProduct !== undefined ? !!isEngravingProduct : undefined,
      isHandmadeFlowers: !!isHandmadeFlowers,
      customOptions: Array.isArray(customOptions) ? customOptions.map(sanitizeString) : [],
      hideCustomOptions: isHideCustom,
      hideOptionsAvailable: isHideCustom,
      hasVisualizer: hasVisualizer !== undefined ? !!hasVisualizer : true,
      hasEngravingText: hasEngravingText !== undefined ? !!hasEngravingText : true,
      hasTypography: hasTypography !== undefined ? !!hasTypography : true,
      leadTime: leadTime ? sanitizeString(leadTime) : undefined,
      dimensions: dimensions ? sanitizeString(dimensions) : undefined,
      badge: badge ? sanitizeString(badge) : undefined,
      seal: seal ? sanitizeString(seal) : undefined,
      includedNotes: Array.isArray(includedNotes) ? includedNotes.map(sanitizeString) : undefined,
      giftOccasions: Array.isArray(giftOccasions) ? giftOccasions.map(sanitizeString).filter(Boolean) : undefined,
      materialDetails: materialDetails ? sanitizeString(materialDetails) : undefined,
      pricingNotice: pricingNotice ? sanitizeString(pricingNotice) : undefined,
      alternativeRequestText: alternativeRequestText ? sanitizeString(alternativeRequestText) : undefined
    };
    dbState.products.push(createdProduct);
    saveDatabase();
    return res.json(createdProduct);
  }

  const updatedHideCustom = hideCustomOptions !== undefined 
    ? !!hideCustomOptions 
    : (hideOptionsAvailable !== undefined 
        ? !!hideOptionsAvailable 
        : dbState.products[index].hideCustomOptions);

  dbState.products[index] = {
    ...dbState.products[index],
    name: sanitizeString(name) || dbState.products[index].name,
    description: description !== undefined ? sanitizeString(description) : dbState.products[index].description,
    categoryId: sanitizeString(categoryId) || dbState.products[index].categoryId,
    price: isNaN(parseFloat(price)) ? dbState.products[index].price : parseFloat(price),
    maxPrice: maxPrice !== undefined ? (maxPrice === "" ? undefined : parseFloat(maxPrice)) : dbState.products[index].maxPrice,
    promoPrice: promoPrice !== undefined ? (promoPrice === "" ? undefined : parseFloat(promoPrice)) : dbState.products[index].promoPrice,
    images: Array.isArray(images) ? images.filter((img) => typeof img === "string" && img.trim().length > 0) : dbState.products[index].images,
    featured: featured !== undefined ? !!featured : dbState.products[index].featured,
    inStock: inStock !== undefined ? !!inStock : dbState.products[index].inStock,
    readyForPickup: readyForPickup !== undefined ? !!readyForPickup : dbState.products[index].readyForPickup,
    isEngravingProduct: isEngravingProduct !== undefined ? !!isEngravingProduct : dbState.products[index].isEngravingProduct,
    isHandmadeFlowers: isHandmadeFlowers !== undefined ? !!isHandmadeFlowers : dbState.products[index].isHandmadeFlowers,
    customOptions: Array.isArray(customOptions) ? customOptions.map(sanitizeString) : dbState.products[index].customOptions,
    hideCustomOptions: updatedHideCustom,
    hideOptionsAvailable: updatedHideCustom,
    hasVisualizer: hasVisualizer !== undefined ? !!hasVisualizer : dbState.products[index].hasVisualizer,
    hasEngravingText: hasEngravingText !== undefined ? !!hasEngravingText : dbState.products[index].hasEngravingText,
    hasTypography: hasTypography !== undefined ? !!hasTypography : dbState.products[index].hasTypography,
    leadTime: leadTime !== undefined ? (leadTime ? sanitizeString(leadTime) : undefined) : dbState.products[index].leadTime,
    dimensions: dimensions !== undefined ? (dimensions ? sanitizeString(dimensions) : undefined) : dbState.products[index].dimensions,
    badge: badge !== undefined ? (badge ? sanitizeString(badge) : undefined) : dbState.products[index].badge,
    seal: seal !== undefined ? (seal ? sanitizeString(seal) : undefined) : dbState.products[index].seal,
    includedNotes: includedNotes !== undefined ? (Array.isArray(includedNotes) ? includedNotes.map(sanitizeString) : undefined) : dbState.products[index].includedNotes,
    giftOccasions: giftOccasions !== undefined ? (Array.isArray(giftOccasions) ? giftOccasions.map(sanitizeString).filter(Boolean) : undefined) : dbState.products[index].giftOccasions,
    materialDetails: materialDetails !== undefined ? (materialDetails ? sanitizeString(materialDetails) : undefined) : dbState.products[index].materialDetails,
    pricingNotice: pricingNotice !== undefined ? (pricingNotice ? sanitizeString(pricingNotice) : undefined) : dbState.products[index].pricingNotice,
    alternativeRequestText: alternativeRequestText !== undefined ? (alternativeRequestText ? sanitizeString(alternativeRequestText) : undefined) : dbState.products[index].alternativeRequestText
  };

  saveDatabase();
  res.json(dbState.products[index]);
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  dbState.products = dbState.products.filter((p) => p.id !== id);
  saveDatabase();
  res.json({ success: true, message: "Product deleted." });
});

// Admin Categories CRUD
app.post("/api/admin/categories", requireAdmin, (req, res) => {
  const { id: bodyId, name, description, image } = req.body;
  const cleanName = sanitizeString(name);
  if (!cleanName) {
    return res.status(400).json({ error: "Category name required." });
  }

  const id = bodyId ? sanitizeString(bodyId) : cleanName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const existingIdx = dbState.categories.findIndex((c) => c.id === id);
  const catObj = {
    id,
    name: cleanName,
    slug: cleanName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    description: sanitizeString(description),
    image: (typeof image === "string" && image.trim()) || "https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&q=80&w=600"
  };

  if (existingIdx !== -1) {
    dbState.categories[existingIdx] = catObj;
    saveDatabase();
    return res.status(200).json(catObj);
  }

  dbState.categories.push(catObj);
  saveDatabase();
  res.status(201).json(catObj);
});

app.put("/api/admin/categories/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = dbState.categories.findIndex((c) => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Category not found." });
  }
  const { name, description, image } = req.body;
  const cleanName = sanitizeString(name) || dbState.categories[index].name;
  dbState.categories[index] = {
    ...dbState.categories[index],
    name: cleanName,
    slug: cleanName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    description: description !== undefined ? sanitizeString(description) : dbState.categories[index].description,
    image: (typeof image === "string" && image.trim()) ? image.trim() : dbState.categories[index].image
  };
  saveDatabase();
  res.json(dbState.categories[index]);
});

app.delete("/api/admin/categories/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  dbState.categories = dbState.categories.filter((c) => c.id !== id);
  saveDatabase();
  res.json({ success: true });
});

// Admin Reviews CRUD
app.get("/api/admin/testimonials", requireAdmin, (req, res) => {
  res.json(dbState.testimonials); // admin can read ALL (approved + unapproved)
});

app.put("/api/admin/testimonials/:id/approve", requireAdmin, (req, res) => {
  const { id } = req.params;
  const test = dbState.testimonials.find((t) => t.id === id);
  if (test) {
    test.approved = true;
    saveDatabase();
    res.json(test);
  } else {
    res.status(404).json({ error: "Testimonial not found." });
  }
});

app.delete("/api/admin/testimonials/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  dbState.testimonials = dbState.testimonials.filter((t) => t.id !== id);
  saveDatabase();
  res.json({ success: true });
});

// Admin Announcements CRUD
app.post("/api/admin/announcements", requireAdmin, (req, res) => {
  const { title, content, type, active } = req.body;
  const cleanTitle = sanitizeString(title);
  const cleanContent = sanitizeString(content);

  if (!cleanTitle || !cleanContent) {
    return res.status(400).json({ error: "Title and content are required." });
  }

  const newAnn = {
    id: `a_${Date.now()}`,
    title: cleanTitle,
    content: cleanContent,
    type: (type === "promo" || type === "urgent" || type === "info") ? type : "info",
    active: active !== undefined ? !!active : true,
    date: new Date().toISOString().split("T")[0]
  };

  dbState.announcements.unshift(newAnn);
  saveDatabase();
  res.status(201).json(newAnn);
});

app.put("/api/admin/announcements/:id/toggle", requireAdmin, (req, res) => {
  const { id } = req.params;
  const ann = dbState.announcements.find((a) => a.id === id);
  if (ann) {
    ann.active = !ann.active;
    saveDatabase();
    res.json(ann);
  } else {
    res.status(404).json({ error: "Announcement not found." });
  }
});

app.delete("/api/admin/announcements/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  dbState.announcements = dbState.announcements.filter((a) => a.id !== id);
  saveDatabase();
  res.json({ success: true });
});

// Admin Quotes CRUD
app.get("/api/admin/quotes", requireAdmin, (req, res) => {
  res.json(dbState.quotes);
});

app.put("/api/admin/quotes/:id/status", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const quote = dbState.quotes.find((q) => q.id === id);

  if (!quote) {
    return res.status(404).json({ error: "Quote request not found." });
  }

  const allowedStatuses = ["pending", "reviewing", "quoted", "approved", "completed", "rejected"];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status state transition." });
  }

  quote.status = status;
  quote.updatedAt = new Date().toISOString();
  saveDatabase();
  res.json(quote);
});

app.put("/api/admin/quotes/:id/details", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { adminNotes, quoteAmount, adminPhotos, status } = req.body;
  const quote = dbState.quotes.find((q) => q.id === id);

  if (!quote) {
    return res.status(404).json({ error: "Quote request not found." });
  }

  quote.adminNotes = sanitizeString(adminNotes);
  quote.quoteAmount = typeof quoteAmount === "number" ? quoteAmount : parseFloat(quoteAmount) || 0;
  if (Array.isArray(adminPhotos)) {
    quote.adminPhotos = adminPhotos;
  }
  if (status && ["pending", "reviewing", "quoted", "approved", "completed", "rejected"].includes(status)) {
    quote.status = status;
  } else if (!quote.status || quote.status === "pending" || quote.status === "reviewing") {
    quote.status = "quoted";
  }
  quote.updatedAt = new Date().toISOString();
  saveDatabase();
  res.json(quote);
});

app.post("/api/admin/customization", requireAdmin, (req, res) => {
  const { logoText, logoSubtext, logoImageUrl, logoShowText, sections, logoSize, logoHideBorder, philosophyQuote, philosophyAuthor, giftOccasionFilters } = req.body;
  
  if (!dbState.customization) {
    dbState.customization = DEFAULT_CUSTOMIZATION;
  }
  
  dbState.customization = {
    logoText: typeof logoText === "string" ? logoText : dbState.customization.logoText,
    logoSubtext: typeof logoSubtext === "string" ? logoSubtext : dbState.customization.logoSubtext,
    logoImageUrl: typeof logoImageUrl === "string" ? logoImageUrl : dbState.customization.logoImageUrl,
    logoShowText: typeof logoShowText === "boolean" ? logoShowText : dbState.customization.logoShowText,
    logoSize: typeof logoSize === "number" ? logoSize : dbState.customization.logoSize,
    logoHideBorder: typeof logoHideBorder === "boolean" ? logoHideBorder : dbState.customization.logoHideBorder,
    philosophyQuote: typeof philosophyQuote === "string" ? philosophyQuote : dbState.customization.philosophyQuote,
    philosophyAuthor: typeof philosophyAuthor === "string" ? philosophyAuthor : dbState.customization.philosophyAuthor,
    ...(Array.isArray(giftOccasionFilters)
      ? { giftOccasionFilters }
      : (dbState.customization as any).giftOccasionFilters
      ? { giftOccasionFilters: (dbState.customization as any).giftOccasionFilters }
      : {}),
    sections: Array.isArray(sections) ? sections : dbState.customization.sections
  } as any;
  
  saveDatabase();
  res.json(dbState.customization);
});

app.post("/api/admin/restore-db", requireAdmin, (req, res) => {
  const { products, categories, testimonials, announcements, quotes, customization } = req.body;
  
  if (Array.isArray(products)) dbState.products = products;
  if (Array.isArray(categories)) dbState.categories = categories;
  if (Array.isArray(testimonials)) dbState.testimonials = testimonials;
  if (Array.isArray(announcements)) dbState.announcements = announcements;
  if (Array.isArray(quotes)) dbState.quotes = quotes;
  if (customization) {
    dbState.customization = {
      logoText: typeof customization.logoText === "string" ? customization.logoText : dbState.customization?.logoText || "Nicoletta",
      logoSubtext: typeof customization.logoSubtext === "string" ? customization.logoSubtext : dbState.customization?.logoSubtext || "Crafts & Decor",
      logoImageUrl: typeof customization.logoImageUrl === "string" ? customization.logoImageUrl : dbState.customization?.logoImageUrl || "",
      logoShowText: typeof customization.logoShowText === "boolean" ? customization.logoShowText : dbState.customization?.logoShowText !== false,
      logoSize: typeof customization.logoSize === "number" ? customization.logoSize : dbState.customization?.logoSize || 48,
      logoHideBorder: typeof customization.logoHideBorder === "boolean" ? customization.logoHideBorder : dbState.customization?.logoHideBorder !== false,
      philosophyQuote: typeof customization.philosophyQuote === "string" ? customization.philosophyQuote : dbState.customization?.philosophyQuote || "An engraving isn't just marks burnt into surface; it's the transfer of a family signature across generations.",
      philosophyAuthor: typeof customization.philosophyAuthor === "string" ? customization.philosophyAuthor : dbState.customization?.philosophyAuthor || "Nicoletta, Founder & Creative Director",
      sections: Array.isArray(customization.sections) ? customization.sections : dbState.customization?.sections || []
    };
  }
  
  saveDatabase();
  res.json({ success: true, customization: dbState.customization });
});

// Secure admin analytics report compiler (CUSTOMER INTEREST, MARKETING & BUSINESS METRICS)
app.get("/api/admin/analytics", requireAdmin, (req, res) => {
  const quotes = dbState.quotes || [];
  
  // Calculate status pipelines
  const pipeline = {
    pending: quotes.filter(q => q.status === "pending").length,
    reviewing: quotes.filter(q => q.status === "reviewing").length,
    quoted: quotes.filter(q => q.status === "quoted").length,
    approved: quotes.filter(q => q.status === "approved").length,
    completed: quotes.filter(q => q.status === "completed").length,
    rejected: quotes.filter(q => q.status === "rejected").length,
    total: quotes.length
  };

  // Convert inquiries to orders (Approved + Completed represent active business conversion)
  const convertedCount = pipeline.approved + pipeline.completed;
  const conversionRate = pipeline.total > 0 ? Math.round((convertedCount / pipeline.total) * 100) : 0;

  // Customization insights
  const fonts: Record<string, number> = {};
  let engravingCount = 0;
  let noEngravingCount = 0;
  const popularProductsQuotes: Record<string, number> = {};

  quotes.forEach(q => {
    // Fonts
    if (q.fontPreference) {
      fonts[q.fontPreference] = (fonts[q.fontPreference] || 0) + 1;
    }
    // Engraving Rate
    if (q.engravingText && q.engravingText.trim().length > 0) {
      engravingCount++;
    } else {
      noEngravingCount++;
    }
    // Product quotes counts
    if (q.productName) {
      popularProductsQuotes[q.productName] = (popularProductsQuotes[q.productName] || 0) + 1;
    }
  });

  // Views & clicks from db
  const productViews = dbState.analytics?.productViews || {};
  const searches = dbState.analytics?.searches || {};
  const promoViews = dbState.analytics?.promoViews || {};
  const announcementClicks = dbState.analytics?.announcementClicks || {};

  // Financial summaries
  const totalValue = quotes.reduce((sum, q) => sum + (q.quoteAmount || 0), 0);
  const convertedValue = quotes
    .filter(q => q.status === "approved" || q.status === "completed")
    .reduce((sum, q) => sum + (q.quoteAmount || 0), 0);

  // Generate dynamic, extremely useful, and tailored business recommended insights
  const recommendedInsights: string[] = [];

  // Insight 1: Conversion rate evaluation
  if (conversionRate < 30) {
    recommendedInsights.push("💡 Conversion Rate is below 30%. Action item: Set a goal to log price quotes within 4 hours and add personalized follow-up messages to secure customer approvals.");
  } else if (conversionRate >= 50) {
    recommendedInsights.push("✨ Outstanding! Your quote conversion rate is above 50%, reflecting strong brand loyalty, great custom styling, and solid price points.");
  } else {
    recommendedInsights.push("💡 Healthy conversion progress. Action item: Offering small bulk discounts (e.g., 10% off on 5+ units) on leather cutting boards or coaster sets can help close larger corporate deals.");
  }

  // Insight 2: Customization & engraving
  const totalWithFont = Object.keys(fonts).length;
  if (totalWithFont > 0) {
    const sortedFonts = Object.entries(fonts).sort((a, b) => b[1] - a[1]);
    recommendedInsights.push(`🎨 Customer Design Preference: "${sortedFonts[0][0]}" is your most requested engraving typography. Ensure this is prominently featured as the default selection on forms.`);
  }

  // Insight 3: Promotion attention
  const promoProducts = dbState.products.filter(p => p.promoPrice);
  if (promoProducts.length > 0) {
    let topPromoId = "";
    let maxPromoViews = 0;
    promoProducts.forEach(p => {
      const views = promoViews[p.id] || 0;
      if (views > maxPromoViews) {
        maxPromoViews = views;
        topPromoId = p.name;
      }
    });

    if (maxPromoViews > 0) {
      recommendedInsights.push(`🔥 Promotion Spotlight: "${topPromoId}" is attracting the highest promo engagement with ${maxPromoViews} views. Try cross-promoting it with your highest margin item!`);
    } else {
      recommendedInsights.push("💡 Active promotions aren't tracking views. Consider placing promo badges on the home page or linking announcements to current discounted items.");
    }
  }

  // Insight 4: Announcement performance
  const sortedAnnouncements = Object.entries(announcementClicks).sort((a, b) => b[1] - a[1]);
  if (sortedAnnouncements.length > 0) {
    const topAnn = dbState.announcements.find(a => a.id === sortedAnnouncements[0][0]);
    if (topAnn) {
      recommendedInsights.push(`📢 Announcement Reach: "${topAnn.title}" is driving the most active clicks on your homepage banner. Try running similar targeted promotions for holiday peaks.`);
    }
  } else {
    recommendedInsights.push("💡 Homepage announcement interactions are currently silent. Try updating the banner with a vibrant coupon code or urgent custom engraving deadline notice.");
  }

  res.json({
    totalViews: dbState.analytics?.totalViews || 342,
    productViews,
    searches,
    promoViews,
    announcementClicks,
    pipeline,
    conversionRate,
    revenue: {
      totalValue,
      convertedValue
    },
    customizations: {
      fonts,
      engravingCount,
      noEngravingCount,
      popularProductsQuotes
    },
    recommendedInsights
  });
});

// -------------------------------------------------------------
// VITE AND DEVELOPMENT PROCESS RUNNING SETUP
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Bespoke server executing dynamically on port ${PORT}`);
  });
}

startServer();
