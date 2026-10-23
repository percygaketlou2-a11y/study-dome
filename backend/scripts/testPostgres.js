// Runs the whole test suite against a real PostgreSQL database instead of SQLite.
//   TEST_POSTGRES_URL=postgresql://user:pass@localhost:5432/studydome_test npm run test:postgres
// The database is wiped first, so use an empty one made for testing.
const path = require('path');
const { execFileSync } = require('child_process');
const { writePostgresSchema } = require('./preparePostgres');

const url = process.env.TEST_POSTGRES_URL;
if (!url || !/^postgres(ql)?:\/\//.test(url)) {
  console.error('Set TEST_POSTGRES_URL to an empty PostgreSQL database, e.g. postgresql://user:pass@localhost:5432/studydome_test');
  process.exit(1);
}

const backendDir = path.join(__dirname, '..');
const schemaPath = path.relative(backendDir, writePostgresSchema());
const prismaCli = require.resolve('prisma/build/index.js');
const run = (args, env = process.env) => execFileSync(process.execPath, args, { cwd: backendDir, env, stdio: 'inherit' });

// Every test file opens its own Prisma client; without a small pool per client the
// run exhausts the database's connection limit part-way through.
const testUrl = new URL(url);
if (!testUrl.searchParams.has('connection_limit')) testUrl.searchParams.set('connection_limit', '4');
if (!testUrl.searchParams.has('connect_timeout')) testUrl.searchParams.set('connect_timeout', '30');
if (!testUrl.searchParams.has('pool_timeout')) testUrl.searchParams.set('pool_timeout', '60');

let failed = false;
try {
  run([prismaCli, 'generate', '--schema', schemaPath]);
  run([path.join(backendDir, 'node_modules', 'jest', 'bin', 'jest.js'), '--forceExit', ...process.argv.slice(2)], { ...process.env, DATABASE_URL: testUrl.toString(), PRISMA_SCHEMA: schemaPath });
} catch (err) {
  failed = true;
  console.error(`test:postgres failed: ${err.message}`);
} finally {
  // Put the development (SQLite) client back so `npm run dev` keeps working.
  run([prismaCli, 'generate']);
}
process.exit(failed ? 1 : 0);
