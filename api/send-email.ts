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
}
