// Input checks for the API boundary. Request bodies are attacker-controlled
// JSON, so a field expected to be a string can arrive as an object or array.
// Checking the type first stops those values reaching the database layer or
// the password hasher.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt silently ignores anything beyond 72 bytes

function isString(value) {
  return typeof value === 'string';
}

// One canonical form per address, so "A@x.com" and "a@x.com" can never be two
// accounts (and can never sidestep the case-insensitive ADMIN_EMAIL check).
function normalizeEmail(value) {
  return isString(value) ? value.trim().toLowerCase() : null;
}

function isValidEmail(email) {
  return isString(email) && email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email);
}

// Returns an error message, or null when the password is acceptable.
function passwordProblem(password) {
  if (!isString(password)) return 'Password is required';
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return `Password must be at most ${PASSWORD_MAX_BYTES} bytes`;
  return null;
}

// Trimmed string within a length cap, or null if it is missing/wrong type/too long.
function cleanText(value, maxLength) {
  if (!isString(value)) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

module.exports = { isString, normalizeEmail, isValidEmail, passwordProblem, cleanText, PASSWORD_MIN_LENGTH };
