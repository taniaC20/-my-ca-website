import React, { useState } from "react";
import {
  User,
  Mail,
  Lock,
  Phone,
  CheckCircle,
  Sparkles,
  LogOut,
  ArrowRight,
  ShieldCheck,
  FileText,
  Clock
} from "lucide-react";
import {
  CustomerProfile,
  registerCustomer,
  loginCustomer,
  logoutCustomer,
  SUPABASE_PROJECT_URL
} from "../supabaseClient";
import { QuoteRequest } from "../types";

interface CustomerAuthPortalProps {
  customer: CustomerProfile | null;
  onCustomerChange: (customer: CustomerProfile | null) => void;
  quotes: QuoteRequest[];
  onNavigate: (page: "home" | "catalog" | "quote-request") => void;
}

export default function CustomerAuthPortal({
  customer,
  onCustomerChange,
  quotes,
  onNavigate
}: CustomerAuthPortalProps) {
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusBanner, setStatusBanner] = useState("");

  const switchMode = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setErrorMsg("");
    setStatusBanner("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setStatusBanner("");

    if (authMode === "signup") {
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match. Please re-enter your password.");
        return;
      }
      setLoading(true);
      const res = await registerCustomer({
        fullName,
        email,
        phone,
        password
      });
      setLoading(false);

      if (!res.success || !res.customer) {
        setErrorMsg(res.error || "Unable to complete registration.");
        return;
      }

      setStatusBanner(res.message || "Account registered with Supabase!");
      onCustomerChange(res.customer);
      setPassword("");
      setConfirmPassword("");
    } else {
      setLoading(true);
      const res = await loginCustomer({
        email,
        password
      });
      setLoading(false);

      if (!res.success || !res.customer) {
        setErrorMsg(res.error || "Invalid login credentials.");
        return;
      }

      setStatusBanner(res.message || "Logged in successfully!");
      onCustomerChange(res.customer);
      setPassword("");
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await logoutCustomer();
    setLoading(false);
    onCustomerChange(null);
    setStatusBanner("You have been signed out of your account.");
  };

  // Filter any quotes submitted by this customer's email
  const customerQuotes = customer
    ? quotes.filter(
        (q) =>
          q.customerEmail &&
          q.customerEmail.toLowerCase() === customer.email.toLowerCase()
      )
    : [];

  if (customer) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 animate-fade-in">
        <div className="bg-white border border-brand-border rounded-[32px] p-8 sm:p-10 shadow-sm space-y-8">
          {/* Top Account Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-brand-border">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
                <CheckCircle className="h-3.5 w-3.5" /> Supabase Customer Session Active
              </div>
              <h2 className="font-serif font-bold text-2xl sm:text-3xl text-brand-dark">
                Welcome, {customer.fullName}
              </h2>
              <p className="text-xs text-brand-muted">
                Manage your patron profile and bespoke commission inquiries.
              </p>
            </div>

            <button
              id="customer-logout-btn"
              onClick={handleSignOut}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-brand-border bg-brand-highlight/40 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-brand-dark text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer self-start sm:self-center"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>

          {statusBanner && (
            <div
              id="customer-auth-success-banner"
              className="p-4 rounded-[16px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5"
            >
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{statusBanner}</span>
            </div>
          )}

          {/* Customer Profile Details Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-brand-highlight/25 border border-brand-border rounded-[24px] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">
                  Patron Details
                </span>
                <ShieldCheck className="h-4 w-4 text-brand-primary" />
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-brand-muted block">
                    Full Name
                  </span>
                  <p id="profile-fullname" className="font-semibold text-brand-dark text-sm mt-0.5">
                    {customer.fullName}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase tracking-wider text-brand-muted block">
                    Email Address
                  </span>
                  <p id="profile-email" className="font-medium text-brand-dark mt-0.5">
                    {customer.email}
                  </p>
                </div>

                {customer.phone && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-brand-muted block">
                      Phone Number
                    </span>
                    <p className="font-medium text-brand-dark mt-0.5">{customer.phone}</p>
                  </div>
                )}

                <div className="pt-2 border-t border-brand-border/60 flex items-center justify-between text-[10px] text-brand-muted font-mono">
                  <span>Supabase ID: {customer.uid.slice(0, 18)}...</span>
                  <span>Connected: {new URL(SUPABASE_PROJECT_URL).hostname.split(".")[0]}</span>
                </div>
              </div>
            </div>

            {/* Quick Patron Actions */}
            <div className="bg-brand-dark text-white rounded-[24px] p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Bespoke Commissions
                </span>
                <h3 className="font-serif font-bold text-xl">
                  Start a Custom Engraving Request
                </h3>
                <p className="text-xs text-stone-300 font-light leading-relaxed">
                  Your account details will automatically pre-fill when requesting a custom quote for woodcraft, glassware, leather, or slate pieces.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => onNavigate("quote-request")}
                  className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-white text-[10px] font-bold uppercase tracking-widest py-3 px-4 rounded-full transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Request Custom Quote <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onNavigate("catalog")}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest py-3 px-4 rounded-full transition-colors cursor-pointer text-center"
                >
                  Browse Catalog
                </button>
              </div>
            </div>
          </div>

          {/* Customer Quote History */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-lg text-brand-dark flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-primary" /> Your Recent Inquiries ({customerQuotes.length})
              </h3>
            </div>

            {customerQuotes.length === 0 ? (
              <div className="border border-dashed border-brand-border rounded-[20px] p-8 text-center space-y-2 bg-brand-highlight/10">
                <Clock className="h-6 w-6 text-brand-muted mx-auto" />
                <p className="text-xs font-medium text-brand-dark">
                  No custom quote requests found under {customer.email} yet.
                </p>
                <p className="text-[11px] text-brand-muted">
                  Submit a custom quote request to track its status right here in your account.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {customerQuotes.map((q) => (
                  <div
                    key={q.id}
                    className="border border-brand-border rounded-[16px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                  >
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-brand-dark">
                        {q.productName || "Custom Workshop Inquiry"} (Qty: {q.quantity})
                      </span>
                      <p className="text-[11px] text-brand-muted line-clamp-1">
                        {q.specialInstructions || q.engravingText || "Custom engraving specification"}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-brand-highlight text-brand-primary self-start sm:self-center">
                      {q.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12 sm:py-20 animate-fade-in">
      <div className="bg-white border border-brand-border rounded-[32px] p-8 sm:p-10 shadow-md space-y-7">
        {/* Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex h-14 w-14 rounded-full bg-brand-primary/10 items-center justify-center text-brand-primary">
            <User className="h-7 w-7" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary block">
              Patron Portal
            </span>
            <h2 className="font-serif font-bold text-2xl text-brand-dark mt-1">
              {authMode === "login" ? "Customer Log In" : "Customer Sign Up"}
            </h2>
            <p className="text-brand-muted text-xs font-light mt-1">
              {authMode === "login"
                ? "Sign in to access your saved details and bespoke quote requests."
                : "Create a patron account powered by Supabase to streamline custom orders."}
            </p>
          </div>
        </div>

        {/* Toggleable Sign Up / Log In Sequence Tabs */}
        <div
          role="tablist"
          aria-label="Customer Sign Up or Log In"
          className="grid grid-cols-2 p-1 bg-brand-highlight/50 border border-brand-border rounded-full"
        >
          <button
            id="auth-toggle-login"
            type="button"
            role="tab"
            aria-selected={authMode === "login"}
            onClick={() => switchMode("login")}
            className={`py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all cursor-pointer ${
              authMode === "login"
                ? "bg-brand-primary text-white shadow-xs"
                : "text-brand-muted hover:text-brand-dark"
            }`}
          >
            Log In
          </button>
          <button
            id="auth-toggle-signup"
            type="button"
            role="tab"
            aria-selected={authMode === "signup"}
            onClick={() => switchMode("signup")}
            className={`py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all cursor-pointer ${
              authMode === "signup"
                ? "bg-brand-primary text-white shadow-xs"
                : "text-brand-muted hover:text-brand-dark"
            }`}
          >
            Customer Sign Up
          </button>
        </div>

        {errorMsg && (
          <div
            id="customer-auth-error"
            className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-[14px] text-xs font-medium text-center"
          >
            ⚠️ {errorMsg}
          </div>
        )}

        {statusBanner && (
          <div
            id="customer-auth-status"
            className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-[14px] text-xs font-medium text-center"
          >
            {statusBanner}
          </div>
        )}

        {/* Auth Form */}
        <form id="customer-auth-form" onSubmit={handleSubmit} className="space-y-4">
          {authMode === "signup" && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="signup-fullname"
                className="text-[10px] font-bold text-brand-muted uppercase tracking-wider"
              >
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="h-4 w-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="signup-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Eleanor Vance"
                  className="w-full bg-brand-highlight/30 border border-brand-border rounded-[12px] py-3 pl-10 pr-4 text-brand-dark text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="customer-email"
              className="text-[10px] font-bold text-brand-muted uppercase tracking-wider"
            >
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="customer-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="eleanor.vance@gmail.com"
                className="w-full bg-brand-highlight/30 border border-brand-border rounded-[12px] py-3 pl-10 pr-4 text-brand-dark text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
              />
            </div>
          </div>

          {authMode === "signup" && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="signup-phone"
                className="text-[10px] font-bold text-brand-muted uppercase tracking-wider"
              >
                Phone Number (Optional)
              </label>
              <div className="relative">
                <Phone className="h-4 w-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="signup-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(709) 555-0182"
                  className="w-full bg-brand-highlight/30 border border-brand-border rounded-[12px] py-3 pl-10 pr-4 text-brand-dark text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="customer-password"
              className="text-[10px] font-bold text-brand-muted uppercase tracking-wider"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="customer-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-brand-highlight/30 border border-brand-border rounded-[12px] py-3 pl-10 pr-4 text-brand-dark text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
              />
            </div>
          </div>

          {authMode === "signup" && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="signup-confirm-password"
                className="text-[10px] font-bold text-brand-muted uppercase tracking-wider"
              >
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="signup-confirm-password"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-brand-highlight/30 border border-brand-border rounded-[12px] py-3 pl-10 pr-4 text-brand-dark text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary"
                />
              </div>
            </div>
          )}

          <button
            id="customer-auth-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-60 text-white text-[10px] uppercase tracking-widest font-bold py-3.5 px-4 rounded-full transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2 mt-2"
          >
            {loading
              ? authMode === "signup"
                ? "Registering with Supabase..."
                : "Signing In..."
              : authMode === "signup"
              ? "Create Customer Account"
              : "Log In to Account"}
          </button>
        </form>

        {/* Bottom Toggle Link */}
        <div className="pt-4 border-t border-brand-border/40 text-center space-y-2">
          {authMode === "login" ? (
            <p className="text-xs text-brand-muted">
              New to Nicoletta Crafts?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="text-brand-primary font-bold hover:underline cursor-pointer"
              >
                Customer Sign Up
              </button>
            </p>
          ) : (
            <p className="text-xs text-brand-muted">
              Already have a patron account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-brand-primary font-bold hover:underline cursor-pointer"
              >
                Log In Here
              </button>
            </p>
          )}
          <p className="text-[10px] text-brand-muted/70 font-mono">
            Secured by Supabase Auth &bull; CDN v2
          </p>
        </div>
      </div>
    </div>
  );
}
