import { Category, Product, Testimonial, Announcement } from "./types";

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: "wood",
    name: "Handcrafted Woodware",
    slug: "handcrafted-woodware",
    description: "Premium heirloom-quality hardwoods, precision-engraved with family monograms, custom logos, or messages. Finished in organic food-safe board oil.",
    image: "https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: "leather",
    name: "Monogrammed Leather",
    slug: "monogrammed-leather",
    description: "Genuine full-grain leather goods laser-etched with crisp detailing. Perfect for executive gifts, travel accessories, and bespoke daily use.",
    image: "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: "glassware",
    name: "Etched Glass & Crystal",
    slug: "etched-glass-crystal",
    description: "Sandblast-look high-end glassware. Elevate your whiskey, wine, or craft beer experience with customized glassware for homes and events.",
    image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: "slate",
    name: "Natural Slate Coasters & Plaques",
    slug: "natural-slate",
    description: "Textured, dark natural slate stones precision-etched with beautiful designs. Elegant serving platters, memorial stones, and heat-resistant coasters.",
    image: "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: "pipecleaner",
    name: "Pipe Cleaner Everlasting Flowers",
    slug: "pipe-cleaner-flowers",
    description: "Beautiful, colorful hand-crafted pipe cleaner bouquets and single stems. Perfect everlasting blooms for centerpieces, gifts, and unique desk decorations. Request roses, tulips, sunflowers, or customized colors!",
    image: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: "sublimation",
    name: "Sublimation Custom Full-Color Gifts",
    slug: "sublimation-custom-gifts",
    description: "Vibrant, full-color heat-press sublimation goods including mugs, puzzles, keychains, tumblers, and buttons. Fully personalized with your custom photos, artwork, or lettering.",
    image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&q=80&w=600"
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Heritage Walnut Cutting Board",
    description: "Exquisite hand-planed American Walnut serving board with deep juice grooves and finger grips. Perfect for wedding, anniversary, or housewarming gifts. Includes custom engraving on bottom-right corner.",
    categoryId: "wood",
    price: 85,
    promoPrice: 75,
    images: [
      "https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1590736969955-71cb94801759?auto=format&fit=crop&q=80&w=600"
    ],
    featured: true,
    inStock: true,
    customOptions: ["Wood Type (Walnut, Maple, Cherry)", "Engraving Monogram Layout", "Juice Groove (Yes/No)"]
  },
  {
    id: "p2",
    name: "Bespoke Full-Grain Leather Journal",
    description: "Hand-stitched leather notebook cover containing a premium unlined paper notebook. The laser-engraving creates a rich, dark contrasted branding into the leather surface. Reusable design fits A5 inserts.",
    categoryId: "leather",
    price: 48,
    images: [
      "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&q=80&w=600"
    ],
    featured: true,
    inStock: true,
    customOptions: ["Leather Color (Rustic Tan, Dark Espresso, Onyx)", "Engraving Font Style"]
  },
  {
    id: "p3",
    name: "Monogram Whiskey Decanter Set",
    description: "An elegant, heavy-bottomed 750ml glass decanter paired with two matching 10oz rocks glasses. Sandblast-etched with your custom crest or family initials. Glass etching is completely dishwasher safe and permanent.",
    categoryId: "glassware",
    price: 110,
    promoPrice: 95,
    images: [
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1532635241-17e820add50f?auto=format&fit=crop&q=80&w=600"
    ],
    featured: true,
    inStock: true,
    customOptions: ["Crest Selection", "Glasses Quantity (2 or 4 Glasses)"]
  },
  {
    id: "p4",
    name: "Classic Hexagonal Slate Coasters (Set of 4)",
    description: "Rustic natural slate coasters with organic split edges and non-slip rubber feet. Your custom family name, business logo, or design is laser-etched onto each stone, providing a crisp frost-white contrast.",
    categoryId: "slate",
    price: 28,
    images: [
      "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&q=80&w=600"
    ],
    featured: false,
    inStock: true,
    customOptions: ["Coaster Shape (Hexagon, Square, Circle)", "Design Package Selector"]
  },
  {
    id: "p5",
    name: "Artisan Hardwood Flight Server",
    description: "Designed for craft beverage tastings. Carved from premium curly maple with recess wells for four tasting glasses. Fully customizable handle engraving for local breweries or back-yard hobbyists.",
    categoryId: "wood",
    price: 45,
    images: [
      "https://images.unsplash.com/photo-1590736969955-71cb94801759?auto=format&fit=crop&q=80&w=600"
    ],
    featured: false,
    inStock: true,
    customOptions: ["Number of Tasting Holes", "Handle Engraving Text"]
  },
  {
    id: "p6",
    name: "Bespoke Leather Travel Valet Tray",
    description: "Flat-packing travel organizer tray that snaps together at the corners. Perfect for holding keys, rings, and tech accessories. Precision etched with a personal monogram, design, or coordinates.",
    categoryId: "leather",
    price: 32,
    images: [
      "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&q=80&w=600"
    ],
    featured: false,
    inStock: true,
    customOptions: ["Monogram Initials"]
  },
  {
    id: "p7",
    name: "Everlasting Pipe Cleaner Sunflower",
    description: "A beautifully hand-twisted pipe cleaner sunflower with a sturdy, flexible stem. A cheerful, everlasting bloom that requires no water. Want a different flower like a Rose, Lavender, or Lily? Just submit a quote request specifying your preferred blossom and we will calculate a custom price for your bespoke bouquet!",
    categoryId: "pipecleaner",
    price: 12,
    images: [
      "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&q=80&w=600"
    ],
    featured: true,
    inStock: true,
    customOptions: ["Flower Type (Sunflower, Rose, Lavender, Tulip)", "Stem Length", "Ribbon Wrapping Color"]
  },
  {
    id: "p8",
    name: "Custom Sublimation Ceramic Mug (11oz)",
    description: "High-grade white ceramic mug heat-pressed with vibrant, full-color sublimation inks. Completely dishwasher and microwave safe. Upload your favorite photo, family portrait, or graphic, along with optional custom text to create the perfect personalized coffee mug.",
    categoryId: "sublimation",
    price: 18,
    images: [
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&q=80&w=600"
    ],
    featured: true,
    inStock: true,
    customOptions: ["Mug Size (11oz, 15oz)", "Inner Rim Color (White, Black, Red, Blue)", "Finish (Glossy, Matte)", "Printed Font Size (Small, Medium, Large, Other)"]
  },
  {
    id: "p9",
    name: "Bespoke Acrylic Sublimation Keychain",
    description: "Durable clear acrylic keychains printed in stunning high-definition full-color. Perfect for preserving family pictures, pet photos, or custom monogram graphics. Upload your design and carry your favorite memories wherever you go.",
    categoryId: "sublimation",
    price: 8,
    images: [
      "https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&q=80&w=600"
    ],
    featured: false,
    inStock: true,
    customOptions: ["Keychain Shape (Circle, Rectangle, Heart)", "Ring Metal (Silver, Gold)"]
  },
  {
    id: "p10",
    name: "Custom Insulated Sublimation Tumbler (20oz)",
    description: "Double-walled stainless steel travel tumbler sublimation-printed in gorgeous full wrap-around colors. Keeps drinks icy cold or steaming hot. Upload your custom design, photo, pattern, or name print.",
    categoryId: "sublimation",
    price: 25,
    promoPrice: 22,
    images: [
      "https://images.unsplash.com/photo-1576016770956-debb63d900ee?auto=format&fit=crop&q=80&w=600"
    ],
    featured: false,
    inStock: true,
    customOptions: ["Tumbler Style (Glossy White, Shimmer Silver)", "Lid Type (Sliding, Straw-friendly)"]
  }
];

export const INITIAL_TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    author: "Eleanor Vance",
    company: "Oak & Iron Weddings",
    rating: 5,
    content: "The monogrammed walnut cutting boards we ordered as corporate thank-you gifts exceeded all expectations. The engraving is incredibly sharp, and the wood quality is premium. Everyone was blown away!",
    date: "2026-06-12",
    approved: true
  },
  {
    id: "t2",
    author: "David Miller",
    company: "Private Collector",
    rating: 5,
    content: "I requested a custom engraving on the whiskey decanter set for my father's 70th birthday. The custom service was friendly, and they sent a digital mockup within hours. The shipping was prompt and the final piece is a work of art.",
    date: "2026-06-28",
    approved: true
  },
  {
    id: "t3",
    author: "Samantha Cruz",
    rating: 5,
    content: "The slate coasters are perfect! The laser etching has incredibly crisp details of our wedding monogram. They make beautiful coffee table additions and arrived in perfect rustic packaging.",
    date: "2026-07-05",
    approved: true
  },
  {
    id: "t4",
    author: "Marcus Aurelius",
    rating: 4,
    content: "Excellent quality notebook. Very sturdy leather and precise letter monograms. I wish it came in green leather, but the dark espresso tan is gorgeous as well.",
    date: "2026-07-11",
    approved: false // Starts as unapproved for the Admin approval demo!
  }
];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "a1",
    title: "Summer Wedding Sale",
    content: "Planning a summer celebration? Enjoy 15% off on all personalized cutting boards and etched glassware sets. Use the Quote Form to claim this offer directly!",
    type: "promo",
    active: true,
    date: "2026-07-01"
  },
  {
    id: "a2",
    title: "Corporate Gifting Inquiries Open",
    content: "Looking for high-volume custom engraved cutting boards or coasters for corporate retreats and holidays? We offer tiered discounts and logo design setups. Reach out via our quote system.",
    type: "info",
    active: true,
    date: "2026-07-10"
  }
];
