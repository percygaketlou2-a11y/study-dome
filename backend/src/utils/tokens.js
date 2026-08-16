const crypto = require('crypto');

// Generates a random raw token to hand to the user (in the URL/link) plus its
// SHA-256 hash to store in the DB - the DB never holds a usable token, same
// principle as password hashing.
function generateToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = { generateToken, hashToken };
