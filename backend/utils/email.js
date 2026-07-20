// ============================================
//  AssignTrack — Email Utilities
//  Uses Nodemailer with Gmail. Requires EMAIL_USER
//  and EMAIL_PASS (a Gmail App Password — not your
//  normal login password) in your .env.
// ============================================

require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Basic HTML-escaping so user-supplied text (names, titles, descriptions)
// can't break out of the email markup.
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── New assignment posted ────────────────────
// assignment.js calls this with an ARRAY of all matching students
// (User.find(...) returns an array), so this loops and sends one
// email per student rather than treating the array as a single user.
async function sendNewAssignmentEmail(users, assignment) {
  const list = Array.isArray(users) ? users : [users];
  for (const user of list) {
    try {
      await transporter.sendMail({
        from: `"AssignTrack" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: `📌 New assignment: ${escapeHtml(assignment.title)}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#f0eeff;padding:30px;border-radius:12px">
          <h2 style="color:#7c6fff">📌 New Assignment Posted</h2>
          <p>Hello ${escapeHtml(user.name)},</p>
          <p style="color:#8884aa">A new assignment has been added${assignment.subject ? ` for <strong>${escapeHtml(assignment.subject)}</strong>` : ""}:</p>
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px;margin:20px 0">
          <p style="margin:0 0 8px;font-size:16px;font-weight:bold;color:#f0eeff">${escapeHtml(assignment.title)}</p>
          ${assignment.notes ? `<p style="margin:0 0 8px;color:#8884aa">${escapeHtml(assignment.notes)}</p>` : ""}
          ${assignment.deadline ? `<p style="margin:0;color:#ff6fb0;font-weight:600">Due: ${new Date(assignment.deadline).toLocaleString()}</p>` : ""}
        </div>
        <p style="color:#8884aa;font-size:13px">Log in to AssignTrack to view full details.</p>
      </div>`
      });
    } catch (err) { console.error(`New assignment email failed ${user.email}:`, err.message); }
  }
}

// ── Daily digest of pending assignments ──────
// server.js's cron job calls this once per student with an ARRAY of their
// still-pending assignments, so this builds one digest email listing all
// of them rather than sending a separate email per assignment.
async function sendDeadlineReminderEmail(user, assignments) {
  const list = Array.isArray(assignments) ? assignments : [assignments];
  if (!list.length) return;

  try {
    await transporter.sendMail({
      from: `"AssignTrack" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `⏰ You have ${list.length} pending assignment${list.length > 1 ? "s" : ""}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#f0eeff;padding:30px;border-radius:12px">
        <h2 style="color:#7c6fff">⏰ Deadline Reminder</h2>
        <p>Hello ${escapeHtml(user.name)},</p>
        <p style="color:#8884aa">This is a reminder that the following assignment${list.length > 1 ? "s are" : " is"} still pending:</p>
        ${list.map(a => `
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px;margin:12px 0">
            <p style="margin:0 0 8px;font-size:16px;font-weight:bold;color:#f0eeff">${escapeHtml(a.title)}</p>
            ${a.subject ? `<p style="margin:0 0 8px;color:#8884aa">${escapeHtml(a.subject)}</p>` : ""}
            ${a.deadline ? `<p style="margin:0;color:#ff6fb0;font-weight:600">Due: ${new Date(a.deadline).toLocaleString()}</p>` : ""}
          </div>`).join("")}
        <p style="color:#8884aa;font-size:13px">Don't forget to submit on time!</p>
      </div>`
    });
  } catch (err) { console.error(`Deadline reminder email failed ${user.email}:`, err.message); }
}

// ── Password reset ────────────────────────────
// routes/auth.js already builds the full reset link (using the real
// request host) and passes it straight in here — so this just uses it
// as-is rather than building its own URL from a token.
async function sendPasswordResetEmail(user, resetUrl) {
  try {
    await transporter.sendMail({
      from: `"AssignTrack" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `🔑 Reset your AssignTrack password`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#f0eeff;padding:30px;border-radius:12px">
        <h2 style="color:#7c6fff">🔑 Password Reset Requested</h2>
        <p>Hello ${escapeHtml(user.name)},</p>
        <p style="color:#8884aa">We received a request to reset your AssignTrack password. Click the button below to choose a new one. If you didn't request this, you can safely ignore this email.</p>
        <div style="margin:24px 0;text-align:center">
          <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c6fff,#9b8fff);color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:10px">Reset Password</a>
        </div>
        <p style="color:#8884aa;font-size:13px">Or copy and paste this link into your browser:<br>
          <span style="color:#7c6fff;word-break:break-all">${resetUrl}</span>
        </p>
        <p style="color:#8884aa;font-size:13px">This link will expire shortly for your security.</p>
      </div>`
    });
  } catch (err) { console.error(`Password reset email failed ${user.email}:`, err.message); }
}

module.exports = { sendNewAssignmentEmail, sendDeadlineReminderEmail, sendPasswordResetEmail };