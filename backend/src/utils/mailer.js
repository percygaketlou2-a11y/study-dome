const nodemailer = require('nodemailer');

function isEmailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

// Gmail by default. Set EMAIL_HOST (and EMAIL_PORT) to use any other SMTP service
// instead, e.g. Brevo, Resend or Mailgun, which allow far more emails per day.
// The timeouts stop a stuck mail server from hanging a signup request.
function transportOptions(env = process.env) {
  const auth = { user: env.EMAIL_USER, pass: env.EMAIL_PASS };
  const timeouts = { connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 };
  if (!env.EMAIL_HOST) return { service: 'gmail', auth, ...timeouts };
  const port = Number(env.EMAIL_PORT) || 587;
  return { host: env.EMAIL_HOST, port, secure: port === 465, auth, ...timeouts };
}

let transporter = null;
function getTransporter() {
  if (!transporter) transporter = nodemailer.createTransport(transportOptions());
  return transporter;
}

// Runs an email send without letting a mail-provider problem (wrong password,
// daily limit, outage) turn the request into a server error. Returns whether it was sent.
async function attemptSend(label, send) {
  try {
    await send();
    return true;
  } catch (err) {
    console.error(`[mail] Could not send the ${label} email: ${err.message}`);
    return false;
  }
}

// What to do with a verification/reset link when email isn't configured.
// Development hands it back in the API response so the flow can be tried without
// email. Production NEVER puts it in a response - anyone could then reset another
// person's password, the admin's included - so it only goes to the server log.
function linkWithoutEmail(kind, email, path) {
  if (process.env.NODE_ENV !== 'production') return path;
  console.log(`[mail] Email is not configured. ${kind} link for ${email}: ${frontendLink(path)}`);
  return undefined;
}

// Connects to the mail server and logs in, without sending anything.
async function checkEmailLogin() {
  await getTransporter().verify();
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

// Escapes user-supplied text before it goes into an HTML email body, so a
// message can't inject markup or break the layout in the admin's inbox.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendContactNotification({ name, email, message }) {
  if (!process.env.ADMIN_EMAIL) return;
  await sendMail({
    to: process.env.ADMIN_EMAIL,
    subject: `Study Dome contact form: ${escapeHtml(name)}`,
    html: `<p>New contact message from Study Dome.</p>
<p><strong>Name:</strong> ${escapeHtml(name)}<br><strong>Email:</strong> ${escapeHtml(email)}</p>
<p>${escapeHtml(message)}</p>`,
  });
}

const ROLE_DESCRIPTION = {
  reviewer: 'a content reviewer, to check and approve study material before students see it',
  admin: 'an administrator',
};

async function sendInviteEmail({ to, role, token, invitedByName }) {
  const link = frontendLink(`/accept-invite?token=${token}`);
  await sendMail({
    to,
    subject: 'You have been invited to Study Dome',
    html: `<p>${escapeHtml(invitedByName)} has invited you to join Study Dome as ${ROLE_DESCRIPTION[role] ?? 'a staff member'}.</p>
<p><a href="${link}">Accept the invitation and set up your account</a></p>
<p>If the link doesn't work, copy this into your browser:<br>${link}</p>
<p>The link works once and expires in 7 days. If you weren't expecting this, you can ignore this email.</p>`,
  });
}

module.exports = {
  isEmailConfigured,
  transportOptions,
  attemptSend,
  linkWithoutEmail,
  checkEmailLogin,
  sendMail,
  frontendLink,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendContactNotification,
  sendInviteEmail,
};
