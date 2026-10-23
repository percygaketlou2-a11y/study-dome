const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });

module.exports = async () => {
  // Prisma resolves a relative SQLite URL ("file:./test.db") against the schema's
  // folder, so the test database lives in prisma/, not next to package.json.
  const dbPath = path.join(__dirname, '..', 'prisma', 'test.db');
  for (const suffix of ['', '-journal', '-shm', '-wal']) {
    const p = dbPath + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  execSync('npx prisma db push --skip-generate', {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });

  execSync('node prisma/seed.js', {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });
};
