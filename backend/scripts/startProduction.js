// Starts Study Dome on a live server: prepares the database, then runs the API
// (which also serves the website). Run by `npm start` at the repo root.
//
//   1. check the configuration
//   2. create/update the PostgreSQL tables       (prisma db push, never with data-loss allowed)
//   3. make sure the curricula and subjects exist (idempotent, no sample content)
//   4. load the BGCSE content pack                (idempotent; items stay hidden until approved)
//   5. start the server
//
// Steps 3 and 4 are safe to repeat on every start: they only add what is missing.
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require('dotenv').config();

const path = require('path');
const { execFileSync } = require('child_process');
const { validateEnv } = require('../src/config');
const { writePostgresSchema } = require('./preparePostgres');

const backendDir = path.join(__dirname, '..');

const { errors, warnings } = validateEnv();
warnings.forEach((warning) => console.warn(`[config] warning: ${warning}`));
if (errors.length > 0) {
  errors.forEach((error) => console.error(`[config] error: ${error}`));
  console.error('[start] Not starting: fix the configuration above.');
  process.exit(1);
}

function run(label, scriptPath, args = []) {
  console.log(`[start] ${label}...`);
  execFileSync(process.execPath, [scriptPath, ...args], { cwd: backendDir, env: process.env, stdio: 'inherit' });
}

const schemaPath = path.relative(backendDir, writePostgresSchema());
const prismaCli = require.resolve('prisma/build/index.js');

// No --accept-data-loss: if a schema change would delete data, the deploy fails
// loudly here instead of silently dropping it.
run('Updating database tables', prismaCli, ['db', 'push', '--schema', schemaPath]);
run('Ensuring curricula and subjects exist', path.join(backendDir, 'prisma', 'seed.js'), ['--structure-only']);

try {
  run('Loading content pack', path.join(backendDir, 'prisma', 'importContent.js'));
} catch (err) {
  // The site is still usable without it, so a problem here must not take it down.
  console.error('[start] The content pack could not be loaded; continuing without it:', err.message);
}

require('../src/index');
