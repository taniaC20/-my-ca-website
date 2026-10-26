import nodemailer from "nodemailer";

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { to, from, subject, text, html, appPassword, replyTo } = req.body || {};

  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: "Missing required fields (to, subject, text/html)." });
  }

  const senderEmail = from || process.env.GMAIL_USER || "sales@nicolettacraftsdecor.ca";
  const DEFAULT_APP_PASSWORD = "avtfmlmoaqwnacyo";
  const password = (appPassword || process.env.GMAIL_APP_PASSWORD || DEFAULT_APP_PASSWORD).trim().replace(/\s+/g, "");

  if (!password) {
    try {
      const fbRes = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: subject,
          _replyto: replyTo || undefined,
          message: text || html
        })
      });
      if (fbRes.ok) {
        return res.status(200).json({ success: true, method: "fallback" });
      }
    } catch {
      // Continue to fallback response
    }

    return res.status(200).json({
      success: false,
      needsPassword: true,
      error: "Gmail App Password is not configured yet."
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

    const uniqueMessageId = `<inquiry-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@nicolettacraftsdecor.ca>`;

    const info = await transporter.sendMail({
      from: `"Nicoletta Crafts & Decor" <${senderEmail}>`,
      to,
      replyTo: replyTo || senderEmail,
      subject,
      text,
      html: html || (text ? text.replace(/\n/g, "<br/>") : ""),
      messageId: uniqueMessageId,
      headers: {
        "X-Entity-Ref-ID": uniqueMessageId
      }
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
}
