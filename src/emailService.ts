import { QuoteRequest } from "./types";

export interface EmailSettings {
  adminEmail?: string;
  gmailUser?: string;
  gmailAppPassword?: string;
  emailNotificationsEnabled?: boolean;
}

export const DEFAULT_ADMIN_EMAIL = "sales@nicolettacraftsdecor.ca";

/**
 * Sends a notification email to sales@nicolettacraftsdecor.ca when a client submits a quote request.
 */
export async function sendQuoteNotificationToAdmin(
  quote: QuoteRequest,
  settings?: EmailSettings
): Promise<{ success: boolean; message: string }> {
  const recipient = settings?.adminEmail || DEFAULT_ADMIN_EMAIL;
  const isContact = quote.type === "contact" || (quote.productName && quote.productName.toLowerCase().startsWith("contact"));
  const subject = isContact
    ? `[Store Message] ${quote.customerName} - ${quote.productName || "General Message"}`
    : `[New Custom Quote Request] ${quote.customerName} - ${quote.productName || "Custom Craft"}`;

  const filesSummary =
    Array.isArray(quote.uploadedFiles) && quote.uploadedFiles.length > 0
      ? quote.uploadedFiles
          .map((f, i) => `${i + 1}. ${f.name}${f.url && !f.url.startsWith("data:") ? ` (${f.url})` : " (Image file attached)"}`)
          .join("\n")
      : "None attached";

  const messageText = `
${isContact ? "=== NEW STORE CONTACT MESSAGE ===" : "=== NEW BESPOKE QUOTE REQUEST ==="}

CUSTOMER DETAILS:
- Name: ${quote.customerName}
- Email: ${quote.customerEmail}
- Phone: ${quote.customerPhone || "Not provided"}
- Preferred Contact Method: ${quote.contactPreference === "phone" ? "By Phone" : "By Email"}

PROJECT & SPECIFICATIONS:
- Item / Project: ${quote.productName}
- Quantity: ${quote.quantity || 1}
- Target Deadline: ${quote.deadline || "Flexible / Not specified"}
${quote.engravingText ? `- Custom Personalization Text: "${quote.engravingText}"` : ""}
${quote.fontPreference ? `- Font Preference: ${quote.fontPreference}` : ""}
${quote.specialInstructions ? `- Special Instructions: ${quote.specialInstructions}` : ""}

ATTACHMENTS:
${filesSummary}

${quote.alternativeRequest ? `\nALTERNATIVE CRAFT REQUEST:\n${quote.alternativeDetails || "Yes, requested alternative craft quote."}` : ""}

--------------------------------------------------
Submitted via Nicoletta Crafts & Decor Web Portal (https://www.nicolettacraftsdecor.ca)
Date: ${new Date().toLocaleString()}
Inquiry ID: ${quote.id || "N/A"}
  `.trim();

  let apiSuccess = false;

  // 1. Try backend / serverless endpoint first
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: recipient,
        from: settings?.gmailUser || DEFAULT_ADMIN_EMAIL,
        subject,
        text: messageText,
        appPassword: settings?.gmailAppPassword,
        replyTo: quote.customerEmail
      })
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        apiSuccess = true;
      }
    }
  } catch (err) {
    console.warn("Backend /api/send-email endpoint not reachable, using fallback notification service", err);
  }

  // 2. Fallback: FormSubmit zero-config AJAX delivery directly to sales@nicolettacraftsdecor.ca
  if (!apiSuccess) {
    try {
      const payload: Record<string, any> = {
        _subject: subject,
        _replyto: quote.customerEmail,
        _template: "table",
        Customer_Name: quote.customerName,
        Customer_Email: quote.customerEmail,
        Customer_Phone: quote.customerPhone || "N/A",
        Preferred_Contact: quote.contactPreference === "phone" ? "By Phone" : "By Email",
        Item_Or_Project: quote.productName,
        Quantity: quote.quantity || 1,
        Deadline: quote.deadline || "Flexible",
        Personalization_Text: quote.engravingText || "N/A",
        Typography_Font: quote.fontPreference || "N/A",
        Special_Design_Instructions: quote.specialInstructions || "N/A",
        Alternative_Craft_Request: quote.alternativeRequest ? (quote.alternativeDetails || "Yes") : "No",
        Attachments_Count: (quote.uploadedFiles || []).length,
        Inquiry_ID: quote.id || "N/A"
      };

      await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });
    } catch (fallbackErr) {
      console.warn("FormSubmit fallback attempt:", fallbackErr);
    }
  }

  return { success: true, message: `Notification dispatched to ${recipient}` };
}

/**
 * Dispatches proposal email to client from sales@nicolettacraftsdecor.ca.
 */
export async function dispatchClientProposal(
  proposal: {
    clientEmail: string;
    clientName: string;
    subject: string;
    body: string;
    quoteAmount?: number;
    quoteId: string;
  },
  settings?: EmailSettings
): Promise<{ success: boolean; method: "smtp" | "gmail_web" | "fallback"; error?: string }> {
  const fromEmail = settings?.gmailUser || DEFAULT_ADMIN_EMAIL;

  // Attempt direct SMTP / API dispatch
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: proposal.clientEmail,
        from: fromEmail,
        subject: proposal.subject,
        text: proposal.body,
        html: proposal.body.replace(/\n/g, "<br/>"),
        appPassword: settings?.gmailAppPassword
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, method: "smtp" };
    } else if (data.error) {
      return { success: false, method: "gmail_web", error: data.error };
    }
  } catch (err: any) {
    console.warn("API email dispatch failed:", err);
  }

  return { success: false, method: "gmail_web" };
}

/**
 * Opens Gmail compose in a popup or new tab with pre-filled fields.
 */
export function openGmailCompose(options: {
  to: string;
  subject: string;
  body: string;
}) {
  const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(options.to)}&su=${encodeURIComponent(options.subject)}&body=${encodeURIComponent(options.body)}`;
  window.open(url, "_blank", "width=850,height=700");
}
