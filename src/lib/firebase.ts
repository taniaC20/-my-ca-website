import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  setLogLevel
} from "firebase/firestore";
import {
  getAnalytics,
  Analytics,
  isSupported as isAnalyticsSupported,
  logEvent
} from "firebase/analytics";
import { QuoteRequest } from "../types";

const env = (typeof import.meta !== "undefined" && (import.meta as any).env) || {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyD8_mvdHIXqOrxvKjdnbHaEgfzeHh5vc5o",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "nicoletta-website.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "nicoletta-website",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "nicoletta-website.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "542677199073",
  appId: env.VITE_FIREBASE_APP_ID || "1:542677199073:web:b49352a42f6967509eafa0",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-XSLN6HPVJ3"
};

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

// Initialize Firebase App singleton
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore and Firebase Auth instances
export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);

// Prevent noisy gRPC stream warnings if Firebase Console rules are in locked mode
try {
  setLogLevel("silent");
} catch {
  // Ignore if unsupported
}

// Initialize Firebase Analytics (client-side only)
export let analytics: Analytics | null = null;
let analyticsInitPromise: Promise<Analytics | null> | null = null;

export function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }
  if (analytics) {
    return Promise.resolve(analytics);
  }
  if (!analyticsInitPromise) {
    analyticsInitPromise = isAnalyticsSupported()
      .then((supported) => {
        if (supported) {
          analytics = getAnalytics(app);
          return analytics;
        }
        return null;
      })
      .catch(() => null);
  }
  return analyticsInitPromise;
}

if (typeof window !== "undefined") {
  initFirebaseAnalytics();
}

/**
 * Safely logs an event to Google Analytics for Firebase on the client.
 */
export async function trackFirebaseEvent(
  eventName: string,
  eventParams?: Record<string, any>
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const instance = analytics || (await initFirebaseAnalytics());
    if (instance) {
      logEvent(instance, eventName, eventParams);
    }
  } catch {
    // Ignore analytics errors in restricted browsers or ad-blockers
  }
}

export interface CustomerProfile {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  createdAt: string;
  emailVerified?: boolean;
  source?: "firebase-auth" | "firestore";
}

export interface AuthResult {
  success: boolean;
  customer?: CustomerProfile;
  message?: string;
  error?: string;
}

const CUSTOMER_SESSION_STORAGE_KEY = "nicoletta_customer_session_v1";
const CUSTOMER_PROFILES_CACHE_KEY = "nicoletta_customer_profiles_cache_v1";

function cacheCustomerProfileLocally(profile: CustomerProfile) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILES_CACHE_KEY);
    const map: Record<string, CustomerProfile> = raw ? JSON.parse(raw) : {};
    map[profile.email.toLowerCase()] = {
      ...map[profile.email.toLowerCase()],
      ...profile
    };
    localStorage.setItem(CUSTOMER_PROFILES_CACHE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("Unable to cache customer profile locally:", e);
  }
}

function getCachedCustomerProfile(email: string): CustomerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILES_CACHE_KEY);
    if (!raw) return null;
    const map: Record<string, CustomerProfile> = JSON.parse(raw);
    return map[email.toLowerCase()] || null;
  } catch {
    return null;
  }
}

export function getStoredCustomerSession(): CustomerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCustomerSession(profile: CustomerProfile | null) {
  if (typeof window === "undefined") return;
  try {
    if (profile) {
      localStorage.setItem(CUSTOMER_SESSION_STORAGE_KEY, JSON.stringify(profile));
      cacheCustomerProfileLocally(profile);
    } else {
      localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.warn("Unable to save customer session:", e);
  }
}

/**
 * Syncs the customer record to Firestore `/customers/{uid}` using `doc`, `getDoc`, `setDoc`, and `updateDoc`.
 */
export async function syncCustomerToFirestore(profile: CustomerProfile): Promise<boolean> {
  try {
    const customerRef = doc(db, "customers", profile.uid);
    const nowIso = new Date().toISOString();
    const existingSnap = await getDoc(customerRef);

    if (existingSnap.exists()) {
      await updateDoc(customerRef, {
        displayName: profile.fullName,
        email: profile.email,
        phone: profile.phone || "",
        emailVerified: Boolean(profile.emailVerified),
        updatedAt: nowIso
      });
    } else {
      await setDoc(customerRef, {
        uid: profile.uid,
        displayName: profile.fullName,
        email: profile.email,
        phone: profile.phone || "",
        emailVerified: Boolean(profile.emailVerified),
        createdAt: profile.createdAt || nowIso,
        updatedAt: nowIso
      });
    }
    return true;
  } catch {
    cacheCustomerProfileLocally(profile);
    return false;
  }
}

/**
 * Fetches the customer profile from Firestore `/customers/{uid}` or queries `/customers` by email.
 */
export async function fetchCustomerFromFirestore(
  uid: string,
  email?: string
): Promise<Partial<CustomerProfile> | null> {
  try {
    const customerRef = doc(db, "customers", uid);
    const snap = await getDoc(customerRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: data.uid || uid,
        fullName: data.displayName || data.fullName,
        email: data.email,
        phone: data.phone || "",
        createdAt:
          typeof data.createdAt === "string"
            ? data.createdAt
            : data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
        emailVerified: Boolean(data.emailVerified)
      };
    }

    if (email) {
      const customersCol = collection(db, "customers");
      const q = query(customersCol, where("email", "==", email.toLowerCase()));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const docSnap = querySnap.docs[0];
        const data = docSnap.data();
        return {
          uid: data.uid || docSnap.id,
          fullName: data.displayName || data.fullName,
          email: data.email,
          phone: data.phone || "",
          createdAt:
            typeof data.createdAt === "string"
              ? data.createdAt
              : data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
          emailVerified: Boolean(data.emailVerified)
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Queries `/quoteRequests` in Firestore for a specific customer email ordered by `createdAt`.
 */
export async function fetchCustomerQuotesFromFirestore(email: string): Promise<QuoteRequest[]> {
  if (!email) return [];
  try {
    const quotesCol = collection(db, "quoteRequests");
    const q = query(
      quotesCol,
      where("customerEmail", "==", email.trim().toLowerCase()),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as QuoteRequest), id: d.id }));
  } catch {
    try {
      const quotesCol = collection(db, "quoteRequests");
      const qFallback = query(quotesCol, where("customerEmail", "==", email.trim().toLowerCase()));
      const snap = await getDocs(qFallback);
      return snap.docs.map((d) => ({ ...(d.data() as QuoteRequest), id: d.id }));
    } catch {
      return [];
    }
  }
}

/**
 * Saves or creates a quote request document in `/quoteRequests` in Firestore.
 */
export async function saveQuoteRequestToFirestore(quote: QuoteRequest): Promise<boolean> {
  try {
    const quotesCol = collection(db, "quoteRequests");
    if (quote.id) {
      const quoteRef = doc(db, "quoteRequests", quote.id);
      await setDoc(quoteRef, { ...quote, customerEmail: (quote.customerEmail || "").toLowerCase() }, { merge: true });
    } else {
      await addDoc(quotesCol, { ...quote, customerEmail: (quote.customerEmail || "").toLowerCase() });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches all quote requests from `/quoteRequests` in Firestore ordered by `createdAt`.
 */
export async function fetchQuotesFromFirestore(): Promise<QuoteRequest[]> {
  try {
    const quotesCol = collection(db, "quoteRequests");
    const q = query(quotesCol, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as QuoteRequest), id: d.id }));
  } catch {
    return [];
  }
}

/**
 * Deletes a quote request from `/quoteRequests` in Firestore by ID.
 */
export async function deleteQuoteFromFirestore(quoteId: string): Promise<boolean> {
  return deleteFirestoreDocument("quoteRequests", quoteId);
}

/**
 * Deletes a document from a Firestore collection by ID.
 */
export async function deleteFirestoreDocument(collectionName: string, docId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, collectionName, docId));
    return true;
  } catch {
    return false;
  }
}

function mapFirebaseAuthError(error: any): string {
  const code = error?.code || "";
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Please switch to Log In.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters long.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password. Please check your credentials and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return error?.message || "Authentication failed. Please try again.";
  }
}

/**
 * Registers a new customer with Firebase Authentication (`createUserWithEmailAndPassword`)
 * and creates their `/customers/{uid}` document in Firestore.
 */
export async function registerCustomer(params: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<AuthResult> {
  const cleanName = params.fullName.trim();
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanPhone = (params.phone || "").trim();

  if (cleanName.length < 2) {
    return { success: false, error: "Please enter your full name (at least 2 characters)." };
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (!params.password || params.password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters long." };
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
    const user = credential.user;

    try {
      await updateProfile(user, { displayName: cleanName });
    } catch {
      // Non-fatal if displayName update fails
    }

    const nowIso = new Date().toISOString();
    const profile: CustomerProfile = {
      uid: user.uid,
      fullName: cleanName,
      email: user.email || cleanEmail,
      phone: cleanPhone,
      createdAt: user.metadata?.creationTime
        ? new Date(user.metadata.creationTime).toISOString()
        : nowIso,
      emailVerified: user.emailVerified,
      source: "firebase-auth"
    };

    await syncCustomerToFirestore(profile);
    saveCustomerSession(profile);
    trackFirebaseEvent("sign_up", { method: "password" });

    return {
      success: true,
      customer: profile,
      message: "Your customer account has been registered with Firebase!"
    };
  } catch (err: any) {
    return {
      success: false,
      error: mapFirebaseAuthError(err)
    };
  }
}

/**
 * Logs in an existing customer using Firebase Authentication (`signInWithEmailAndPassword`)
 * and restores their Firestore profile.
 */
export async function loginCustomer(params: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const cleanEmail = params.email.trim().toLowerCase();

  if (!cleanEmail || !params.password) {
    return { success: false, error: "Please enter both your email address and password." };
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, params.password);
    const user = credential.user;

    const firestoreProfile = await fetchCustomerFromFirestore(user.uid, cleanEmail);
    const cached = getCachedCustomerProfile(cleanEmail);

    const derivedName =
      firestoreProfile?.fullName ||
      user.displayName ||
      cached?.fullName ||
      cleanEmail
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());

    const profile: CustomerProfile = {
      uid: user.uid,
      fullName: derivedName,
      email: user.email || cleanEmail,
      phone: firestoreProfile?.phone || cached?.phone || "",
      createdAt:
        firestoreProfile?.createdAt ||
        (user.metadata?.creationTime ? new Date(user.metadata.creationTime).toISOString() : undefined) ||
        cached?.createdAt ||
        new Date().toISOString(),
      emailVerified: user.emailVerified,
      source: "firebase-auth"
    };

    await syncCustomerToFirestore(profile);
    saveCustomerSession(profile);
    trackFirebaseEvent("login", { method: "password" });

    return {
      success: true,
      customer: profile,
      message: "Welcome back! You are now signed in."
    };
  } catch (err: any) {
    return {
      success: false,
      error: mapFirebaseAuthError(err)
    };
  }
}

/**
 * Signs out the active customer from Firebase Auth (`signOut`) and clears local session storage.
 */
export async function logoutCustomer(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("Firebase signOut warning:", e);
  }
  saveCustomerSession(null);
}

/**
 * Subscribes to Firebase Auth state changes (`onAuthStateChanged`) and syncs customer profile.
 */
export function subscribeToAuthChanges(
  callback: (customer: CustomerProfile | null, user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, null);
      return;
    }
    const stored = getStoredCustomerSession();
    if (stored && stored.uid === user.uid) {
      callback(stored, user);
      return;
    }
    const fsProfile = await fetchCustomerFromFirestore(user.uid, user.email || undefined);
    const cleanEmail = (user.email || stored?.email || "").toLowerCase();
    const profile: CustomerProfile = {
      uid: user.uid,
      fullName:
        fsProfile?.fullName ||
        user.displayName ||
        stored?.fullName ||
        cleanEmail.split("@")[0] ||
        "Valued Patron",
      email: cleanEmail,
      phone: fsProfile?.phone || stored?.phone || "",
      createdAt:
        fsProfile?.createdAt ||
        (user.metadata?.creationTime ? new Date(user.metadata.creationTime).toISOString() : new Date().toISOString()),
      emailVerified: user.emailVerified,
      source: "firebase-auth"
    };
    saveCustomerSession(profile);
    callback(profile, user);
  });
}
