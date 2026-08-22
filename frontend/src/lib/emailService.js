import emailjs from "@emailjs/browser";
import { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY } from "../config";

// Sends one real email via EmailJS. Silently warns instead of throwing if
// EmailJS isn't configured, so a missing email setup never blocks the
// actual in-app action (approving/releasing/settling).
export async function sendActionEmail({ toEmail, toName, message, loanRef, borrower, amount }) {
  if (!toEmail) {
    console.warn("sendActionEmail: no recipient email resolved — skipping send.", { loanRef, message });
    return;
  }
  if (!EMAILJS_SERVICE_ID || EMAILJS_SERVICE_ID.startsWith("your_")) {
    console.warn("EmailJS not configured — skipping email send.");
    return;
  }
  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        to_email: toEmail,
        to_name: toName,
        message,
        loan_ref: loanRef,
        borrower,
        amount,
      },
      EMAILJS_PUBLIC_KEY
    );
  } catch (err) {
    console.error("EmailJS send failed:", err);
  }
}

// Resolves the real user (name + email) holding a given role, optionally
// scoped to a company. Global roles like FinanceController/Treasury pass company=null.
export function findUser(users, role, company = null) {
  return users.find(u => u.role === role && (company ? u.company === company : !u.company)) || null;
}