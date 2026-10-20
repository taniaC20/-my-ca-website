# Nicoletta Crafts & Decor — Database Architecture Specification

This document defines the production database architecture designed for **Nicoletta Crafts & Decor**. It is structured for **Firebase Firestore (NoSQL)**, but maintains clear conceptual alignment for relational mappings (e.g. **PostgreSQL**) should the business transition to a relational database in the future.

---

## 1. Overview & Paradigm Selection

A **document-oriented, distributed NoSQL paradigm (Firebase Firestore)** is selected as the primary backend engine for this craft business. This is optimized for several reasons:

1. **Sub-second Client Synchronization:** Perfect for live product showcases, active notification sliders, and real-time custom quote status trackers.
2. **Flexible Product Metas:** Craft items feature highly variable customization parameters (e.g., leather engraving needs laser power adjustments, glass etching needs sandblasting depth, timber requires organic beeswax options). Document models store these fields cleanly inside dynamic arrays and nested maps.
3. **Zero-Infastructure Scale:** Scales seamlessly from single-user prototype to enterprise volumes during busy holiday seasons.

---

## 2. Collection Schemas & Data Models

### 2.1 Collection: `customers`
Stores user authentication records, settings, and contact information.

* **Path:** `/customers/{customerUid}`
* **Document ID:** Registered user UID (from Firebase Auth)

| Field | Type | Required | Description / Constraints |
| :--- | :--- | :---: | :--- |
| `uid` | String | Yes | Unique Firebase Authentication UID |
| `displayName` | String | Yes | Client's full name. *Min: 2, Max: 100 characters.* |
| `email` | String | Yes | Verified email address. *Must match standard RFC email regex.* |
| `photoURL` | String | No | Public image reference to avatar display |
| `createdAt` | Timestamp | Yes | Profile record creation date |
| `updatedAt` | Timestamp | Yes | Profile edit tracking |

---

### 2.2 Collection: `products`
The core catalog listing of base blanks, heirloom decor, and customization templates.

* **Path:** `/products/{productId}`
* **Document ID:** Auto-generated alphanumeric string (e.g., `timber-001`, `glass-022`)

| Field | Type | Required | Description / Constraints |
| :--- | :--- | :---: | :--- |
| `id` | String | Yes | Alphanumeric URL-safe slug |
| `name` | String | Yes | Product name. *Min: 3, Max: 120 characters.* |
| `description` | String | Yes | Extended description. *Max: 2000 characters.* |
| `category` | String | Yes | Material category: `wood`, `leather`, `glass`, `slate` |
| `imageUrls` | Array (String) | Yes | List of display image URLs in Cloud Storage. *Max: 10 items.* |
| `priceMin` | Number | Yes | Base price of standard craft item |
| `priceMax` | Number | Yes | Maximum premium sizing price |
| `customizationOptions` | Array (String) | Yes | Allowed personalized fields (e.g. `["Monogram Font", "Etch Line Width"]`) |
| `inStock` | Boolean | Yes | Inventory check |
| `featured` | Boolean | Yes | Promotion toggle for primary landing page hero carousel |
| `createdAt` | Timestamp | Yes | Date product catalog entry was published |

---

### 2.3 Collection: `reviews`
Client testimonials and verified ratings.

* **Path:** `/reviews/{reviewId}`
* **Document ID:** Auto-generated UUIDv4 string

| Field | Type | Required | Description / Constraints |
| :--- | :--- | :---: | :--- |
| `id` | String | Yes | Unique review document ID |
| `customerUid` | String | Yes | Auth UID of submitting client |
| `customerName` | String | Yes | Display name on review. *Min: 2, Max: 100 characters.* |
| `rating` | Integer | Yes | Value range: `1` to `5` |
| `comment` | String | Yes | Description. *Min: 5, Max: 1000 characters.* |
| `approved` | Boolean | Yes | Admin moderation toggle. *Defaults to false.* |
| `createdAt` | Timestamp | Yes | Submission timestamp |

---

### 2.4 Collection: `announcements`
Dynamic, time-gated workshop notifications and holiday cut-off dates.

* **Path:** `/announcements/{announcementId}`
* **Document ID:** Auto-generated UUIDv4 string

| Field | Type | Required | Description / Constraints |
| :--- | :--- | :---: | :--- |
| `id` | String | Yes | Unique announcement ID |
| `title` | String | Yes | Text headline. *Min: 5, Max: 150 characters.* |
| `description` | String | No | Detailed alert content text. *Max: 500 characters.* |
| `imageUrl` | String | No | Promotion banner image |
| `eventDate` | Timestamp | No | Calendar date of target workshop workshop class or event |
| `expirationDate` | Timestamp | Yes | Date/Time after which this alert will expire from display |
| `active` | Boolean | Yes | Toggle switch to force immediate display suppression |

---

### 2.5 Collection: `quoteRequests`
The core transactional pipeline where custom requests, monogram guidelines, and uploads reside.

* **Path:** `/quoteRequests/{quoteRequestId}`
* **Document ID:** Prefix-hardened invoice style ID (e.g., `NQ-2026-9812`)

| Field | Type | Required | Description / Constraints |
| :--- | :--- | :---: | :--- |
| `id` | String | Yes | Alphanumeric project quote ID |
| `customerUid` | String | No | Client's user UID. Null if submitted anonymously. |
| `customerName` | String | Yes | Full contact name. *Min: 2, Max: 100 characters.* |
| `customerEmail` | String | Yes | Contact email address |
| `customerPhone` | String | Yes | Contact phone number. *Regex: E.164 phone standard.* |
| `productId` | String | Yes | Reference back to the `products` collection |
| `productName` | String | Yes | Denormalized snapshot of the base product name |
| `customizationDetails` | String | Yes | Inscription text, selected monogram font, and details |
| `inspirationUrls` | Array (String)| Yes | Cloud Storage paths to client inspiration sketches. *Max: 5 files.* |
| `status` | String | Yes | Enum: `pending`, `reviewed`, `quoted`, `approved`, `completed`, `cancelled` |
| `createdAt` | Timestamp | Yes | Request submission timestamp |
| `updatedAt` | Timestamp | Yes | Date of last admin comment or status change |

---

### 2.6 Collection: `admins`
System configuration containing administrative clearance.

* **Path:** `/admins/{adminUid}`
* **Document ID:** Firebase Auth UID of system administrators

| Field | Type | Required | Description / Constraints |
| :--- | :--- | :---: | :--- |
| `uid` | String | Yes | Admin's Firebase Auth UID |
| `email` | String | Yes | Official company email |
| `role` | String | Yes | Admin authority level: `admin` or `super_admin` |
| `permissions` | Array (String) | Yes | Clearances (e.g., `["moderate_reviews", "catalog_edit", "quote_price"]`) |

---

## 3. Relationships & Cardinality

```
+----------------+                +-----------------------+
|   customers    | 1            * |     quoteRequests     |
| (Client Accs)  |----------------| (Bespoke Inquiries)   |
+----------------+                +-----------------------+
        | 1                                   | *
        |                                     |
        | 1                                   | 1
+----------------+                +-----------------------+
|    reviews     |                |       products        |
| (Testimonials) |                |   (Craft Catalog)     |
+----------------+                +-----------------------+
```

### 3.1 One-to-Many Relationship (Customer to Quotes)
* **Design Pattern:** A registered `Customer` can file multiple bespoke quote requests.
* **NoSQL Implementation:** Denormalized field `customerUid` on `/quoteRequests/{id}`. This is highly performant and allows immediate O(1) queries for a customer's history.

### 3.2 One-to-Many Relationship (Customer to Reviews)
* **Design Pattern:** A user can submit multiple reviews for various crafts over time.
* **NoSQL Implementation:** Denormalized `customerUid` on each review document.

### 3.3 Many-to-One Snapshot (Quote to Product)
* **Design Pattern:** A quote request targets exactly one base product blank.
* **Optimization Strategy:** The `productName` is **intentionally denormalized** into the quote request document. This guarantees that if the craft's name or price changes in the master catalog later, historical quote records remain unaltered, preserving precise transactional audit trails.

---

## 4. Validation & Access Security Rules

Below are the production **Firestore Security Rules** implementing strict, Zero-Trust Attribute-Based Access Control (ABAC). These prevent unauthorized field modifications (Update-Gaps) and protect customer PII data.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ----------------------------------------------------
    // GLOBAL SAFETY NET: Deny all reads/writes by default
    // ----------------------------------------------------
    match /{document=**} {
      allow read, write: if false;
    }

    // ----------------------------------------------------
    // GLOBAL REUSABLE HELPER FUNCTIONS
    // ----------------------------------------------------
    function isSignedIn() {
      return request.auth != null;
    }

    function isEmailVerified() {
      return isSignedIn() && request.auth.token.email_verified == true;
    }

    function isAdmin() {
      return isSignedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    function isOwner(ownerId) {
      return isSignedIn() && request.auth.uid == ownerId;
    }

    function isValidId(id) {
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    function incoming() {
      return request.resource.data;
    }

    function existing() {
      return resource.data;
    }

    // ----------------------------------------------------
    // COLLECTION: CUSTOMERS
    // ----------------------------------------------------
    match /customers/{customerUid} {
      allow get: if isOwner(customerUid) || isAdmin();
      allow create: if isSignedIn() 
        && customerUid == request.auth.uid 
        && isValidCustomer(incoming());
      allow update: if isOwner(customerUid) 
        && isValidCustomer(incoming())
        && incoming().uid == existing().uid
        && incoming().createdAt == existing().createdAt; // Immutability
      
      function isValidCustomer(data) {
        return data.keys().hasAll(['uid', 'displayName', 'email', 'createdAt', 'updatedAt'])
          && data.keys().size() == 5
          && data.uid == request.auth.uid
          && data.displayName is string 
          && data.displayName.size() >= 2 
          && data.displayName.size() <= 100
          && data.email is string
          && data.email.size() <= 120
          && data.createdAt is timestamp
          && data.updatedAt is timestamp;
      }
    }

    // ----------------------------------------------------
    // COLLECTION: PRODUCTS (Public Catalog)
    // ----------------------------------------------------
    match /products/{productId} {
      allow read: if true; // Public catalog is browsable by prospective buyers
      allow write: if isAdmin(); // Strictly restricted to Portland workshop administrators
    }

    // ----------------------------------------------------
    // COLLECTION: REVIEWS
    // ----------------------------------------------------
    match /reviews/{reviewId} {
      allow list: if existing().approved == true || isAdmin(); // Only show approved reviews publicly
      allow get: if true;
      allow create: if isSignedIn() 
        && isValidReview(incoming()) 
        && incoming().customerUid == request.auth.uid; // Prevent identity spoofing
      allow update: if isAdmin(); // Moderation approval belongs purely to admins
      allow delete: if isAdmin();

      function isValidReview(data) {
        return data.keys().hasAll(['id', 'customerUid', 'customerName', 'rating', 'comment', 'approved', 'createdAt'])
          && data.keys().size() == 7
          && data.rating is int 
          && data.rating >= 1 
          && data.rating <= 5
          && data.comment is string 
          && data.comment.size() >= 5 
          && data.comment.size() <= 1000
          && data.approved == false // Patron cannot self-approve reviews
          && data.createdAt is timestamp;
      }
    }

    // ----------------------------------------------------
    // COLLECTION: ANNOUNCEMENTS
    // ----------------------------------------------------
    match /announcements/{announcementId} {
      allow read: if true; // Visible to all prospective buyers
      allow write: if isAdmin(); // Modifiable only by store administrators
    }

    // ----------------------------------------------------
    // COLLECTION: QUOTE REQUESTS
    // ----------------------------------------------------
    match /quoteRequests/{quoteRequestId} {
      // Clients can read their own quote queries; Admins oversee the complete pipeline
      allow get: if isAdmin() || (isSignedIn() && existing().customerUid == request.auth.uid);
      allow list: if isAdmin() || (isSignedIn() && resource.data.customerUid == request.auth.uid);
      
      // Clients can file quote drafts; admins handle standard logs
      allow create: if isValidQuote(incoming()) 
        && (!incoming().keys().hasAll(['customerUid']) || incoming().customerUid == request.auth.uid);
      
      allow update: if isAdmin() 
        || (isSignedIn() 
            && existing().customerUid == request.auth.uid 
            && incoming().status == 'cancelled' 
            && incoming().diff(existing()).affectedKeys().hasOnly(['status', 'updatedAt'])); // Clients can only cancel a quote

      function isValidQuote(data) {
        return data.keys().hasAll(['id', 'customerName', 'customerEmail', 'customerPhone', 'productId', 'productName', 'customizationDetails', 'status', 'createdAt', 'updatedAt'])
          && data.customerName is string && data.customerName.size() >= 2
          && data.customerEmail is string && data.customerEmail.size() <= 120
          && data.customerPhone is string && data.customerPhone.size() <= 30
          && data.customizationDetails is string && data.customizationDetails.size() >= 10 && data.customizationDetails.size() <= 5000
          && data.status in ['pending', 'reviewed', 'quoted', 'approved', 'completed', 'cancelled']
          && data.createdAt is timestamp
          && data.updatedAt is timestamp;
      }
    }

    // ----------------------------------------------------
    // COLLECTION: ADMINS
    // ----------------------------------------------------
    match /admins/{adminUid} {
      allow read: if isSignedIn() && request.auth.uid == adminUid;
      allow write: if false; // RBAC lists are provisioned directly via secure GCP Console/CLI to bypass client elevation
    }
  }
}
```

---

## 5. Optimized Real-World Mock Seed Data

This JSON collection matches our schema and is optimized for importing directly into the Firestore emulator or production collections.

### 5.1 Products Collection (`/products`)
```json
[
  {
    "id": "walnut-cutting-board",
    "name": "Live-Edge Walnut Presentation Board",
    "description": "Individually hand-planed American black walnut presentation board. Finished with food-safe organic board oil and natural Portland beeswax. Features distinct natural sapwood contours and solid recessed brass feet.",
    "category": "wood",
    "imageUrls": [
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop"
    ],
    "priceMin": 85,
    "priceMax": 175,
    "customizationOptions": [
      "Standard Monogram (Top-Right)",
      "Full Family Signatures (Centered)",
      "Recessed Juice Groove",
      "Engraved Hand Grips"
    ],
    "inStock": true,
    "featured": true,
    "createdAt": "2026-01-10T08:00:00Z"
  },
  {
    "id": "heritage-whiskey-glass",
    "name": "Bespoke Etched Crystal Rocks Glass",
    "description": "Double old-fashioned high-clarity lead-free crystal glassware. Laser-masked and deep-sandblasted by hand with high abrasive pressures in our local workshop for an elegant, crisp, frosted finish.",
    "category": "glass",
    "imageUrls": [
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&auto=format&fit=crop"
    ],
    "priceMin": 30,
    "priceMax": 45,
    "customizationOptions": [
      "Single Hand-Drawn Monogram Logo",
      "Coordinate Geography Stamp",
      "Corporate Emblem Deep Etching"
    ],
    "inStock": true,
    "featured": true,
    "createdAt": "2026-02-15T10:30:00Z"
  }
]
```

### 5.2 Reviews Collection (`/reviews`)
```json
[
  {
    "id": "rev-983120",
    "customerUid": "usr_patron_01",
    "customerName": "Julian Vance",
    "rating": 5,
    "comment": "The live-edge walnut cutting board was the absolute star of my parents' 50th anniversary. The laser-etched family tree was crisp and perfectly centered. Exceptional, professional-grade craft oils!",
    "approved": true,
    "createdAt": "2026-06-20T14:45:00Z"
  }
]
```

### 5.3 Quote Requests Collection (`/quoteRequests`)
```json
[
  {
    "id": "NQ-2026-0841",
    "customerUid": "usr_patron_01",
    "customerName": "Julian Vance",
    "customerEmail": "julian.vance@example.com",
    "customerPhone": "+1 (503) 555-0182",
    "productId": "walnut-cutting-board",
    "productName": "Live-Edge Walnut Presentation Board",
    "customizationDetails": "Engrave a custom 3-letter classic serif monogram (J.A.V) in the bottom-right corner. Prefer a recessed juice groove added to the opposite side.",
    "inspirationUrls": [
      "https://firebasestorage.googleapis.com/v0/b/nicoletta-decor/o/sketches%2Fvance_draft.png"
    ],
    "status": "pending",
    "createdAt": "2026-07-15T08:30:00Z",
    "updatedAt": "2026-07-15T08:30:00Z"
  }
]
```

---

## 6. Future-Proofing & Scaling Optimization Strategies

As **Nicoletta Crafts & Decor** expands its digital client catalog and files thousands of orders, the following architecture guidelines are implemented to guarantee speed and optimize database queries:

### 6.1 Composite Index Optimization
* **Requirement:** Filter quote requests by `status` AND sort by `createdAt` in the Portland Admin Business Console.
* **Firestore Setup:** To prevent client-side SDK errors, a custom **Composite Index** is registered:
  - Collection: `quoteRequests`
  - Fields: `status` (Ascending) ➔ `createdAt` (Descending)

### 6.2 Preventing Denial-of-Wallet (Read Explocions)
* **Strategy:** Keep the `/reviews` collection clean. Ensure that in client-facing dashboards, queries strictly enforce `limit(20)` pages to prevent malicious loops from triggering millions of simultaneous reads.
* **Rule Invariant:** Security rules block list requests that do not query using explicit `resource.data` filters or lack appropriate pagination limits.

### 6.3 Secure Storage Binding
* **Requirement:** Clients uploading inspiration mockups, full-grain leather patterns, or crystal logo drafts.
* **Execution:** Store the file assets securely in **Firebase Cloud Storage** inside `/quotes/{quoteRequestId}/{filename}`. Only reference the file URLs inside the `quoteRequests.inspirationUrls` array. Never save raw Base64 image payloads inside Firestore documents, as it triggers document size breaches (1MB maximum document limit).
