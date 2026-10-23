// Usage: npm run normalize:emails
// The API now stores and looks up emails trimmed and lowercased. Run this once
// against any database that has older accounts so they can still log in.
// If two accounts differ only by letter case it changes NOTHING and lists them,
// so you can decide which one to keep.
require('dotenv').config();
const prisma = require('../src/db');

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const canonical = (email) => email.trim().toLowerCase();

  const byCanonical = new Map();
  for (const user of users) {
    const key = canonical(user.email);
    byCanonical.set(key, [...(byCanonical.get(key) ?? []), user.email]);
  }
  const collisions = [...byCanonical.entries()].filter(([, emails]) => emails.length > 1);
  if (collisions.length > 0) {
    console.error('These accounts differ only by letter case. Resolve them (delete or merge one), then re-run:');
    collisions.forEach(([key, emails]) => console.error(`  ${key}: ${emails.join(' | ')}`));
    process.exitCode = 1;
    return;
  }

  const stale = users.filter((u) => u.email !== canonical(u.email));
  for (const user of stale) {
    await prisma.user.update({ where: { id: user.id }, data: { email: canonical(user.email) } });
  }
  console.log(`${users.length} accounts checked, ${stale.length} updated.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
