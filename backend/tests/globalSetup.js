const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });

module.exports = async () => {
  const dbPath = path.join(__dirname, '..', 'test.db');
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
