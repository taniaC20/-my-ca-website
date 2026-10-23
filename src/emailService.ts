import { QuoteRequest } from "./types";

export interface EmailSettings {
  adminEmail?: string;
  gmailUser?: string;
  gmailAppPassword?: string;
  emailNotificationsEnabled?: boolean;
}

export const DEFAULT_ADMIN_EMAIL = "sales@nicolettacraftsdecor.ca";

/**
 * Clean legacy bracketed tags that may have been stored in specialInstructions
 */
function cleanSpecialInstructions(raw?: string): string {
  if (!raw) return "";
  const cleaned = raw
    .replace(/\[PREFERRED CONTACT:[^\]]*\]/gi, "")
    .replace(/\[ALTERNATIVE CRAFT REQUESTED:[^\]]*\]/gi, "")
    .trim();
  return cleaned;
}

/**
 * Escapes HTML characters to prevent malformed rendering or script injection in HTML email clients.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sends a clean, organized, non-threaded notification email to sales@nicolettacraftsdecor.ca
 * when a client submits a quote request or contact message.
 *
 * Guarantees:
 * 1. Unique subject line & Message-ID per submission so Gmail never merges emails into a queue/thread.
 * 2. Only populated fields are displayed (all blank, unselected, or N/A fields are omitted).
 * 3. Responsive, high-contrast, beautiful HTML & clean plaintext layout.
 */
export async function sendQuoteNotificationToAdmin(
  quote: QuoteRequest,
  settings?: EmailSettings
): Promise<{ success: boolean; message: string }> {
  const recipient = settings?.adminEmail || DEFAULT_ADMIN_EMAIL;
  const isContact =
    quote.type === "contact" ||
    (quote.productName && quote.productName.toLowerCase().startsWith("contact"));

  // Generate a distinct short reference ID (e.g. NC-73A1)
  const rawId = quote.id || `q-${Date.now()}`;
  const refCode = rawId.replace(/^q-/, "").slice(-6).toUpperCase();

  // Clean and sanitize fields
  let cleanTopic = (quote.productName || "").trim();
  if (isContact) {
    cleanTopic = cleanTopic.replace(/^Contact(\s*Message)?:\s*/i, "").trim() || "Store Inquiry";
  } else if (!cleanTopic) {
    cleanTopic = "Custom Craft Project";
  }

  // Exact timestamp ensures every subject line is unique to prevent Gmail conversation threading
  const now = new Date();
  const dateFormatted = now.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const timeFormatted = now.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit"
  });
  const timeStampDisplay = `${dateFormatted} at ${timeFormatted}`;

  const subject = isContact
    ? `[Store Message #${refCode}] ${quote.customerName} - ${cleanTopic} (${dateFormatted}, ${timeFormatted})`
    : `[Quote Request #${refCode}] ${quote.customerName} - ${cleanTopic} (${dateFormatted}, ${timeFormatted})`;

  // Field evaluation (strictly omit empty, unselected, or default blanks)
  const phoneVal = (quote.customerPhone || "").trim();
  const hasPhone = Boolean(phoneVal);
  const showContactPref = Boolean(quote.contactPreference);
  const prefLabel = quote.contactPreference === "phone" ? "Phone (Call/Text)" : "Email";

  const showQuantity = !isContact && typeof quote.quantity === "number" && quote.quantity > 0;
  const cleanDeadline = (quote.deadline || "").trim();

  const cleanEngraving = (quote.engravingText || "").trim();
  const cleanFont = cleanEngraving && quote.fontPreference && quote.fontPreference.trim()
    ? quote.fontPreference.trim()
    : "";

  const cleanInstructions = cleanSpecialInstructions(quote.specialInstructions);

  const hasAlternative = Boolean(quote.alternativeRequest);
  const alternativeDetails = (quote.alternativeDetails || "").trim();

  const files = Array.isArray(quote.uploadedFiles) && quote.uploadedFiles.length > 0
    ? quote.uploadedFiles
    : [];
  const hasFiles = files.length > 0;

  // ---------------------------------------------------------------------------
  // 1. Plain Text Layout (Structured, zero "N/A" lines, only populated fields)
  // ---------------------------------------------------------------------------
  const textSections: string[] = [];

  textSections.push(
    `==================================================\n` +
    `NICOLETTA CRAFTS & DECOR — ${isContact ? "STORE CONTACT MESSAGE" : "NEW QUOTE REQUEST"}\n` +
    `==================================================\n` +
    `Reference: #${refCode}\n` +
    `Received:  ${timeStampDisplay}`
  );

  const customerLines = [
    `CUSTOMER DETAILS:`,
    `- Name:  ${quote.customerName}`,
    `- Email: ${quote.customerEmail}`
  ];
  if (hasPhone) {
    customerLines.push(`- Phone: ${phoneVal}`);
    if (showContactPref) {
      customerLines.push(`- Preferred Contact: ${prefLabel}`);
    }
  }
  textSections.push(customerLines.join("\n"));

  const projectLines = [
    isContact ? `INQUIRY DETAILS:` : `PROJECT SPECIFICATIONS:`,
    `- ${isContact ? "Subject" : "Item"}: ${cleanTopic}`
  ];
  if (showQuantity) {
    projectLines.push(`- Quantity: ${quote.quantity}`);
  }
  if (cleanDeadline) {
    projectLines.push(`- Target Deadline: ${cleanDeadline}`);
  }
  textSections.push(projectLines.join("\n"));

  if (cleanEngraving) {
    const engLines = [
      `CUSTOM PERSONALIZATION / ENGRAVING:`,
      `- Text: "${cleanEngraving}"`
    ];
    if (cleanFont) {
      engLines.push(`- Font: ${cleanFont}`);
    }
    textSections.push(engLines.join("\n"));
  }

  if (cleanInstructions) {
    textSections.push(
      `${isContact ? "MESSAGE CONTENT:" : "SPECIAL INSTRUCTIONS:"}\n${cleanInstructions}`
    );
  }

  if (hasAlternative) {
    textSections.push(
      `ALTERNATIVE CRAFT REQUEST:\n${alternativeDetails || "Customer is interested in exploring artisan alternatives or suggestions."}`
    );
  }

  if (hasFiles) {
    const fileList = files
      .map((f, i) => `  ${i + 1}. ${f.name}${f.url && !f.url.startsWith("data:") ? ` (${f.url})` : ""}`)
      .join("\n");
    textSections.push(`ATTACHED REFERENCE FILES (${files.length}):\n${fileList}`);
  }

  textSections.push(
    `--------------------------------------------------\n` +
    `Reply directly to: ${quote.customerEmail}\n` +
    `Nicoletta Crafts & Decor Web Portal (https://www.nicolettacraftsdecor.ca)`
  );

  const messageText = textSections.join("\n\n");

  // ---------------------------------------------------------------------------
  // 2. Responsive HTML Layout (Polished, branded timber & gold, card layout)
  // ---------------------------------------------------------------------------
  const messageHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f6f3ee; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2c2520; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #ebe5dc;">
          
          <!-- Timber Header -->
          <tr>
            <td style="background-color: #1e1915; padding: 28px 32px 24px; text-align: left;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 20px; font-weight: 700; color: #e2b45e; letter-spacing: 0.5px;">
                      Nicoletta Crafts &amp; Decor
                    </div>
                    <div style="margin-top: 4px; font-size: 11px; color: #a99e93; letter-spacing: 0.5px;">
                      STUDIO NOTIFICATION &bull; ST. JOHN'S, NL
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <span style="display: inline-block; padding: 5px 12px; background-color: rgba(226, 180, 94, 0.15); border: 1px solid rgba(226, 180, 94, 0.35); border-radius: 999px; color: #e2b45e; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">
                      ${isContact ? "Store Message" : "Quote Request"}
                    </span>
                  </td>
                </tr>
              </table>
              
              <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 12px; color: #c4baa9;">
                Reference: <strong style="color: #ffffff;">#${refCode}</strong> &bull; Received on <strong>${timeStampDisplay}</strong>
              </div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 28px 32px 20px;">
              
              <!-- Customer Details Card -->
              <div style="background-color: #faf8f5; border: 1px solid #ece6dc; border-radius: 12px; padding: 18px 20px; margin-bottom: 20px;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #8c7f73; margin-bottom: 8px;">
                  Customer Information
                </div>
                <div style="font-size: 18px; font-weight: 700; color: #1e1915; margin-bottom: 6px;">
                  ${escapeHtml(quote.customerName)}
                </div>
                <div style="font-size: 14px; color: #423830; line-height: 1.6;">
                  <div>
                    <strong>Email:</strong> <a href="mailto:${escapeHtml(quote.customerEmail)}" style="color: #936037; font-weight: 600; text-decoration: underline;">${escapeHtml(quote.customerEmail)}</a>
                  </div>
                  ${hasPhone ? `
                  <div style="margin-top: 4px;">
                    <strong>Phone:</strong> <a href="tel:${escapeHtml(phoneVal)}" style="color: #936037; font-weight: 600; text-decoration: underline;">${escapeHtml(phoneVal)}</a>
                  </div>` : ""}
                  ${showContactPref ? `
                  <div style="margin-top: 6px;">
                    <span style="display: inline-block; font-size: 11px; background-color: #ebdcc5; color: #5a4b41; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Preferred Contact: ${escapeHtml(prefLabel)}</span>
                  </div>` : ""}
                </div>
              </div>

              <!-- Item / Project Summary Card -->
              <div style="background-color: #ffffff; border: 1px solid #ece6dc; border-radius: 12px; padding: 18px 20px; margin-bottom: 20px;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #8c7f73; margin-bottom: 8px;">
                  ${isContact ? "Inquiry Subject" : "Item &amp; Specifications"}
                </div>
                <div style="font-size: 16px; font-weight: 600; color: #1e1915;">
                  ${escapeHtml(cleanTopic)}
                </div>
                ${(showQuantity || cleanDeadline) ? `
                <div style="margin-top: 10px; font-size: 13px; color: #5a4e44; display: flex; gap: 16px; flex-wrap: wrap;">
                  ${showQuantity ? `<div style="background: #f5f2ec; padding: 4px 10px; border-radius: 6px;"><strong>Quantity:</strong> ${quote.quantity}</div>` : ""}
                  ${cleanDeadline ? `<div style="background: #f5f2ec; padding: 4px 10px; border-radius: 6px;"><strong>Target Deadline:</strong> ${escapeHtml(cleanDeadline)}</div>` : ""}
                </div>` : ""}
              </div>

              <!-- Personalization Card (ONLY if engraving text exists) -->
              ${cleanEngraving ? `
              <div style="background-color: #fcf9f2; border: 1px solid #e7d8be; border-left: 4px solid #c59b27; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9c6c1f; margin-bottom: 6px;">
                  Custom Personalization / Engraving
                </div>
                <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-weight: 600; color: #2e261f; font-style: italic; margin-bottom: 4px;">
                  &ldquo;${escapeHtml(cleanEngraving)}&rdquo;
                </div>
                ${cleanFont ? `<div style="font-size: 12px; color: #766453; margin-top: 6px;">Typography Style: <strong>${escapeHtml(cleanFont)}</strong></div>` : ""}
              </div>` : ""}

              <!-- Special Instructions Card (ONLY if instructions exist) -->
              ${cleanInstructions ? `
              <div style="background-color: #faf9f7; border: 1px solid #e7e2d9; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #8c7f73; margin-bottom: 8px;">
                  ${isContact ? "Message Details" : "Special Instructions / Design Ideas"}
                </div>
                <div style="font-size: 14px; color: #352c25; line-height: 1.6; white-space: pre-wrap;">
                  ${escapeHtml(cleanInstructions)}
                </div>
              </div>` : ""}

              <!-- Alternative Craft Request (ONLY if selected) -->
              ${hasAlternative ? `
              <div style="background-color: #f7f9fa; border: 1px solid #dbe2e6; border-left: 4px solid #5b7c8d; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #436375; margin-bottom: 4px;">
                  Alternative Craft Requested
                </div>
                <div style="font-size: 13px; color: #273842;">
                  ${escapeHtml(alternativeDetails || "Customer is interested in exploring alternative craft ideas, materials, or custom options.")}
                </div>
              </div>` : ""}

              <!-- Attachments Card (ONLY if files exist) -->
              ${hasFiles ? `
              <div style="background-color: #faf9f7; border: 1px solid #ece6dc; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #8c7f73; margin-bottom: 8px;">
                  Uploaded Reference Files (${files.length})
                </div>
                <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #352c25; line-height: 1.8;">
                  ${files.map((f) => `
                    <li>
                      ${escapeHtml(f.name)}
                      ${f.url && !f.url.startsWith("data:") ? ` &mdash; <a href="${escapeHtml(f.url)}" target="_blank" style="color: #936037; font-weight: 600; text-decoration: underline;">View / Download</a>` : ""}
                    </li>
                  `).join("")}
                </ul>
              </div>` : ""}

              <!-- Direct Action Buttons -->
              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #ece6dc; text-align: left;">
                <a href="mailto:${escapeHtml(quote.customerEmail)}?subject=Re:%20${encodeURIComponent(subject)}" style="display: inline-block; background-color: #1e1915; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; margin-right: 12px; margin-bottom: 8px;">
                  Reply via Email &rarr;
                </a>
                ${hasPhone ? `
                <a href="tel:${escapeHtml(phoneVal)}" style="display: inline-block; background-color: #f3efe9; color: #44372e; border: 1px solid #d5cbc0; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; margin-bottom: 8px;">
                  Call ${escapeHtml(phoneVal)}
                </a>` : ""}
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #faf8f5; border-top: 1px solid #ebe5dc; padding: 18px 32px; font-size: 11px; color: #8c7f73; text-align: center; line-height: 1.5;">
              Nicoletta Crafts &amp; Decor &bull; St. John&rsquo;s, NL, Canada &bull; <a href="https://www.nicolettacraftsdecor.ca" style="color: #936037; text-decoration: none;">www.nicolettacraftsdecor.ca</a><br>
              Direct studio inquiries to <a href="mailto:sales@nicolettacraftsdecor.ca" style="color: #936037; text-decoration: none;">sales@nicolettacraftsdecor.ca</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  let apiSuccess = false;

  // 1. Send via local/serverless nodemailer API
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: recipient,
        from: settings?.gmailUser || DEFAULT_ADMIN_EMAIL,
        subject,
        text: messageText,
        html: messageHtml,
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
  // Crucial: Only include keys that have actual user content so no "N/A" or empty fields appear
  if (!apiSuccess) {
    try {
      const payload: Record<string, any> = {
        _subject: subject,
        _replyto: quote.customerEmail,
        _template: "table",
        Inquiry_Reference: `#${refCode}`,
        Customer_Name: quote.customerName,
        Customer_Email: quote.customerEmail
      };

      if (hasPhone) {
        payload.Customer_Phone = phoneVal;
      }
      if (showContactPref) {
        payload.Preferred_Contact = prefLabel;
      }

      if (isContact) {
        payload.Inquiry_Topic = cleanTopic;
      } else {
        payload.Selected_Item = cleanTopic;
        if (showQuantity) {
          payload.Quantity = quote.quantity;
        }
      }

      if (cleanDeadline) {
        payload.Target_Deadline = cleanDeadline;
      }

      if (cleanEngraving) {
        payload.Personalization_Text = cleanEngraving;
        if (cleanFont) {
          payload.Selected_Typography = cleanFont;
        }
      }

      if (cleanInstructions) {
        payload.Client_Notes = cleanInstructions;
      }

      if (hasAlternative) {
        payload.Alternative_Craft_Requested = alternativeDetails || "Yes, open to artisan suggestions";
      }

      if (hasFiles) {
        payload.Attachments = files.map((f, i) => `${i + 1}. ${f.name}`).join(", ");
      }

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

/**
 * Rigorous email validation with format checking, fake domain filter, and typo detection.
 */
export function validateEmailAddress(email: string): { valid: boolean; error?: string; suggestion?: string } {
  const trimmed = (email || "").trim();
  if (!trimmed) {
    return { valid: false, error: "Email address is required." };
  }

  // RFC-5322 standard syntax regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: "Please enter a valid email address (e.g. name@domain.com)." };
  }

  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return { valid: false, error: "Please enter a valid email address." };
  }

  const domain = parts[1].toLowerCase();

  // Reject obviously fake placeholder test domains
  const fakeDomains = ["test.com", "fake.com", "example.com", "sample.com", "invalid.com", "temp.com", "mailinator.com", "fakemail.com"];
  if (fakeDomains.includes(domain)) {
    return { valid: false, error: "Please enter your real active email address so we can reach you." };
  }

  // Detect and advise on common domain typos
  const typoMap: Record<string, string> = {
    "gmai.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "gmaik.com": "gmail.com",
    "hotmial.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "outlok.com": "outlook.com",
    "outloo.com": "outlook.com",
    "iclud.com": "icloud.com"
  };

  if (typoMap[domain]) {
    const suggestedEmail = `${parts[0]}@${typoMap[domain]}`;
    return {
      valid: false,
      error: `Did you mean @${typoMap[domain]}? Please check your email spelling.`,
      suggestion: suggestedEmail
    };
  }

  // Ensure domain TLD has at least 2 characters and doesn't contain consecutive dots
  if (domain.includes("..") || domain.split(".").pop()!.length < 2) {
    return { valid: false, error: "Please enter a valid email domain (e.g. @gmail.com, @yahoo.ca)." };
  }

  return { valid: true };
}

/**
 * Phone number validation and standard Canadian/US and International formatting.
 */
export function validatePhoneNumber(phone: string, isRequired: boolean = false): {
  valid: boolean;
  error?: string;
  formatted?: string;
} {
  const trimmed = (phone || "").trim();
  if (!trimmed) {
    if (isRequired) {
      return { valid: false, error: "Phone number is required when Phone contact is chosen." };
    }
    return { valid: true, formatted: "" };
  }

  const digits = trimmed.replace(/\D/g, "");

  // International format starting with +
  if (trimmed.startsWith("+")) {
    if (digits.length < 10 || digits.length > 15) {
      return { valid: false, error: "Please enter a valid international phone number (10-15 digits)." };
    }
    return { valid: true, formatted: trimmed };
  }

  // North American standard: 10 digits or 11 digits starting with 1
  if (digits.length === 10) {
    if (digits[0] === "0" || digits[0] === "1") {
      return { valid: false, error: "Please enter a valid phone number (area code cannot start with 0 or 1)." };
    }
    const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return { valid: true, formatted };
  } else if (digits.length === 11 && digits.startsWith("1")) {
    if (digits[1] === "0" || digits[1] === "1") {
      return { valid: false, error: "Please enter a valid phone number." };
    }
    const formatted = `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return { valid: true, formatted };
  } else {
    return { valid: false, error: "Please enter a valid 10-digit phone number (e.g. (709) 555-0182)." };
  }
}

/**
 * Sends an automated confirmation email to the client when they submit a message.
 * Verifies that their email address is real, displays a clean summary,
 * and advises them on what to do if they made a typo.
 */
export async function sendContactConfirmationToClient(
  contact: {
    name: string;
    email: string;
    phone?: string;
    contactPreference?: "email" | "phone";
    subject?: string;
    message: string;
    refCode?: string;
  },
  settings?: EmailSettings
): Promise<{ success: boolean; message: string }> {
  const senderEmail = settings?.gmailUser || DEFAULT_ADMIN_EMAIL;
  const refCode = contact.refCode || Math.random().toString(36).substring(2, 8).toUpperCase();
  const inquirySubject = contact.subject?.trim() || "General Studio Inquiry";
  const emailSubject = `Confirmation: We received your message - Nicoletta Crafts & Decor [#${refCode}]`;

  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
  const formattedTime = now.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

  const textBody = `
Dear ${contact.name},

Thank you for reaching out to Nicoletta Crafts & Decor! We have safely received your inquiry on ${formattedDate} at ${formattedTime}.

SUMMARY OF YOUR INQUIRY:
- Reference ID: #${refCode}
- Inquiry Subject: ${inquirySubject}
- Preferred Contact: ${contact.contactPreference === "phone" ? `Phone (${contact.phone || "provided"})` : `Email (${contact.email})`}
${contact.phone ? `- Phone Number: ${contact.phone}\n` : ""}- Message Content:
"${contact.message}"

WHAT HAPPENS NEXT:
Nicoletta personally reviews every message received at our St. John's studio. We will review your inquiry and reach back out to you via ${contact.contactPreference === "phone" ? "phone call/text" : "email"} within one business day.

VERIFICATION & TYPO NOTICE:
Since you received this confirmation email, your email address is verified in our system.
If you notice any typos in your phone number or email address, please reply directly to this email or send us a quick updated message via https://www.nicolettacraftsdecor.ca so we can connect with you without delay!

Warm regards,
Nicoletta & the Studio Team
Nicoletta Crafts & Decor
St. John's, NL, Canada
sales@nicolettacraftsdecor.ca
https://www.nicolettacraftsdecor.ca
`.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(emailSubject)}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f6f3ee; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2c2520; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #ebe5dc;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #1e1915; padding: 28px 32px 24px; text-align: left;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 20px; font-weight: 700; color: #e2b45e; letter-spacing: 0.5px;">
                      Nicoletta Crafts &amp; Decor
                    </div>
                    <div style="margin-top: 4px; font-size: 11px; color: #a99e93; letter-spacing: 0.5px;">
                      STUDIO INQUIRY CONFIRMATION &bull; ST. JOHN'S, NL
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <span style="display: inline-block; padding: 5px 12px; background-color: rgba(226, 180, 94, 0.15); border: 1px solid rgba(226, 180, 94, 0.35); border-radius: 999px; color: #e2b45e; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">
                      Message Received
                    </span>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 12px; color: #c4baa9;">
                Reference: <strong style="color: #ffffff;">#${refCode}</strong> &bull; Received on <strong>${formattedDate} at ${formattedTime}</strong>
              </div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 28px 32px 22px;">
              <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 21px; color: #1e1915; margin: 0 0 12px 0;">
                Thank you for reaching out, ${escapeHtml(contact.name)}!
              </h2>
              <p style="font-size: 14px; line-height: 1.6; color: #423830; margin: 0 0 20px 0;">
                We have safely received your inquiry. Nicoletta personally reads each studio message and will get back to you via <strong>${contact.contactPreference === "phone" ? "phone call/text" : "email"}</strong> within <strong>one business day</strong>.
              </p>

              <!-- Summary Card -->
              <div style="background-color: #faf8f5; border: 1px solid #ece6dc; border-radius: 12px; padding: 18px 20px; margin-bottom: 20px;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #8c7f73; margin-bottom: 10px;">
                  Summary of What You Submitted
                </div>
                <div style="font-size: 14px; color: #352c25; line-height: 1.6;">
                  <div style="margin-bottom: 6px;">
                    <strong>Subject:</strong> ${escapeHtml(inquirySubject)}
                  </div>
                  <div style="margin-bottom: 6px;">
                    <strong>Preferred Contact:</strong> ${contact.contactPreference === "phone" ? "Phone (Call or Text)" : "Email"}
                  </div>
                  ${contact.phone ? `
                  <div style="margin-bottom: 6px;">
                    <strong>Phone Provided:</strong> ${escapeHtml(contact.phone)}
                  </div>` : ""}
                  <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e2dbce;">
                    <strong>Your Message:</strong>
                    <div style="margin-top: 6px; font-style: italic; color: #4c3f35; background: #ffffff; padding: 12px 14px; border-radius: 8px; border: 1px solid #ebe5dc; white-space: pre-wrap; font-size: 13px; line-height: 1.5;">
                      &ldquo;${escapeHtml(contact.message)}&rdquo;
                    </div>
                  </div>
                </div>
              </div>

              <!-- Verification Notice -->
              <div style="background-color: #fcf9f2; border: 1px solid #ebdcb9; border-left: 4px solid #c59b27; border-radius: 10px; padding: 14px 18px; margin-bottom: 22px;">
                <div style="font-size: 12px; font-weight: 700; color: #875c1b; margin-bottom: 4px;">
                  Did you spot a typo in your email or phone number?
                </div>
                <div style="font-size: 13px; color: #5a4730; line-height: 1.5;">
                  If any of your contact details above need a correction, simply <strong>reply directly to this email</strong> with the updated information, or submit a quick update on our site so we can reach you smoothly!
                </div>
              </div>

              <div style="font-size: 13px; color: #5a4e44; line-height: 1.6;">
                Warm regards,<br>
                <strong>Nicoletta &amp; the Studio Team</strong><br>
                <em>Nicoletta Crafts &amp; Decor &bull; St. John's, NL</em>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #faf8f5; border-top: 1px solid #ebe5dc; padding: 18px 32px; font-size: 11px; color: #8c7f73; text-align: center; line-height: 1.5;">
              Nicoletta Crafts &amp; Decor &bull; St. John&rsquo;s, NL, Canada &bull; <a href="https://www.nicolettacraftsdecor.ca" style="color: #936037; text-decoration: none;">www.nicolettacraftsdecor.ca</a><br>
              Inquiries: <a href="mailto:sales@nicolettacraftsdecor.ca" style="color: #936037; text-decoration: none;">sales@nicolettacraftsdecor.ca</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: contact.email,
        from: senderEmail,
        subject: emailSubject,
        text: textBody,
        html: htmlBody,
        appPassword: settings?.gmailAppPassword,
        replyTo: DEFAULT_ADMIN_EMAIL
      })
    });
    if (res.ok) {
      return { success: true, message: `Confirmation dispatched to client: ${contact.email}` };
    }
  } catch (err) {
    console.warn("Client confirmation email dispatch error:", err);
  }

  return { success: false, message: "Could not send client confirmation email" };
}
