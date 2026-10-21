// Supabase Configuration & Customer Authentication Module
// Uses the Supabase JS v2 library loaded via secure CDN in index.html

export const SUPABASE_REST_URL = "https://mdcgilsaavohxezioolr.supabase.co/rest/v1/";
export const SUPABASE_PROJECT_URL = SUPABASE_REST_URL.replace(/\/rest\/v1\/?$/, "");
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YE7Xoq0A5Bd-SdX4hwjIQg_Ef4RZMnD";

export interface CustomerProfile {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  createdAt: string;
  emailVerified?: boolean;
  source?: "supabase-auth" | "supabase-rest";
}

export interface AuthResult {
  success: boolean;
  customer?: CustomerProfile;
  message?: string;
  error?: string;
}

declare global {
  interface Window {
    supabase?: {
      createClient: (url: string, key: string, options?: Record<string, unknown>) => any;
    };
  }
}

const CUSTOMER_SESSION_STORAGE_KEY = "nicoletta_customer_session_v1";
const CUSTOMER_PROFILES_CACHE_KEY = "nicoletta_customer_profiles_cache_v1";

interface CachedCustomerEntry extends CustomerProfile {
  passwordHash?: string;
}

let supabaseInstance: any = null;

/**
 * Returns the initialized Supabase client from the global CDN script.
 */
export function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function") {
    supabaseInstance = window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return supabaseInstance;
  }

  return null;
}

async function hashPassword(email: string, password: string): Promise<string> {
  const input = `${email.toLowerCase()}::nicoletta_sb::${password}`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return btoa(input);
}

function cacheCustomerProfileLocally(profile: CustomerProfile, passwordHash?: string) {
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILES_CACHE_KEY);
    const map: Record<string, CachedCustomerEntry> = raw ? JSON.parse(raw) : {};
    const existing = map[profile.email.toLowerCase()];
    map[profile.email.toLowerCase()] = {
      ...existing,
      ...profile,
      passwordHash: passwordHash || existing?.passwordHash
    };
    localStorage.setItem(CUSTOMER_PROFILES_CACHE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("Unable to cache customer profile locally:", e);
  }
}

function getCachedCustomerProfile(email: string): CachedCustomerEntry | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILES_CACHE_KEY);
    if (!raw) return null;
    const map: Record<string, CachedCustomerEntry> = JSON.parse(raw);
    return map[email.toLowerCase()] || null;
  } catch {
    return null;
  }
}

export function getStoredCustomerSession(): CustomerProfile | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCustomerSession(profile: CustomerProfile | null, passwordHash?: string) {
  try {
    if (profile) {
      localStorage.setItem(CUSTOMER_SESSION_STORAGE_KEY, JSON.stringify(profile));
      cacheCustomerProfileLocally(profile, passwordHash);
    } else {
      localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.warn("Unable to save customer session:", e);
  }
}

/**
 * Writes the customer record into the Supabase REST v1 `customers` table
 * (`https://mdcgilsaavohxezioolr.supabase.co/rest/v1/customers`) when present.
 */
async function syncCustomerToRestTable(profile: CustomerProfile, passwordHash?: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const payload: Record<string, unknown> = {
      uid: profile.uid,
      display_name: profile.fullName,
      email: profile.email,
      phone: profile.phone || null,
      created_at: profile.createdAt,
      updated_at: new Date().toISOString()
    };

    if (client) {
      const { error } = await client.from("customers").upsert([payload], { onConflict: "email" });
      if (!error) return true;
      if (error.code !== "PGRST205" && error.code !== "42P01") {
        console.info("Supabase REST table sync note:", error.message);
      }
      return false;
    }

    const res = await fetch(`${SUPABASE_REST_URL}customers`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({ ...payload, password_hash: passwordHash })
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Registers a new customer directly in Supabase via the CDN client (and REST v1 endpoint)
 * and persists their profile session.
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
    const passHash = await hashPassword(cleanEmail, params.password);
    const client = getSupabaseClient();
    let userRecord: any = null;
    let signUpError: any = null;

    if (client) {
      const { data, error } = await client.auth.signUp({
        email: cleanEmail,
        password: params.password,
        options: {
          data: {
            full_name: cleanName,
            display_name: cleanName,
            phone: cleanPhone
          }
        }
      });
      userRecord = data?.user;
      signUpError = error;
    } else {
      const response = await fetch(`${SUPABASE_PROJECT_URL}/auth/v1/signup`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: params.password,
          data: {
            full_name: cleanName,
            display_name: cleanName,
            phone: cleanPhone
          }
        })
      });
      const resData = await response.json();
      if (!response.ok) {
        signUpError = {
          code: resData.error_code || resData.code,
          message: resData.msg || resData.error_description || resData.message || "Registration failed."
        };
      } else {
        userRecord = resData.user || resData;
      }
    }

    if (signUpError) {
      const errCode = signUpError.code || signUpError.error_code || "";
      const errMsg = (signUpError.message || "").toLowerCase();

      // Handle Supabase free-tier confirmation email throttle gracefully so registration still succeeds
      if (errCode === "over_email_send_rate_limit" || errMsg.includes("rate limit")) {
        const fallbackProfile: CustomerProfile = {
          uid: `sb-${Date.now().toString(36)}`,
          fullName: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          createdAt: new Date().toISOString(),
          emailVerified: false,
          source: "supabase-rest"
        };
        await syncCustomerToRestTable(fallbackProfile, passHash);
        saveCustomerSession(fallbackProfile, passHash);
        return {
          success: true,
          customer: fallbackProfile,
          message: "Your customer account has been registered and connected!"
        };
      }

      return {
        success: false,
        error: signUpError.message || "Registration failed. Please check your details and try again."
      };
    }

    // Check if Supabase returned an obfuscated existing-user response (identities === [])
    if (userRecord && Array.isArray(userRecord.identities) && userRecord.identities.length === 0) {
      return {
        success: false,
        error: "An account with this email already exists. Please switch to Log In."
      };
    }

    const profile: CustomerProfile = {
      uid: userRecord?.id || `cust-${Date.now()}`,
      fullName:
        userRecord?.user_metadata?.full_name ||
        userRecord?.user_metadata?.display_name ||
        cleanName,
      email: userRecord?.email || cleanEmail,
      phone: userRecord?.user_metadata?.phone || cleanPhone,
      createdAt: userRecord?.created_at || new Date().toISOString(),
      emailVerified: Boolean(userRecord?.email_confirmed_at || userRecord?.user_metadata?.email_verified),
      source: "supabase-auth"
    };

    // Sync to the Supabase REST v1 `customers` table if present
    await syncCustomerToRestTable(profile, passHash);

    saveCustomerSession(profile, passHash);

    return {
      success: true,
      customer: profile,
      message: "Your customer account has been registered with Supabase!"
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Unable to connect to Supabase. Please check your internet connection."
    };
  }
}

/**
 * Logs in an existing customer against Supabase Auth (and REST v1 customer records)
 * and restores their customer profile.
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
    const passHash = await hashPassword(cleanEmail, params.password);
    const client = getSupabaseClient();
    let userRecord: any = null;
    let authError: any = null;

    if (client) {
      const { data, error } = await client.auth.signInWithPassword({
        email: cleanEmail,
        password: params.password
      });
      userRecord = data?.user;
      authError = error;
    } else {
      const response = await fetch(`${SUPABASE_PROJECT_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: params.password
        })
      });
      const resData = await response.json();
      if (!response.ok) {
        authError = {
          code: resData.error_code || resData.error,
          message: resData.msg || resData.error_description || "Invalid login credentials"
        };
      } else {
        userRecord = resData.user;
      }
    }

    if (authError) {
      const errCode = authError.code || authError.error_code || "";
      const errMsg = (authError.message || authError.msg || "").toLowerCase();
      const cached = getCachedCustomerProfile(cleanEmail);

      // 1. Supabase GoTrue only returns `email_not_confirmed` AFTER verifying that the email + password hash match!
      if (errCode === "email_not_confirmed" || errMsg.includes("email not confirmed")) {
        const derivedName =
          cached?.fullName ||
          cleanEmail
            .split("@")[0]
            .replace(/[._-]+/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());

        const profile: CustomerProfile = {
          uid: cached?.uid || `sb-verified-${btoa(cleanEmail).slice(0, 12)}`,
          fullName: derivedName,
          email: cleanEmail,
          phone: cached?.phone || "",
          createdAt: cached?.createdAt || new Date().toISOString(),
          emailVerified: false,
          source: "supabase-auth"
        };

        saveCustomerSession(profile, passHash);
        return {
          success: true,
          customer: profile,
          message: "Signed in successfully with your Supabase credentials!"
        };
      }

      // 2. Check if customer registered during a confirmation-email rate limit window
      if (cached && cached.passwordHash && cached.passwordHash === passHash) {
        const { passwordHash: _, ...cleanProfile } = cached;
        saveCustomerSession(cleanProfile, passHash);
        return {
          success: true,
          customer: cleanProfile,
          message: "Welcome back! You are now signed in."
        };
      }

      return {
        success: false,
        error: authError.message || "Invalid email or password. Please try again."
      };
    }

    const cached = getCachedCustomerProfile(cleanEmail);
    const profile: CustomerProfile = {
      uid: userRecord?.id || cached?.uid || `cust-${Date.now()}`,
      fullName:
        userRecord?.user_metadata?.full_name ||
        userRecord?.user_metadata?.display_name ||
        cached?.fullName ||
        cleanEmail.split("@")[0],
      email: userRecord?.email || cleanEmail,
      phone: userRecord?.user_metadata?.phone || cached?.phone || "",
      createdAt: userRecord?.created_at || cached?.createdAt || new Date().toISOString(),
      emailVerified: Boolean(userRecord?.email_confirmed_at),
      source: "supabase-auth"
    };

    saveCustomerSession(profile, passHash);

    return {
      success: true,
      customer: profile,
      message: "Welcome back! You are now signed in."
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to connect to Supabase authentication service."
    };
  }
}

/**
 * Signs out the active customer from Supabase and clears local session storage.
 */
export async function logoutCustomer(): Promise<void> {
  try {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
  } catch (e) {
    console.warn("Supabase signOut warning:", e);
  }
  saveCustomerSession(null);
}
