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

  // test:postgres points PRISMA_SCHEMA at the generated PostgreSQL schema.
  const schemaArg = process.env.PRISMA_SCHEMA ? ` --schema ${process.env.PRISMA_SCHEMA}` : '';
  const onPostgres = Boolean(process.env.PRISMA_SCHEMA);
  // A reused Postgres database may hold rows from a previous run: start from empty.
  execSync(`npx prisma db push --skip-generate${schemaArg}${onPostgres ? ' --force-reset --accept-data-loss' : ''}`, {
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
