const nodemailer = require("nodemailer");

const getEmailTransporter = () => {
  if (!process.env.OTP_EMAIL_USER || !process.env.OTP_EMAIL_PASS) {
    throw new Error("Email credentials are missing in environment variables");
  }
  return nodemailer.createTransport({
    service: process.env.OTP_EMAIL_SERVICE || "gmail",
    auth: {
      user: process.env.OTP_EMAIL_USER,
      pass: process.env.OTP_EMAIL_PASS,
    },
  });
};

/**
 * Send an email with optional CC, BCC, and attachments.
 * Reuses OTP email configuration from environment variables.
 */
const sendEmail = async ({ to, cc, bcc, subject, text, html, attachments = [] }) => {
  const transporter = getEmailTransporter();
  await transporter.verify();

  const mailOptions = {
    from: process.env.OTP_EMAIL_USER,
    to,
    subject,
    text,
    html: html || undefined,
    attachments: attachments.map((file) => ({
      filename: file.filename,
      content: file.content,
      contentType: file.contentType,
    })),
  };

  if (cc) mailOptions.cc = cc;
  if (bcc) mailOptions.bcc = bcc;

  return transporter.sendMail(mailOptions);
};

module.exports = { sendEmail, getEmailTransporter };
