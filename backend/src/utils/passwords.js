const bcrypt = require('bcryptjs');

// bcrypt cost 12 in real use. Tests use the minimum so the suite stays fast;
// the cost is embedded in each hash, so hashes made at either cost still verify.
const ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

function hashPassword(password) {
  return bcrypt.hash(password, ROUNDS);
}

// A real hash of a throwaway value, compared against when a login names an
// account that doesn't exist. Without it, "unknown email" returns noticeably
// faster than "wrong password", which lets an attacker list registered emails.
let dummyHash;
async function verifyPassword(password, hashOrNull) {
  if (!hashOrNull) {
    dummyHash ??= await bcrypt.hash('not-a-real-password', ROUNDS);
    await bcrypt.compare(password, dummyHash);
    return false;
  }
  return bcrypt.compare(password, hashOrNull);
}

module.exports = { hashPassword, verifyPassword };
