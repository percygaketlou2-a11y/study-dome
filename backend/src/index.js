require('dotenv').config();
const app = require('./app');
const { validateEnv } = require('./config');

// Refuse to start a production server with a missing or placeholder secret.
const { errors, warnings } = validateEnv();
warnings.forEach((warning) => console.warn(`[config] warning: ${warning}`));
if (errors.length > 0) {
  errors.forEach((error) => console.error(`[config] error: ${error}`));
  if (process.env.NODE_ENV === 'production') {
    console.error('[config] Refusing to start in production with the errors above.');
    process.exit(1);
  }
}

// A rejected promise nobody awaited is logged rather than silently ignored.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Study Dome API listening on port ${port}`));
