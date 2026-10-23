// The three kinds of account:
//   student  - signs up publicly; sees the student site only.
//   reviewer - a teacher invited to check content. Can use Content Review and
//              nothing else in the admin area.
//   admin    - full access: content, users, payments, invitations.
//
// Staff (reviewer/admin) accounts are never created by public signup. They come
// from a single-use invitation, or - for the very first admin - from registering
// the ADMIN_EMAIL address (the "owner").
const { normalizeEmail } = require('./validate');

const ROLES = ['student', 'reviewer', 'admin'];
const STAFF_ROLES = ['reviewer', 'admin'];

// Roles an invitation may grant. Students sign up themselves.
const INVITABLE_ROLES = ['reviewer', 'admin'];

const isStaff = (role) => STAFF_ROLES.includes(role);

// The owner is the account registered with ADMIN_EMAIL. It is always an admin
// and can't be demoted or deleted by anyone, so the platform can't be locked out.
function isOwnerEmail(email) {
  const owner = normalizeEmail(process.env.ADMIN_EMAIL);
  return Boolean(owner) && email === owner;
}

module.exports = { ROLES, STAFF_ROLES, INVITABLE_ROLES, isStaff, isOwnerEmail };
