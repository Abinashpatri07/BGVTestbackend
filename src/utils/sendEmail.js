import dotenv from "dotenv";
dotenv.config();
import { Resend } from "resend";
import nodemailer from "nodemailer";

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
};

const getSmtpTransporter = () => {
  const user = process.env.SMTP_USER || "abinashpatri5@gmail.com";
  const pass = process.env.SMTP_PASS || "lwjyffkuasyaheov";
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = port === 465;

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
};

export const sendEmail = async ({ to, subject, text, html }) => {
  const fromEmail = process.env.EMAIL_FROM || "BGV Platform <noreply@dqnex.com>";
  const smtpFrom = process.env.SMTP_FROM || `"BGV Platform" <${process.env.SMTP_USER || "abinashpatri5@gmail.com"}>`;

  // 1. Try Resend first
  try {
    const resend = getResendClient();
    if (resend) {
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to,
        subject,
        text,
        html,
      });

      if (!error && data?.id) {
        console.log(`[sendEmail] Resend success (id: ${data.id}) to ${to}`);
        return true;
      }
      console.warn(`[sendEmail] Resend API error: ${error?.message || JSON.stringify(error)}`);
    }
  } catch (resendErr) {
    console.warn(`[sendEmail] Resend threw error: ${resendErr.message || resendErr}`);
  }

  // 2. Fallback to SMTP
  try {
    const transporter = getSmtpTransporter();
    if (transporter) {
      console.log(`[sendEmail] Attempting SMTP fallback for ${to}...`);
      const info = await transporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        text,
        html,
      });
      console.log(`[sendEmail] SMTP fallback success (id: ${info.messageId}) to ${to}`);
      return true;
    }
  } catch (smtpErr) {
    console.error(`[sendEmail] SMTP fallback failed: ${smtpErr.message || smtpErr}`);
  }

  console.error(`[sendEmail] All email delivery providers failed for ${to}`);
  return false;
};
