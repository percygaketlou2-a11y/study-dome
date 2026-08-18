const nodemailer = require('nodemailer');

function isEmailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
}

// Absolute link the user actually clicks - FRONTEND_URL must be set for
// links in real emails to point somewhere reachable.
function frontendLink(path) {
  const base = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  return `${base}${path}`;
}

async function sendMail({ to, subject, html }) {
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    html,
  });
}

async function sendVerificationEmail(to, token) {
  const link = frontendLink(`/verify-email?token=${token}`);
  await sendMail({
    to,
    subject: 'Verify your Study Dome email',
    html: `<p>Confirm your email address to finish setting up your Study Dome account.</p>
<p><a href="${link}">Verify my email</a></p>
<p>If the link doesn't work, copy this into your browser:<br>${link}</p>`,
  });
}

async function sendPasswordResetEmail(to, token) {
  const link = frontendLink(`/reset-password?token=${token}`);
  await sendMail({
    to,
    subject: 'Reset your Study Dome password',
    html: `<p>Someone requested a password reset for this Study Dome account. If that was you:</p>
<p><a href="${link}">Reset my password</a></p>
<p>If the link doesn't work, copy this into your browser:<br>${link}</p>
<p>This link expires in 15 minutes. If you didn't request this, you can ignore this email.</p>`,
  });
}

module.exports = { isEmailConfigured, sendVerificationEmail, sendPasswordResetEmail };
